import "server-only";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import type { Attempt } from "@/lib/generated/prisma/client";
import type { Difficulty, QuestionType } from "@/lib/generated/prisma/enums";
import { buildPracticeSnapshot } from "./examSnapshotService";
import { hasSubjectAccess } from "./subjectAccessService";
import { deterministicShuffle } from "./questionMatchingService";
import type { PracticeFilterInput, PracticeStartInput } from "@/validators/practiceAttempt";

/**
 * Không có quyền vào Subject này, hoặc Topic không thuộc Subject đã chọn —
 * gộp chung một lỗi 404-style để không lộ "subject/topic này có tồn tại hay
 * không" cho một id bất kỳ được đoán mò, đúng quy ước đã dùng cho
 * ExamNotAvailableError ở studentAttemptService.ts (Phase 9A/10).
 */
export class PracticeNotAvailableError extends Error {
  constructor() {
    super("Không thể luyện tập với điều kiện đã chọn.");
    this.name = "PracticeNotAvailableError";
  }
}

/** Topic được chọn không thuộc Subject đã chọn — lỗi dữ liệu request (400), đúng quy ước Question Bank Phase 6 ("topic không thuộc subject đã chọn"). */
export class InvalidTopicError extends Error {
  constructor() {
    super("Chủ đề đã chọn không thuộc môn học này.");
    this.name = "InvalidTopicError";
  }
}

export class NoEligibleQuestionsError extends Error {
  constructor() {
    super("Không có câu hỏi phù hợp với điều kiện bạn chọn.");
    this.name = "NoEligibleQuestionsError";
  }
}

interface EligibleWhere {
  status: "ACTIVE";
  subjectId: string;
  topicId?: string;
  difficulty?: Difficulty;
  type?: QuestionType;
}

/**
 * WHERE builder dùng chung cho preview (đếm) và start (chọn câu) — cùng một
 * điều kiện, tách riêng để không lệch nhau giữa "số câu preview thấy" và "số
 * câu thực sự có thể chọn lúc start" (mục 16).
 */
function buildEligibleWhere(input: { subjectId: string; topicId?: string; difficulty?: Difficulty; questionType?: QuestionType }): EligibleWhere {
  return {
    status: "ACTIVE",
    subjectId: input.subjectId,
    ...(input.topicId ? { topicId: input.topicId } : {}),
    ...(input.difficulty ? { difficulty: input.difficulty } : {}),
    ...(input.questionType ? { type: input.questionType } : {}),
  };
}

/**
 * Xác thực Subject (student có quyền) + Topic (thuộc đúng Subject nếu có) —
 * dùng chung cho cả preview lẫn start, KHÔNG tin subjectId/topicId client gửi
 * cho tới khi qua đúng 2 bước kiểm tra này (mục 5/6).
 */
async function assertSubjectAndTopic(
  studentId: string,
  subjectId: string,
  topicId: string | undefined,
): Promise<{ subjectName: string; topicName: string | null }> {
  const allowed = await hasSubjectAccess(studentId, subjectId);
  if (!allowed) throw new PracticeNotAvailableError();

  const subject = await prisma.subject.findUnique({ where: { id: subjectId }, select: { name: true } });
  if (!subject) throw new PracticeNotAvailableError();

  if (!topicId) return { subjectName: subject.name, topicName: null };

  const topic = await prisma.topic.findUnique({ where: { id: topicId }, select: { subjectId: true, name: true } });
  if (!topic || topic.subjectId !== subjectId) throw new InvalidTopicError();

  return { subjectName: subject.name, topicName: topic.name };
}

export interface PracticePreviewResult {
  subjectName: string;
  topicName: string | null;
  eligibleCount: number;
}

/** Xem trước số câu phù hợp — KHÔNG tạo Attempt, KHÔNG tăng usageCount (mục 16/17). */
export async function previewPracticeAvailability(
  studentId: string,
  input: PracticeFilterInput,
): Promise<PracticePreviewResult> {
  const { subjectName, topicName } = await assertSubjectAndTopic(studentId, input.subjectId, input.topicId);

  const eligibleCount = await prisma.question.count({
    where: buildEligibleWhere(input),
  });

  return { subjectName, topicName, eligibleCount };
}

export interface ActivePracticeAttempt {
  id: string;
  title: string;
  totalQuestions: number;
  answeredCount: number;
}

/** Dùng cho trang cấu hình Practice — hiện banner "tiếp tục" thay vì form nếu đã có 1 Attempt PRACTICE đang dở dang (mục 21). */
export async function getActivePracticeAttempt(studentId: string): Promise<ActivePracticeAttempt | null> {
  const attempt = await prisma.attempt.findFirst({
    where: { studentId, mode: "PRACTICE", status: "IN_PROGRESS" },
    orderBy: { attemptNumber: "desc" },
    select: { id: true, examSnapshot: true },
  });
  if (!attempt) return null;

  const snapshot = attempt.examSnapshot as unknown as { title: string; questionCount: number };
  const answeredCount = await prisma.attemptAnswer.count({
    where: { attemptId: attempt.id, answeredAt: { not: null } },
  });

  return {
    id: attempt.id,
    title: snapshot.title,
    totalQuestions: snapshot.questionCount,
    answeredCount,
  };
}

