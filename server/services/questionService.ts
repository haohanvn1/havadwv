import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import { optionLabelForIndex, type SortOption } from "@/lib/constants/question-bank";
import type { QuestionInput, QuestionListParams } from "@/validators/question";

export class QuestionValidationError extends Error {
  fieldErrors: Record<string, string>;
  constructor(fieldErrors: Record<string, string>) {
    super("Dữ liệu câu hỏi không hợp lệ.");
    this.name = "QuestionValidationError";
    this.fieldErrors = fieldErrors;
  }
}

export class QuestionNotFoundError extends Error {
  constructor() {
    super("Không tìm thấy câu hỏi.");
    this.name = "QuestionNotFoundError";
  }
}

export class QuestionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuestionConflictError";
  }
}

const listSelect = {
  id: true,
  content: true,
  type: true,
  difficulty: true,
  status: true,
  source: true,
  year: true,
  cognitiveLevel: true,
  createdAt: true,
  updatedAt: true,
  subject: { select: { id: true, name: true } },
  topic: { select: { id: true, name: true } },
  _count: { select: { examQuestions: true } },
} as const;

function sortToOrderBy(sort: SortOption) {
  switch (sort) {
    case "createdAt_asc":
      return { createdAt: "asc" as const };
    case "updatedAt_desc":
      return { updatedAt: "desc" as const };
    case "difficulty_asc":
      return { difficulty: "asc" as const };
    case "difficulty_desc":
      return { difficulty: "desc" as const };
    case "year_desc":
      return { year: "desc" as const };
    case "year_asc":
      return { year: "asc" as const };
    case "createdAt_desc":
    default:
      return { createdAt: "desc" as const };
  }
}

