import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createBlueprint } from "@/server/services/blueprintService";
import {
  GenerationBlockedError,
  GenerationInsufficientError,
  commitGeneratedExam,
  generateExamFromBlueprint,
} from "@/server/services/examGenerationService";

// Test này chạy trên database dev thật. Để không phụ thuộc/pollute dữ liệu
// Question có sẵn, mỗi nhóm test tạo Topic riêng (prefix "[vitest-gen]") rồi
// seed đúng số Question ACTIVE cần thiết trong Topic đó — Rule lọc theo đúng
// topicId này nên số lượng candidate luôn chính xác, không bị ảnh hưởng bởi
// Question khác đã có trong DB.

let adminId: string;
let subjectId: string;
const createdTopicIds: string[] = [];
const createdQuestionIds: string[] = [];
const createdBlueprintIds: string[] = [];

async function makeTopic(name: string) {
  const topic = await prisma.topic.create({
    data: { subjectId, name, slug: `${name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` },
  });
  createdTopicIds.push(topic.id);
  return topic;
}

async function makeQuestions(topicId: string, count: number, status: "ACTIVE" | "DRAFT" | "ARCHIVED" = "ACTIVE") {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const q = await prisma.question.create({
      data: {
        content: `[vitest-gen] Câu hỏi ${topicId}-${i}`,
        type: "SINGLE_CHOICE",
        difficulty: "EASY",
        subjectId,
        topicId,
        status,
        options: {
          create: [
            { label: "A", content: "A", isCorrect: true, order: 0 },
            { label: "B", content: "B", isCorrect: false, order: 1 },
          ],
        },
      },
    });
    ids.push(q.id);
    createdQuestionIds.push(q.id);
  }
  return ids;
}