export interface StartPracticeResult {
  attempt: Attempt;
  resumed: boolean;
}

/**
 * Tạo (hoặc resume) một Practice Attempt. Theo đúng thứ tự mục 15:
 * auth đã làm ở route → validate body (đã làm ở validator) → validate
 * Subject → validate SubjectAccess → validate Topic→Subject → query eligible
 * → verify count → random select → build snapshot → create Attempt → lưu
 * selectionParams → trả về.
 *
 * Giả định thiết kế (báo rõ, không tự ý âm thầm quyết định — mục 21/39.25):
 * mỗi Student chỉ có TỐI ĐA 1 Practice Attempt đang IN_PROGRESS tại một thời
 * điểm. Nếu đã có 1 Attempt IN_PROGRESS, gọi start lại (dù điều kiện khác)
 * sẽ trả về đúng Attempt đang dở dang đó (resumed=true) thay vì tạo mới —
 * rập khuôn đúng tinh thần "resume" của startOrResumeAttempt (Mock Exam),
 * áp dụng cho Practice vì @@unique([studentId, examId, attemptNumber]) không
 * bảo vệ được trường hợp examId=null (Postgres coi NULL luôn khác biệt trong
 * unique index, xem báo cáo "Schema gaps" cuối Phase 11).
 */
export async function startPracticeAttempt(studentId: string, input: PracticeStartInput): Promise<StartPracticeResult> {
  const { subjectName, topicName } = await assertSubjectAndTopic(studentId, input.subjectId, input.topicId);

  const existingActive = await prisma.attempt.findFirst({
    where: { studentId, mode: "PRACTICE", status: "IN_PROGRESS" },
    orderBy: { attemptNumber: "desc" },
  });
  if (existingActive) {
    return { attempt: existingActive, resumed: true };
  }

  const where = buildEligibleWhere(input);
  const candidates = await prisma.question.findMany({
    where,
    select: { id: true },
    orderBy: { id: "asc" },
  });
  if (candidates.length === 0) throw new NoEligibleQuestionsError();

  // Random thật (không deterministic/reproducible) mỗi request — seed từ
  // crypto.randomUUID(), tái dùng đúng thuật toán Fisher-Yates + mulberry32
  // đã có ở Phase 8 thay vì viết lại (mục 10/30).
  const shuffledIds = deterministicShuffle(
    candidates.map((c) => c.id),
    crypto.randomUUID(),
  );
  const selectedIds = shuffledIds.slice(0, input.questionCount);

  const questions = await prisma.question.findMany({
    where: { id: { in: selectedIds } },
    select: {
      id: true,
      type: true,
      content: true,
      correctAnswerText: true,
      options: { select: { id: true, label: true, content: true, isCorrect: true, order: true } },
    },
  });
  // Giữ đúng thứ tự đã random (findMany theo `in` không đảm bảo thứ tự) —
  // snapshot đóng băng thứ tự này vĩnh viễn sau khi tạo (mục 12).
  const questionById = new Map(questions.map((q) => [q.id, q]));
  const orderedQuestions = selectedIds.map((id) => questionById.get(id)!);

  const title = topicName ? `Luyện tập — ${subjectName} · ${topicName}` : `Luyện tập — ${subjectName}`;
  const snapshot = buildPracticeSnapshot(orderedQuestions, title);

  const selectionParams: Record<string, unknown> = { subjectId: input.subjectId, questionCount: input.questionCount };
  if (input.topicId) selectionParams.topicId = input.topicId;
  if (input.difficulty) selectionParams.difficulty = input.difficulty;
  if (input.questionType) selectionParams.questionType = input.questionType;

  const attemptsCount = await prisma.attempt.count({ where: { studentId, mode: "PRACTICE" } });

  try {
    const attempt = await prisma.attempt.create({
      data: {
        studentId,
        examId: null,
        mode: "PRACTICE",
        attemptNumber: attemptsCount + 1,
        selectionParams: selectionParams as unknown as Prisma.InputJsonValue,
        examSnapshot: snapshot as unknown as Prisma.InputJsonValue,
        startedAt: new Date(),
        endsAt: null,
        status: "IN_PROGRESS",
      },
    });
    return { attempt, resumed: false };
  } catch {
    // Hai request đồng thời cùng vượt qua kiểm tra "chưa có Attempt đang
    // IN_PROGRESS" ở trên (race — mục 22): không có unique constraint nào
    // bảo vệ được (examId luôn null), nên đọc lại và resume Attempt vừa
    // được request kia tạo, thay vì để tạo trùng 2 Attempt song song hoặc
    // ném lỗi 500. Đây là gap đã được báo trong Completion Report, không tự
    // ý migration để vá (mục 22/31).
    const raceWinner = await prisma.attempt.findFirst({
      where: { studentId, mode: "PRACTICE", status: "IN_PROGRESS" },
      orderBy: { createdAt: "desc" },
    });
    if (raceWinner) return { attempt: raceWinner, resumed: true };
    throw new Error("Không thể tạo bài luyện tập.");
  }
}
