import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { BlueprintStatus } from "@/lib/generated/prisma/enums";
import type { BlueprintInput } from "@/validators/examBlueprint";

export class BlueprintValidationError extends Error {
  fieldErrors: Record<string, string>;
  constructor(fieldErrors: Record<string, string>) {
    super("Dữ liệu Blueprint không hợp lệ.");
    this.name = "BlueprintValidationError";
    this.fieldErrors = fieldErrors;
  }
}

export class BlueprintNotFoundError extends Error {
  constructor() {
    super("Không tìm thấy Blueprint.");
    this.name = "BlueprintNotFoundError";
  }
}

export class BlueprintConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlueprintConflictError";
  }
}

const detailInclude = {
  subject: { select: { id: true, name: true } },
  sections: {
    orderBy: { order: "asc" as const },
    include: {
      rules: {
        orderBy: { order: "asc" as const },
        include: {
          subject: { select: { id: true, name: true } },
          topic: { select: { id: true, name: true } },
        },
      },
    },
  },
  createdBy: { select: { fullName: true } },
  _count: { select: { generationJobs: true, exams: true } },
} satisfies Prisma.ExamBlueprintInclude;

/**
 * Kiểm tra ràng buộc cần DB (không diễn tả được bằng Zod thuần): subject/topic
 * của từng Rule (nếu có) phải thực sự tồn tại, và nếu cả hai cùng chỉ định
 * thì Topic phải thuộc đúng Subject đó (mục 7, tái dùng cùng ngữ nghĩa với
 * assertTopicBelongsToSubject của Phase 6, không duplicate logic — ở đây cần
 * kiểm tra hàng loạt Rule nên viết riêng bằng batch query thay vì gọi lại
 * hàm đơn lẻ của questionService nhiều lần).
 */
async function assertBlueprintReferentialIntegrity(input: BlueprintInput): Promise<void> {
  const errors: Record<string, string> = {};

  if (input.subjectId) {
    const subject = await prisma.subject.findUnique({ where: { id: input.subjectId } });
    if (!subject) errors.subjectId = "Môn học không tồn tại.";
  }

  const subjectIds = new Set<string>();
  const topicIds = new Set<string>();
  for (const section of input.sections) {
    for (const rule of section.rules) {
      if (rule.subjectId) subjectIds.add(rule.subjectId);
      if (rule.topicId) topicIds.add(rule.topicId);
    }
  }

  const [subjects, topics] = await Promise.all([
    subjectIds.size > 0
      ? prisma.subject.findMany({ where: { id: { in: [...subjectIds] } }, select: { id: true } })
      : Promise.resolve([]),
    topicIds.size > 0
      ? prisma.topic.findMany({ where: { id: { in: [...topicIds] } }, select: { id: true, subjectId: true } })
      : Promise.resolve([]),
  ]);
  const validSubjectIds = new Set(subjects.map((s) => s.id));
  const topicById = new Map(topics.map((t) => [t.id, t]));

  input.sections.forEach((section, sIndex) => {
    section.rules.forEach((rule, rIndex) => {
      const prefix = `sections.${sIndex}.rules.${rIndex}`;
      if (rule.subjectId && !validSubjectIds.has(rule.subjectId)) {
        errors[`${prefix}.subjectId`] = "Môn học của Rule này không tồn tại.";
      }
      if (rule.topicId) {
        const topic = topicById.get(rule.topicId);
        if (!topic) {
          errors[`${prefix}.topicId`] = "Chủ đề của Rule này không tồn tại.";
        } else if (rule.subjectId && topic.subjectId !== rule.subjectId) {
          errors[`${prefix}.topicId`] = "Chủ đề không thuộc môn học đã chọn ở Rule này.";
        }
      }
    });
  });

  if (Object.keys(errors).length > 0) {
    throw new BlueprintValidationError(errors);
  }
}

/**
 * Section.questionCount và Blueprint.totalQuestions luôn được tính lại từ
 * tổng quantity của các Rule — không bao giờ trust số này từ client, tránh
 * lệch giữa số hiển thị và số Rule thực tế (mục 22/29).
 */