/** Lọc/tìm/sắp xếp hoàn toàn ở server (Postgres) — không tải toàn bộ bảng về rồi lọc bằng JS. */
export async function listQuestions(params: QuestionListParams) {
  const where: Record<string, unknown> = {};

  if (params.subjectId) where.subjectId = params.subjectId;
  if (params.topicId) where.topicId = params.topicId;
  if (params.type) where.type = params.type;
  if (params.difficulty) where.difficulty = params.difficulty;
  if (params.cognitiveLevel) where.cognitiveLevel = params.cognitiveLevel;
  if (params.status) where.status = params.status;
  if (params.year) where.year = params.year;

  if (params.search) {
    where.OR = [
      { content: { contains: params.search, mode: "insensitive" } },
      { source: { contains: params.search, mode: "insensitive" } },
      { tags: { has: params.search } },
    ];
  }

  const [total, questions] = await Promise.all([
    prisma.question.count({ where }),
    prisma.question.findMany({
      where,
      select: listSelect,
      orderBy: sortToOrderBy(params.sort),
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
  ]);

  return {
    questions: questions.map((q) => ({ ...q, usedInExamCount: q._count.examQuestions })),
    total,
    page: params.page,
    pageSize: params.pageSize,
    totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}

export async function getQuestionDetail(id: string) {
  const question = await prisma.question.findUnique({
    where: { id },
    include: {
      subject: { select: { id: true, name: true } },
      topic: { select: { id: true, name: true, subjectId: true } },
      options: { orderBy: { order: "asc" } },
      _count: { select: { examQuestions: true } },
    },
  });
  if (!question) return null;
  return { ...question, usedInExamCount: question._count.examQuestions };
}

export type QuestionDetail = NonNullable<Awaited<ReturnType<typeof getQuestionDetail>>>;

/**
 * Options gửi lên chỉ có `content` + `isCorrect` — label (A/B/C...) và order
 * luôn do server tự sinh theo vị trí trong mảng, không tin label từ client.
 * TRUE_FALSE tự sinh đúng 2 option "Đúng"/"Sai"; SHORT_ANSWER không có option.
 */
function buildOptionsPlan(input: QuestionInput) {
  if (input.type === "SINGLE_CHOICE" || input.type === "MULTIPLE_CHOICE") {
    return input.options.map((opt, index) => ({
      id: opt.id,
      label: optionLabelForIndex(index),
      content: opt.content,
      isCorrect: opt.isCorrect,
      order: index,
    }));
  }
  if (input.type === "TRUE_FALSE") {
    return [
      { id: undefined, label: "A", content: "Đúng", isCorrect: input.trueFalseAnswer === "TRUE", order: 0 },
      { id: undefined, label: "B", content: "Sai", isCorrect: input.trueFalseAnswer === "FALSE", order: 1 },
    ];
  }
  return [];
}

async function assertTopicBelongsToSubject(topicId: string, subjectId: string) {
  const topic = await prisma.topic.findUnique({ where: { id: topicId } });
  if (!topic || topic.subjectId !== subjectId) {
    throw new QuestionValidationError({ topicId: "Chủ đề không thuộc môn học đã chọn." });
  }
}

function questionWriteData(input: QuestionInput) {
  return {
    content: input.content,
    type: input.type,
    correctAnswerText: input.type === "SHORT_ANSWER" ? (input.correctAnswerText ?? null) : null,
    difficulty: input.difficulty,
    subjectId: input.subjectId,
    topicId: input.topicId,
    source: input.source ?? null,
    year: input.year ?? null,
    hint: input.hint ?? null,
    explanation: input.explanation ?? null,
    status: input.status,
    tags: input.tags,
    cognitiveLevel: input.cognitiveLevel ?? null,
  };
}

export async function createQuestion(input: QuestionInput, createdById: string | null) {
  await assertTopicBelongsToSubject(input.topicId, input.subjectId);
  const optionsPlan = buildOptionsPlan(input);

  return prisma.question.create({
    data: {
      ...questionWriteData(input),
      createdById,
      options: {
        create: optionsPlan.map(({ label, content, isCorrect, order }) => ({
          label,
          content,
          isCorrect,
          order,
        })),
      },
    },
    include: { options: { orderBy: { order: "asc" } } },
  });
}

/**
 * Đồng bộ danh sách option theo đúng id hiện có khi có thể (thay vì xoá hết
 * rồi tạo lại) — Question có thể đã được dùng trong Exam, và
 * AttemptAnswer.selectedOptionIds tham chiếu trực tiếp QuestionOption.id, nên
 * giữ nguyên id của option được sửa (chỉ đổi label/content/order) giúp không
 * phá vỡ liên kết của các Attempt cũ đã ghi nhận lựa chọn theo id đó.
 *
 * Cập nhật label theo 2 bước (tạm rồi mới gán thật) để tránh đụng unique
 * constraint (questionId, label) khi thứ tự option bị hoán đổi giữa chừng
 * transaction (vd A↔B đổi chỗ cho nhau).
 */
async function syncOptions(
  tx: Prisma.TransactionClient,
  questionId: string,
  input: QuestionInput,
) {
  const plan = buildOptionsPlan(input);
  const existing = await tx.questionOption.findMany({ where: { questionId } });
  const existingIds = new Set(existing.map((o) => o.id));

  const toUpdate = plan.filter((p) => p.id && existingIds.has(p.id));
  const toCreate = plan.filter((p) => !p.id || !existingIds.has(p.id));
  const keepIds = new Set(toUpdate.map((p) => p.id));
  const toDeleteIds = existing.filter((o) => !keepIds.has(o.id)).map((o) => o.id);

  if (toDeleteIds.length > 0) {
    await tx.questionOption.deleteMany({ where: { id: { in: toDeleteIds } } });
  }

  for (const [index, opt] of toUpdate.entries()) {
    await tx.questionOption.update({
      where: { id: opt.id! },
      data: { label: `__tmp_${index}` },
    });
  }
  for (const opt of toUpdate) {
    await tx.questionOption.update({
      where: { id: opt.id! },
      data: { label: opt.label, content: opt.content, isCorrect: opt.isCorrect, order: opt.order },
    });
  }

  for (const opt of toCreate) {
    await tx.questionOption.create({
      data: {
        questionId,
        label: opt.label,
        content: opt.content,
        isCorrect: opt.isCorrect,
        order: opt.order,
      },
    });
  }
}

export async function updateQuestion(id: string, input: QuestionInput) {
  const existing = await prisma.question.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new QuestionNotFoundError();

  await assertTopicBelongsToSubject(input.topicId, input.subjectId);

  return prisma.$transaction(async (tx) => {
    await syncOptions(tx, id, input);
    return tx.question.update({
      where: { id },
      data: questionWriteData(input),
      include: { options: { orderBy: { order: "asc" } } },
    });
  });
}

/** Đổi status độc lập (dùng cho action "Lưu trữ" nhanh từ danh sách, không cần mở form sửa đầy đủ). */
export async function setQuestionStatus(id: string, status: "DRAFT" | "ACTIVE" | "ARCHIVED") {
  const existing = await prisma.question.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new QuestionNotFoundError();
  return prisma.question.update({ where: { id }, data: { status } });
}

/** Hard delete chỉ khi câu hỏi chưa từng được dùng trong đề nào — bảo toàn lịch sử/referential integrity. */
export async function deleteQuestion(id: string) {
  const existing = await prisma.question.findUnique({
    where: { id },
    select: { id: true, _count: { select: { examQuestions: true } } },
  });
  if (!existing) throw new QuestionNotFoundError();

  if (existing._count.examQuestions > 0) {
    throw new QuestionConflictError(
      "Câu hỏi đã được sử dụng trong ít nhất một đề thi — chỉ có thể lưu trữ, không thể xoá.",
    );
  }

  await prisma.question.delete({ where: { id } });
}

export async function listSubjectsForForm() {
  return prisma.subject.findMany({
    select: { id: true, name: true },
    orderBy: { order: "asc" },
  });
}

export async function listTopicsForSubject(subjectId: string) {
  return prisma.topic.findMany({
    where: { subjectId },
    select: { id: true, name: true },
    orderBy: { order: "asc" },
  });
}
