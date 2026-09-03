import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import { DIFFICULTY_LABELS, QUESTION_TYPE_LABELS } from "@/lib/constants/question-bank";
import { deterministicShuffle } from "./questionMatchingService";
import { BlueprintNotFoundError, type BlueprintDetail } from "./blueprintService";

export class GenerationBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenerationBlockedError";
  }
}

export interface RuleResult {
  ruleId: string;
  sectionName: string;
  ruleSummary: string;
  required: number;
  available: number;
  selected: number;
  missing: number;
  questionIds: string[];
}

export class GenerationInsufficientError extends Error {
  constructor(
    public readonly jobId: string,
    public readonly ruleResults: RuleResult[],
  ) {
    const insufficient = ruleResults.filter((r) => r.missing > 0);
    const detail = insufficient
      .map((r) => `"${r.ruleSummary}" cần ${r.required} câu nhưng chỉ có ${r.available} câu phù hợp`)
      .join("; ");
    super(`Không thể sinh đề vì Rule ${detail}.`);
    this.name = "GenerationInsufficientError";
  }
}

export class StaleCandidateError extends Error {
  constructor() {
    super(
      "Một số câu hỏi đã thay đổi trạng thái trong lúc sinh đề (có thể vừa bị lưu trữ). Vui lòng thử lại.",
    );
    this.name = "StaleCandidateError";
  }
}

type RuleForQuery = BlueprintDetail["sections"][number]["rules"][number];