function sectionsWriteData(input: BlueprintInput) {
  return input.sections.map((section, sectionIndex) => {
    const questionCount = section.rules.reduce((sum, r) => sum + r.quantity, 0);
    return {
      name: section.name,
      order: sectionIndex,
      questionCount,
      rules: {
        create: section.rules.map((rule, ruleIndex) => ({
          subjectId: rule.subjectId ?? null,
          topicId: rule.topicId ?? null,
          questionType: rule.questionType ?? null,
          difficulty: rule.difficulty ?? null,
          cognitiveLevel: rule.cognitiveLevel ?? null,
          year: rule.year ?? null,
          source: rule.source ?? null,
          requiredTags: rule.requiredTags,
          quantity: rule.quantity,
          order: ruleIndex,
        })),
      },
    };
  });
}

function totalQuestionsOf(input: BlueprintInput): number {
  return input.sections.reduce((sum, s) => sum + s.rules.reduce((rs, r) => rs + r.quantity, 0), 0);
}

export async function listBlueprints() {
  return prisma.examBlueprint.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      subject: { select: { id: true, name: true } },
      _count: { select: { sections: true, exams: true } },
    },
  });
}

export async function getBlueprintDetail(id: string) {
  return prisma.examBlueprint.findUnique({ where: { id }, include: detailInclude });
}

export type BlueprintDetail = NonNullable<Awaited<ReturnType<typeof getBlueprintDetail>>>;

export async function createBlueprint(input: BlueprintInput, createdById: string) {
  await assertBlueprintReferentialIntegrity(input);

  return prisma.examBlueprint.create({
    data: {
      name: input.name,
      examType: input.examType,
      subjectId: input.subjectId ?? null,
      durationMinutes: input.durationMinutes,
      totalQuestions: totalQuestionsOf(input),
      createdById,
      sections: { create: sectionsWriteData(input) },
    },
    include: detailInclude,
  });
}

export async function updateBlueprint(id: string, input: BlueprintInput) {
  const existing = await prisma.examBlueprint.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!existing) throw new BlueprintNotFoundError();
  if (existing.status === "ARCHIVED") {
    throw new BlueprintConflictError("Blueprint đã lưu trữ — không thể chỉnh sửa.");
  }

  await assertBlueprintReferentialIntegrity(input);

  // Không có gì tham chiếu tới BlueprintSection/BlueprintRule.id (Exam đã
  // sinh ra chỉ giữ Question/ExamQuestion độc lập, không tham chiếu ngược
  // Rule — mục 35), nên xoá hết rồi tạo lại là an toàn và đơn giản hơn nhiều
  // so với thuật toán đồng bộ id-theo-id như QuestionOption ở Phase 6.
  return prisma.$transaction(async (tx) => {
    await tx.blueprintSection.deleteMany({ where: { blueprintId: id } });
    return tx.examBlueprint.update({
      where: { id },
      data: {
        name: input.name,
        examType: input.examType,
        subjectId: input.subjectId ?? null,
        durationMinutes: input.durationMinutes,
        totalQuestions: totalQuestionsOf(input),
        sections: { create: sectionsWriteData(input) },
      },
      include: detailInclude,
    });
  });
}

export async function setBlueprintStatus(id: string, status: BlueprintStatus) {
  const existing = await prisma.examBlueprint.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new BlueprintNotFoundError();
  return prisma.examBlueprint.update({ where: { id }, data: { status } });
}

/** Chỉ hard-delete khi chưa từng được dùng để sinh đề — FK trên ExamGenerationJob.blueprintId là Restrict nên Postgres cũng sẽ chặn, nhưng chặn sớm ở đây để trả lỗi tiếng Việt rõ ràng thay vì lỗi Prisma thô. */
export async function deleteBlueprint(id: string) {
  const existing = await prisma.examBlueprint.findUnique({
    where: { id },
    select: { id: true, _count: { select: { generationJobs: true } } },
  });
  if (!existing) throw new BlueprintNotFoundError();
  if (existing._count.generationJobs > 0) {
    throw new BlueprintConflictError(
      "Blueprint đã được dùng để sinh đề — chỉ có thể lưu trữ, không thể xoá.",
    );
  }
  await prisma.examBlueprint.delete({ where: { id } });
}
