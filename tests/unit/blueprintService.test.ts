import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  BlueprintConflictError,
  BlueprintNotFoundError,
  BlueprintValidationError,
  createBlueprint,
  deleteBlueprint,
  updateBlueprint,
} from "@/server/services/blueprintService";

// Test này chạy trên database dev thật — tự tạo ExamBlueprint riêng (tên
// prefix "[vitest-blueprint]") và dọn sạch sau khi chạy.

let adminId: string;
let subjectToanId: string;
let topicDaiSoId: string;
let topicOfOtherSubjectId: string;
const createdBlueprintIds: string[] = [];

beforeAll(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { username: "admin" } });
  adminId = admin.id;
  const toan = await prisma.subject.findUniqueOrThrow({ where: { slug: "toan" } });
  subjectToanId = toan.id;
  const daiSo = await prisma.topic.findFirstOrThrow({ where: { subjectId: toan.id } });
  topicDaiSoId = daiSo.id;
  const otherSubject = await prisma.subject.findFirstOrThrow({ where: { id: { not: toan.id } } });
  const otherTopic = await prisma.topic.findFirstOrThrow({ where: { subjectId: otherSubject.id } });
  topicOfOtherSubjectId = otherTopic.id;
});

afterAll(async () => {
  if (createdBlueprintIds.length > 0) {
    await prisma.examGenerationJob.deleteMany({ where: { blueprintId: { in: createdBlueprintIds } } });
    await prisma.examBlueprint.deleteMany({ where: { id: { in: createdBlueprintIds } } });
  }
  await prisma.$disconnect();
});

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    name: "[vitest-blueprint] Cấu trúc test",
    examType: "TEST",
    durationMinutes: 60,
    sections: [{ name: "Section 1", rules: [{ quantity: 3 }] }],
    ...overrides,
  } as never;
}

describe("createBlueprint", () => {
  it("tạo thành công → questionCount/totalQuestions tự tính từ rule, không tin số từ client", async () => {
    const blueprint = await createBlueprint(
      baseInput({
        sections: [
          { name: "Trắc nghiệm", rules: [{ quantity: 4 }, { quantity: 3 }] },
          { name: "Đúng/Sai", rules: [{ quantity: 2 }] },
        ],
      }),
      adminId,
    );
    createdBlueprintIds.push(blueprint.id);

    expect(blueprint.totalQuestions).toBe(9);
    expect(blueprint.sections[0].questionCount).toBe(7);
    expect(blueprint.sections[1].questionCount).toBe(2);
  });

  it("subject của Rule không tồn tại → BlueprintValidationError", async () => {
    await expect(
      createBlueprint(
        baseInput({
          sections: [{ name: "A", rules: [{ quantity: 1, subjectId: "00000000-0000-4000-8000-000000000000" }] }],
        }),
        adminId,
      ),
    ).rejects.toBeInstanceOf(BlueprintValidationError);
  });

  it("topic không thuộc subject đã chọn ở Rule → BlueprintValidationError", async () => {
    await expect(
      createBlueprint(
        baseInput({
          sections: [
            {
              name: "A",
              rules: [{ quantity: 1, subjectId: subjectToanId, topicId: topicOfOtherSubjectId }],
            },
          ],
        }),
        adminId,
      ),
    ).rejects.toBeInstanceOf(BlueprintValidationError);
  });

  it("topic hợp lệ thuộc đúng subject → tạo thành công", async () => {
    const blueprint = await createBlueprint(
      baseInput({
        sections: [{ name: "A", rules: [{ quantity: 1, subjectId: subjectToanId, topicId: topicDaiSoId }] }],
      }),
      adminId,
    );
    createdBlueprintIds.push(blueprint.id);
    expect(blueprint.sections[0].rules[0].topicId).toBe(topicDaiSoId);
  });
});

describe("updateBlueprint", () => {
  it("không tồn tại → BlueprintNotFoundError", async () => {
    await expect(updateBlueprint("00000000-0000-4000-8000-000000000000", baseInput())).rejects.toBeInstanceOf(
      BlueprintNotFoundError,
    );
  });

  it("Blueprint đã ARCHIVED → BlueprintConflictError", async () => {
    const blueprint = await createBlueprint(baseInput(), adminId);
    createdBlueprintIds.push(blueprint.id);
    await prisma.examBlueprint.update({ where: { id: blueprint.id }, data: { status: "ARCHIVED" } });

    await expect(updateBlueprint(blueprint.id, baseInput())).rejects.toBeInstanceOf(BlueprintConflictError);
  });

  it("update hợp lệ → xoá sections cũ, tạo lại đúng theo input mới", async () => {
    const blueprint = await createBlueprint(baseInput(), adminId);
    createdBlueprintIds.push(blueprint.id);

    const updated = await updateBlueprint(
      blueprint.id,
      baseInput({ sections: [{ name: "Section mới", rules: [{ quantity: 10 }] }] }),
    );
    expect(updated.sections).toHaveLength(1);
    expect(updated.sections[0].name).toBe("Section mới");
    expect(updated.totalQuestions).toBe(10);
  });
});

describe("deleteBlueprint", () => {
  it("chưa từng sinh đề → xoá thành công", async () => {
    const blueprint = await createBlueprint(baseInput(), adminId);
    await deleteBlueprint(blueprint.id);
    const found = await prisma.examBlueprint.findUnique({ where: { id: blueprint.id } });
    expect(found).toBeNull();
  });

  it("đã có generationJob → BlueprintConflictError, không xoá", async () => {
    const blueprint = await createBlueprint(baseInput(), adminId);
    createdBlueprintIds.push(blueprint.id);
    await prisma.examGenerationJob.create({
      data: { blueprintId: blueprint.id, mode: "RANDOM", status: "FAILED", createdById: adminId },
    });

    await expect(deleteBlueprint(blueprint.id)).rejects.toBeInstanceOf(BlueprintConflictError);
    const stillExists = await prisma.examBlueprint.findUnique({ where: { id: blueprint.id } });
    expect(stillExists).not.toBeNull();
  });

  it("không tồn tại → BlueprintNotFoundError", async () => {
    await expect(deleteBlueprint("00000000-0000-4000-8000-000000000000")).rejects.toBeInstanceOf(
      BlueprintNotFoundError,
    );
  });
});