function ruleSummary(rule: RuleForQuery): string {
  const parts = [
    rule.subject?.name,
    rule.topic?.name,
    rule.difficulty ? DIFFICULTY_LABELS[rule.difficulty] : null,
    rule.questionType ? QUESTION_TYPE_LABELS[rule.questionType] : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : "Không giới hạn";
}

/**
 * Xây where clause Prisma cho một Rule — field không chỉ định (null) thì
 * không đưa vào where (mục 9). exclude dùng để loại các Question đã được
 * Rule trước đó trong cùng lượt sinh đề chọn rồi (mục 11 — chống trùng lặp
 * trong cùng một Exam). Chỉ query id, không tải toàn bộ cột (mục 43).
 */
function buildRuleWhere(rule: RuleForQuery, excludeIds: readonly string[]): Prisma.QuestionWhereInput {
  return {
    status: "ACTIVE",
    ...(rule.subjectId ? { subjectId: rule.subjectId } : {}),
    ...(rule.topicId ? { topicId: rule.topicId } : {}),
    ...(rule.questionType ? { type: rule.questionType } : {}),
    ...(rule.difficulty ? { difficulty: rule.difficulty } : {}),
    ...(rule.cognitiveLevel ? { cognitiveLevel: rule.cognitiveLevel } : {}),
    ...(rule.year ? { year: rule.year } : {}),
    ...(rule.source ? { source: rule.source } : {}),
    ...(rule.requiredTags.length > 0 ? { tags: { hasEvery: rule.requiredTags } } : {}),
    ...(excludeIds.length > 0 ? { id: { notIn: [...excludeIds] } } : {}),
  };
}

async function loadBlueprintForGeneration(blueprintId: string): Promise<BlueprintDetail> {
  const blueprint = await prisma.examBlueprint.findUnique({
    where: { id: blueprintId },
    include: {
      subject: { select: { id: true, name: true } },
      sections: {
        orderBy: { order: "asc" },
        include: {
          rules: {
            orderBy: { order: "asc" },
            include: {
              subject: { select: { id: true, name: true } },
              topic: { select: { id: true, name: true } },
            },
          },
        },
      },
      createdBy: { select: { fullName: true } },
      _count: { select: { generationJobs: true, exams: true } },
    },
  });
  if (!blueprint) throw new BlueprintNotFoundError();
  return blueprint;
}

/**
 * Tính khả dụng candidate cho từng Rule mà KHÔNG chọn/khấu trừ chéo giữa các
 * Rule (mục 22/23) — đây là con số khả dụng độc lập của từng Rule để Admin
 * ước lượng trước khi sinh đề, không mô phỏng chính xác kết quả dedup cuối
 * cùng (vì dedup phụ thuộc thứ tự chọn thực tế). Không mutate gì — chỉ đọc.
 */
export async function previewBlueprint(blueprintId: string) {
  const blueprint = await loadBlueprintForGeneration(blueprintId);

  const sections = await Promise.all(
    blueprint.sections.map(async (section) => {
      const rules = await Promise.all(
        section.rules.map(async (rule) => {
          const available = await prisma.question.count({ where: buildRuleWhere(rule, []) });
          return {
            ruleId: rule.id,
            summary: ruleSummary(rule),
            required: rule.quantity,
            available,
            status: available >= rule.quantity ? ("OK" as const) : ("THIEU" as const),
          };
        }),
      );
      return { sectionId: section.id, name: section.name, questionCount: section.questionCount, rules };
    }),
  );

  return {
    blueprintId: blueprint.id,
    name: blueprint.name,
    totalQuestions: blueprint.totalQuestions,
    sections,
    hasShortage: sections.some((s) => s.rules.some((r) => r.status === "THIEU")),
  };
}

/**
 * Bước 3b (bên trong transaction): tạo Exam + ExamQuestion + đóng
 * GenerationItem/Job — tách thành hàm riêng (thay vì inline) để test được
 * trực tiếp tính atomic của transaction (mục 38): truyền ruleResults có
 * chứa id trùng lặp để cố ý vi phạm unique constraint (examId, questionId)
 * giữa chừng vòng lặp tạo ExamQuestion, rồi assert không có Exam nào sót
 * lại sau khi transaction rollback.
 */
export async function commitGeneratedExam(
  tx: Prisma.TransactionClient,
  params: {
    blueprint: { id: string; name: string; examType: string; subjectId: string | null; durationMinutes: number };
    ruleResults: RuleResult[];
    allSelectedIds: string[];
    jobId: string;
    sequenceNumber: number;
    createdById: string;
  },
) {
  const stillActive = await tx.question.findMany({
    where: { id: { in: params.allSelectedIds }, status: "ACTIVE" },
    select: { id: true },
  });
  if (stillActive.length !== params.allSelectedIds.length) {
    throw new StaleCandidateError();
  }

  const exam = await tx.exam.create({
    data: {
      title: params.blueprint.name,
      code: `GEN-${params.jobId.slice(0, 8)}-${params.sequenceNumber}`,
      examType: params.blueprint.examType,
      subjectId: params.blueprint.subjectId,
      durationMinutes: params.blueprint.durationMinutes,
      questionCount: params.allSelectedIds.length,
      difficulty: "MIXED",
      status: "DRAFT",
      generatedFromBlueprintId: params.blueprint.id,
      createdById: params.createdById,
    },
  });

  let order = 1;
  for (const rule of params.ruleResults) {
    for (const questionId of rule.questionIds) {
      await tx.examQuestion.create({ data: { examId: exam.id, questionId, order: order++ } });
    }
  }

  await tx.examGenerationItem.update({
    where: { jobId_sequenceNumber: { jobId: params.jobId, sequenceNumber: params.sequenceNumber } },
    data: {
      status: "CONFIRMED",
      resultingExamId: exam.id,
      selectedQuestions: params.allSelectedIds,
      distributionSummary: params.ruleResults as unknown as Prisma.InputJsonValue,
    },
  });
  await tx.examGenerationJob.update({
    where: { id: params.jobId },
    data: { status: "CONFIRMED", confirmedAt: new Date() },
  });

  return exam;
}

/**
 * Luồng sinh đề đầy đủ (mục 16). Chia làm 3 pha để vừa đảm bảo Job/Item luôn
 * được ghi nhận (kể cả khi FAILED, để Admin xem lại lý do) vừa đảm bảo phần
 * tạo Exam+ExamQuestion là one-shot transactional (mục 15/38):
 *   Pha 1 — tạo Job (DRAFT) + Item (PENDING), commit ngay.
 *   Pha 2 — đọc candidate theo từng Rule (không transaction, chỉ đọc), chọn
 *     bằng deterministicShuffle theo seed = `${jobId}:${sequenceNumber}:${ruleId}`.
 *   Pha 3 — nếu thiếu câu ở bất kỳ Rule nào: đóng Job=FAILED,
 *     Item=INSUFFICIENT kèm distributionSummary, KHÔNG tạo Exam. Nếu đủ:
 *     transaction tạo Exam+ExamQuestion+đóng Job=CONFIRMED — re-check
 *     status=ACTIVE của toàn bộ câu đã chọn ngay trong transaction để chặn
 *     race condition (mục 32: Admin khác archive câu hỏi giữa lúc đang sinh).
 */
export async function generateExamFromBlueprint(blueprintId: string, createdById: string) {
  const blueprint = await loadBlueprintForGeneration(blueprintId);
  if (blueprint.status === "ARCHIVED") {
    throw new GenerationBlockedError("Blueprint đã lưu trữ — không thể dùng để sinh đề.");
  }
  if (!blueprint.durationMinutes) {
    throw new GenerationBlockedError("Blueprint chưa có Thời lượng — vui lòng sửa Blueprint trước khi sinh đề.");
  }
  const durationMinutes = blueprint.durationMinutes;

  const job = await prisma.$transaction(async (tx) => {
    const createdJob = await tx.examGenerationJob.create({
      data: {
        blueprintId: blueprint.id,
        mode: "RANDOM",
        requestedExamCount: 1,
        status: "DRAFT",
        createdById,
      },
    });
    await tx.examGenerationItem.create({
      data: { jobId: createdJob.id, sequenceNumber: 1, status: "PENDING" },
    });
    return createdJob;
  });

  const sequenceNumber = 1;
  const seed = `${job.id}:${sequenceNumber}`;
  const selectedIds = new Set<string>();
  const ruleResults: RuleResult[] = [];

  for (const section of blueprint.sections) {
    for (const rule of section.rules) {
      const candidates = await prisma.question.findMany({
        where: buildRuleWhere(rule, [...selectedIds]),
        select: { id: true },
        orderBy: { id: "asc" },
      });
      const shuffled = deterministicShuffle(
        candidates.map((c) => c.id),
        `${seed}:${rule.id}`,
      );
      const chosen = shuffled.slice(0, rule.quantity);
      chosen.forEach((id) => selectedIds.add(id));
      ruleResults.push({
        ruleId: rule.id,
        sectionName: section.name,
        ruleSummary: ruleSummary(rule),
        required: rule.quantity,
        available: candidates.length,
        selected: chosen.length,
        missing: Math.max(0, rule.quantity - chosen.length),
        questionIds: chosen,
      });
    }
  }

  const isInsufficient = ruleResults.some((r) => r.missing > 0);
  if (isInsufficient) {
    await prisma.$transaction([
      prisma.examGenerationItem.update({
        where: { jobId_sequenceNumber: { jobId: job.id, sequenceNumber } },
        data: {
          status: "INSUFFICIENT",
          distributionSummary: ruleResults as unknown as Prisma.InputJsonValue,
        },
      }),
      prisma.examGenerationJob.update({ where: { id: job.id }, data: { status: "FAILED" } }),
    ]);
    throw new GenerationInsufficientError(job.id, ruleResults);
  }

  const allSelectedIds = [...selectedIds];
  try {
    const exam = await prisma.$transaction((tx) =>
      commitGeneratedExam(tx, {
        blueprint: {
          id: blueprint.id,
          name: blueprint.name,
          examType: blueprint.examType,
          subjectId: blueprint.subjectId,
          durationMinutes,
        },
        ruleResults,
        allSelectedIds,
        jobId: job.id,
        sequenceNumber,
        createdById,
      }),
    );
    return { job, exam };
  } catch (error) {
    await prisma.$transaction([
      prisma.examGenerationItem.update({
        where: { jobId_sequenceNumber: { jobId: job.id, sequenceNumber } },
        data: {
          status: "INSUFFICIENT",
          distributionSummary: ruleResults as unknown as Prisma.InputJsonValue,
        },
      }),
      prisma.examGenerationJob.update({ where: { id: job.id }, data: { status: "FAILED" } }),
    ]);
    if (error instanceof StaleCandidateError) throw error;
    throw error;
  }
}

export async function getGenerationJobDetail(jobId: string) {
  return prisma.examGenerationJob.findUnique({
    where: { id: jobId },
    include: {
      blueprint: { select: { id: true, name: true } },
      items: {
        orderBy: { sequenceNumber: "asc" },
        include: { resultingExam: { select: { id: true, title: true, status: true } } },
      },
    },
  });
}