async function makeBlueprint(sections: { name: string; rules: { topicId: string; quantity: number }[] }[]) {
  const blueprint = await createBlueprint(
    {
      name: `[vitest-gen] Blueprint ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      examType: "TEST",
      subjectId: undefined,
      durationMinutes: 60,
      sections: sections.map((s) => ({
        name: s.name,
        rules: s.rules.map((r) => ({ topicId: r.topicId, quantity: r.quantity })),
      })),
    } as never,
    adminId,
  );
  createdBlueprintIds.push(blueprint.id);
  return blueprint;
}

beforeAll(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { username: "admin" } });
  adminId = admin.id;
  const toan = await prisma.subject.findUniqueOrThrow({ where: { slug: "toan" } });
  subjectId = toan.id;
});

afterAll(async () => {
  if (createdBlueprintIds.length > 0) {
    await prisma.exam.deleteMany({ where: { generatedFromBlueprintId: { in: createdBlueprintIds } } });
    await prisma.examGenerationJob.deleteMany({ where: { blueprintId: { in: createdBlueprintIds } } });
    await prisma.examBlueprint.deleteMany({ where: { id: { in: createdBlueprintIds } } });
  }
  if (createdQuestionIds.length > 0) {
    await prisma.question.deleteMany({ where: { id: { in: createdQuestionIds } } });
  }
  if (createdTopicIds.length > 0) {
    await prisma.topic.deleteMany({ where: { id: { in: createdTopicIds } } });
  }
  await prisma.$disconnect();
});

describe("generateExamFromBlueprint — đủ câu", () => {
  it("chọn đúng số lượng, tạo Exam+ExamQuestion, Job=CONFIRMED, Item=CONFIRMED", async () => {
    const topic = await makeTopic("Gen Sufficient");
    await makeQuestions(topic.id, 4);

    const blueprint = await makeBlueprint([{ name: "Section 1", rules: [{ topicId: topic.id, quantity: 3 }] }]);
    const { job, exam } = await generateExamFromBlueprint(blueprint.id, adminId);

    expect(exam.questionCount).toBe(3);
    const examQuestions = await prisma.examQuestion.findMany({ where: { examId: exam.id } });
    expect(examQuestions).toHaveLength(3);
    expect(new Set(examQuestions.map((eq) => eq.questionId)).size).toBe(3);

    const freshJob = await prisma.examGenerationJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(freshJob.status).toBe("CONFIRMED");
    const item = await prisma.examGenerationItem.findFirstOrThrow({ where: { jobId: job.id } });
    expect(item.status).toBe("CONFIRMED");
    expect(item.resultingExamId).toBe(exam.id);
  });

  it("2 Rule cùng Topic không chọn trùng Question (chống duplicate trong 1 Exam)", async () => {
    const topic = await makeTopic("Gen Dedup");
    await makeQuestions(topic.id, 4);

    const blueprint = await makeBlueprint([
      {
        name: "Section 1",
        rules: [
          { topicId: topic.id, quantity: 2 },
          { topicId: topic.id, quantity: 2 },
        ],
      },
    ]);
    const { exam } = await generateExamFromBlueprint(blueprint.id, adminId);
    const examQuestions = await prisma.examQuestion.findMany({ where: { examId: exam.id } });
    expect(examQuestions).toHaveLength(4);
    expect(new Set(examQuestions.map((eq) => eq.questionId)).size).toBe(4);
  });

  it("chỉ chọn Question ACTIVE — bỏ qua DRAFT và ARCHIVED", async () => {
    const topic = await makeTopic("Gen Status Filter");
    await makeQuestions(topic.id, 2, "ACTIVE");
    await makeQuestions(topic.id, 3, "DRAFT");
    await makeQuestions(topic.id, 3, "ARCHIVED");

    const blueprint = await makeBlueprint([{ name: "Section 1", rules: [{ topicId: topic.id, quantity: 2 }] }]);
    const { exam } = await generateExamFromBlueprint(blueprint.id, adminId);
    const examQuestions = await prisma.examQuestion.findMany({
      where: { examId: exam.id },
      include: { question: { select: { status: true } } },
    });
    expect(examQuestions.every((eq) => eq.question.status === "ACTIVE")).toBe(true);
  });
});

describe("generateExamFromBlueprint — thiếu câu", () => {
  it("thiếu câu → GenerationInsufficientError, Job=FAILED, Item=INSUFFICIENT, KHÔNG tạo Exam", async () => {
    const topic = await makeTopic("Gen Insufficient");
    await makeQuestions(topic.id, 2);

    const blueprint = await makeBlueprint([{ name: "Section 1", rules: [{ topicId: topic.id, quantity: 5 }] }]);

    let caught: unknown;
    try {
      await generateExamFromBlueprint(blueprint.id, adminId);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(GenerationInsufficientError);

    const examCount = await prisma.exam.count({ where: { generatedFromBlueprintId: blueprint.id } });
    expect(examCount).toBe(0);

    const job = await prisma.examGenerationJob.findFirstOrThrow({ where: { blueprintId: blueprint.id } });
    expect(job.status).toBe("FAILED");
    const item = await prisma.examGenerationItem.findFirstOrThrow({ where: { jobId: job.id } });
    expect(item.status).toBe("INSUFFICIENT");
    expect((item.distributionSummary as { missing: number }[])[0].missing).toBe(3);
  });

  it("Blueprint đã ARCHIVED → GenerationBlockedError, không tạo Job mới", async () => {
    const topic = await makeTopic("Gen Archived Blueprint");
    await makeQuestions(topic.id, 5);
    const blueprint = await makeBlueprint([{ name: "Section 1", rules: [{ topicId: topic.id, quantity: 2 }] }]);
    await prisma.examBlueprint.update({ where: { id: blueprint.id }, data: { status: "ARCHIVED" } });

    const beforeCount = await prisma.examGenerationJob.count({ where: { blueprintId: blueprint.id } });
    await expect(generateExamFromBlueprint(blueprint.id, adminId)).rejects.toBeInstanceOf(GenerationBlockedError);
    const afterCount = await prisma.examGenerationJob.count({ where: { blueprintId: blueprint.id } });
    expect(afterCount).toBe(beforeCount);
  });
});

describe("commitGeneratedExam — atomicity (mục 38)", () => {
  it("nếu tạo ExamQuestion thứ N vi phạm unique constraint → transaction rollback, không có Exam nào sót lại", async () => {
    const topic = await makeTopic("Gen Atomicity");
    const [qa, qb] = await makeQuestions(topic.id, 2);
    const blueprint = await makeBlueprint([{ name: "Section 1", rules: [{ topicId: topic.id, quantity: 2 }] }]);

    const job = await prisma.examGenerationJob.create({
      data: { blueprintId: blueprint.id, mode: "RANDOM", status: "DRAFT", createdById: adminId },
    });
    await prisma.examGenerationItem.create({ data: { jobId: job.id, sequenceNumber: 1, status: "PENDING" } });

    // Cố ý để qa xuất hiện ở CẢ HAI rule result — allSelectedIds vẫn đúng
    // (không trùng, đều ACTIVE thật) nên qua được bước re-check, nhưng vòng
    // lặp tạo ExamQuestion sẽ cố tạo (examId, qa) hai lần → vi phạm
    // @@unique([examId, questionId]) ở lần tạo thứ hai.
    const ruleResults = [
      { ruleId: "r1", sectionName: "S1", ruleSummary: "r1", required: 1, available: 1, selected: 1, missing: 0, questionIds: [qa] },
      { ruleId: "r2", sectionName: "S1", ruleSummary: "r2", required: 1, available: 1, selected: 1, missing: 0, questionIds: [qa, qb] },
    ];

    await expect(
      prisma.$transaction((tx) =>
        commitGeneratedExam(tx, {
          blueprint: { id: blueprint.id, name: blueprint.name, examType: "TEST", subjectId: null, durationMinutes: 60 },
          ruleResults,
          allSelectedIds: [qa, qb],
          jobId: job.id,
          sequenceNumber: 1,
          createdById: adminId,
        }),
      ),
    ).rejects.toThrow();

    const examCount = await prisma.exam.count({ where: { generatedFromBlueprintId: blueprint.id } });
    expect(examCount).toBe(0);
  });
});
