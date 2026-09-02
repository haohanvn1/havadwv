import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import type { Attempt } from "@/lib/generated/prisma/client";
import type { AttemptStatus } from "@/lib/generated/prisma/enums";
import {
  buildExamSnapshot,
  parseExamSnapshot,
  sanitizeSnapshotForStudent,
  ExamNotFoundError,
  type SnapshotQuestion,
} from "./examSnapshotService";
import { validateAnswerPayload } from "@/validators/attemptAnswer";
import { computeMaxScore, scoreAndPersistIfNeeded, scoreAttempt, type AnswerLike } from "./scoringService";
import { getAccessibleSubjectIds, hasSubjectAccess } from "./subjectAccessService";

export { ExamNotFoundError };

/** Chưa nộp bài (còn IN_PROGRESS) — chưa có kết quả để xem (mục 18 Phase 9B). */
export class AttemptNotSubmittedError extends Error {
  constructor() {
    super("Bài làm chưa được nộp — chưa có kết quả.");
    this.name = "AttemptNotSubmittedError";
  }
}

export class ExamNotAvailableError extends Error {
  constructor() {
    super("Đề thi hiện không khả dụng.");
    this.name = "ExamNotAvailableError";
  }
}

export class MaxAttemptsReachedError extends Error {
  constructor(public readonly maxAttempts: number) {
    super(`Bạn đã dùng hết số lần làm bài cho phép (tối đa ${maxAttempts} lần).`);
    this.name = "MaxAttemptsReachedError";
  }
}

export class AttemptNotFoundError extends Error {
  constructor() {
    super("Không tìm thấy bài làm.");
    this.name = "AttemptNotFoundError";
  }
}

/** Attempt đã SUBMITTED/AUTO_SUBMITTED — không cho sửa câu trả lời hoặc submit lại. */
export class AttemptClosedError extends Error {
  constructor() {
    super("Bài làm đã được nộp — không thể thay đổi câu trả lời.");
    this.name = "AttemptClosedError";
  }
}

export class QuestionNotInAttemptError extends Error {
  constructor() {
    super("Câu hỏi này không thuộc bài làm hiện tại.");
    this.name = "QuestionNotInAttemptError";
  }
}

export class AnswerValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnswerValidationError";
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * Attempt đang IN_PROGRESS nhưng đã qua deadline → tự chuyển AUTO_SUBMITTED
 * (lazy finalize, không cần background worker — mục 14). Dùng updateMany với
 * điều kiện status=IN_PROGRESS trong WHERE để tự nhiên an toàn trước race
 * (hai request cùng lúc phát hiện hết hạn): chỉ một request thực sự update
 * được hàng, request còn lại affected=0 nhưng cả hai đều đọc lại cùng một
 * kết quả cuối cùng — không throw, không lỗi bất thường.
 */
async function finalizeIfExpired<T extends { id: string; status: AttemptStatus; endsAt: Date | null }>(
  attempt: T,
): Promise<T> {
  if (attempt.status !== "IN_PROGRESS" || !attempt.endsAt || attempt.endsAt.getTime() > Date.now()) {
    return attempt;
  }
  const result = await prisma.attempt.updateMany({
    where: { id: attempt.id, status: "IN_PROGRESS" },
    data: { status: "AUTO_SUBMITTED", submittedAt: new Date() },
  });
  // Chỉ request THỰC SỰ thực hiện được transition (count===1) mới kích hoạt
  // chấm điểm — tránh 2 request cùng lúc phát hiện hết hạn đều gọi scoring
  // (dù bản thân scoreAndPersistIfNeeded cũng tự idempotent ở tầng DB, chặn
  // sớm ở đây để không tốn một lượt đọc/tính toán thừa).
  if (result.count === 1) {
    await scoreAndPersistIfNeeded(attempt.id).catch((error) =>
      console.error(`[finalizeIfExpired] Lỗi khi chấm điểm attempt ${attempt.id}`, error),
    );
  }
  const core = await prisma.attempt.findUniqueOrThrow({
    where: { id: attempt.id },
    select: { status: true, submittedAt: true, updatedAt: true },
  });
  return { ...attempt, ...core };
}

async function loadOwnedAttempt(studentId: string, attemptId: string) {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: { exam: { select: { id: true, title: true, examType: true } } },
  });
  // Không tồn tại HOẶC thuộc Student khác đều trả 404 như nhau (không phân
  // biệt) — tránh lộ thông tin "attempt này có tồn tại nhưng không phải của
  // bạn" cho một id bất kỳ được đoán mò (mục 6 — resource enumeration).
  if (!attempt || attempt.studentId !== studentId) {
    throw new AttemptNotFoundError();
  }
  return attempt;
}

// ---------- Danh sách đề Published cho Student ----------

export interface AvailableExamForStudent {
  id: string;
  title: string;
  examType: string;
  subjectName: string | null;
  questionCount: number;
  durationMinutes: number;
  maxAttempts: number | null;
  attemptsUsed: number;
  activeAttemptId: string | null;
  canStart: boolean;
}

function toAvailableExam(exam: {
  id: string;
  title: string;
  examType: string;
  questionCount: number;
  durationMinutes: number;
  maxAttempts: number | null;
  subject: { name: string } | null;
  attempts: { id: string; status: AttemptStatus }[];
}): AvailableExamForStudent {
  const nonAbandoned = exam.attempts.filter((a) => a.status !== "ABANDONED");
  const active = exam.attempts.find((a) => a.status === "IN_PROGRESS") ?? null;
  const reachedMax = exam.maxAttempts != null && nonAbandoned.length >= exam.maxAttempts;
  return {
    id: exam.id,
    title: exam.title,
    examType: exam.examType,
    subjectName: exam.subject?.name ?? null,
    questionCount: exam.questionCount,
    durationMinutes: exam.durationMinutes,
    maxAttempts: exam.maxAttempts,
    attemptsUsed: nonAbandoned.length,
    activeAttemptId: active?.id ?? null,
    canStart: Boolean(active) || !reachedMax,
  };
}

/**
 * Đề không gắn subjectId (null) coi là nội dung "không giới hạn môn", hiển
 * thị công khai cho mọi học sinh — chỉ đề có subjectId mới bị lọc theo
 * SubjectAccess (allow-list nghiêm ngặt, Phase 10).
 */
export async function listAvailableExamsForStudent(studentId: string): Promise<AvailableExamForStudent[]> {
  const accessibleSubjectIds = await getAccessibleSubjectIds(studentId);
  const exams = await prisma.exam.findMany({
    where: {
      status: "PUBLISHED",
      OR: [{ subjectId: null }, { subjectId: { in: accessibleSubjectIds } }],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      examType: true,
      questionCount: true,
      durationMinutes: true,
      maxAttempts: true,
      subject: { select: { name: true } },
      attempts: { where: { studentId }, select: { id: true, status: true } },
    },
  });
  return exams.map(toAvailableExam);
}

/** Danh sách Exam PUBLISHED thuộc 1 Subject cụ thể — dùng cho trang chi tiết "Bộ đề". */
export async function listExamsForSubject(
  studentId: string,
  subjectId: string,
): Promise<AvailableExamForStudent[]> {
  const allowed = await hasSubjectAccess(studentId, subjectId);
  if (!allowed) throw new ExamNotAvailableError();

  const exams = await prisma.exam.findMany({
    where: { status: "PUBLISHED", subjectId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      examType: true,
      questionCount: true,
      durationMinutes: true,
      maxAttempts: true,
      subject: { select: { name: true } },
      attempts: { where: { studentId }, select: { id: true, status: true } },
    },
  });
  return exams.map(toAvailableExam);
}

/** Chi tiết 1 Exam cho Student — null nếu không tồn tại, chưa PUBLISHED, hoặc học sinh chưa được cấp quyền môn của đề (tránh lộ Exam DRAFT/ARCHIVED/không có quyền qua route chi tiết). */
export async function getExamAvailabilityForStudent(
  studentId: string,
  examId: string,
): Promise<AvailableExamForStudent | null> {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: {
      id: true,
      title: true,
      examType: true,
      questionCount: true,
      durationMinutes: true,
      maxAttempts: true,
      status: true,
      subjectId: true,
      subject: { select: { name: true } },
      attempts: { where: { studentId }, select: { id: true, status: true } },
    },
  });
  if (!exam || exam.status !== "PUBLISHED") return null;
  if (exam.subjectId !== null && !(await hasSubjectAccess(studentId, exam.subjectId))) return null;
  return toAvailableExam(exam);
}

// ---------- Start / Resume Attempt ----------

export interface StartAttemptResult {
  attempt: Attempt;
  resumed: boolean;
}

/**
 * Start Attempt — race-safe bằng chính unique constraint đã có sẵn trên
 * (studentId, examId, attemptNumber) thay vì chỉ dựa vào findFirst() rồi
 * create() (mục 11): nếu hai request đồng thời cùng tính ra cùng
 * attemptNumber tiếp theo, request thua sẽ nhận lỗi unique-constraint (P2002)
 * từ Postgres — bắt lỗi đó, đọc lại Attempt IN_PROGRESS vừa được request kia
 * tạo thành công, và trả về như một lượt "resume" thay vì lỗi 500. Không có
 * thời điểm nào tồn tại 2 Attempt IN_PROGRESS cho cùng (student, exam).
 */
export async function startOrResumeAttempt(studentId: string, examId: string): Promise<StartAttemptResult> {
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam) throw new ExamNotFoundError();
  if (exam.status !== "PUBLISHED") throw new ExamNotAvailableError();
  if (exam.subjectId !== null && !(await hasSubjectAccess(studentId, exam.subjectId))) {
    throw new ExamNotAvailableError();
  }

  const existingActive = await prisma.attempt.findFirst({
    where: { studentId, examId, status: "IN_PROGRESS" },
    orderBy: { attemptNumber: "desc" },
  });
  if (existingActive) {
    const fresh = await finalizeIfExpired(existingActive);
    if (fresh.status === "IN_PROGRESS") {
      return { attempt: fresh, resumed: true };
    }
    // Vừa hết hạn và bị auto-submit ở trên — rơi xuống dưới để kiểm tra
    // maxAttempts và có thể tạo Attempt mới nếu Student còn lượt.
  }

  const attemptsCount = await prisma.attempt.count({
    where: { studentId, examId, status: { not: "ABANDONED" } },
  });
  if (exam.maxAttempts != null && attemptsCount >= exam.maxAttempts) {
    throw new MaxAttemptsReachedError(exam.maxAttempts);
  }

  const lastNumber = await prisma.attempt.aggregate({
    where: { studentId, examId },
    _max: { attemptNumber: true },
  });
  const nextNumber = (lastNumber._max.attemptNumber ?? 0) + 1;

  const snapshot = await buildExamSnapshot(examId);
  const startedAt = new Date();
  const endsAt = new Date(startedAt.getTime() + exam.durationMinutes * 60_000);

  try {
    const attempt = await prisma.attempt.create({
      data: {
        studentId,
        examId,
        mode: "MOCK_EXAM",
        attemptNumber: nextNumber,
        examSnapshot: snapshot as unknown as Prisma.InputJsonValue,
        startedAt,
        endsAt,
        status: "IN_PROGRESS",
      },
    });
    return { attempt, resumed: false };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const raceWinner = await prisma.attempt.findFirst({
        where: { studentId, examId, status: "IN_PROGRESS" },
        orderBy: { attemptNumber: "desc" },
      });
      if (raceWinner) return { attempt: raceWinner, resumed: true };
    }
    throw error;
  }
}

// ---------- Get / Resume detail ----------

export interface AttemptAnswerState {
  questionId: string;
  selectedOptionIds: string[];
  answerText: string | null;
  answered: boolean;
}

export async function getAttemptDetail(studentId: string, attemptId: string) {
  const attempt = await loadOwnedAttempt(studentId, attemptId);
  const fresh = await finalizeIfExpired(attempt);

  const snapshot = parseExamSnapshot(fresh.examSnapshot);
  const clientSnapshot = sanitizeSnapshotForStudent(snapshot);

  const savedAnswers = await prisma.attemptAnswer.findMany({
    where: { attemptId: fresh.id },
    select: { questionId: true, selectedOptionIds: true, answerText: true, answeredAt: true },
  });

  const answers: AttemptAnswerState[] = savedAnswers
    .filter((a): a is typeof a & { questionId: string } => a.questionId !== null)
    .map((a) => ({
      questionId: a.questionId,
      selectedOptionIds: (a.selectedOptionIds as unknown as string[]) ?? [],
      answerText: a.answerText,
      answered: Boolean(a.answeredAt),
    }));

  return {
    id: fresh.id,
    status: fresh.status,
    attemptNumber: fresh.attemptNumber,
    mode: fresh.mode,
    exam: fresh.exam,
    startedAt: fresh.startedAt,
    deadline: fresh.endsAt,
    submittedAt: fresh.submittedAt,
    serverNow: new Date(),
    snapshot: clientSnapshot,
    answers,
  };
}

export type AttemptDetail = Awaited<ReturnType<typeof getAttemptDetail>>;

// ---------- Save Answer ----------

export async function saveAnswer(
  studentId: string,
  attemptId: string,
  questionId: string,
  rawBody: unknown,
) {
  const attempt = await loadOwnedAttempt(studentId, attemptId);
  const fresh = await finalizeIfExpired(attempt);
  if (fresh.status !== "IN_PROGRESS") {
    throw new AttemptClosedError();
  }

  const snapshot = parseExamSnapshot(fresh.examSnapshot);
  const snapshotQuestion = snapshot.questions.find((q) => q.questionId === questionId);
  if (!snapshotQuestion) throw new QuestionNotInAttemptError();

  const validation = validateAnswerPayload(snapshotQuestion.type, snapshotQuestion, rawBody);
  if (!validation.success) throw new AnswerValidationError(validation.error);
  const { selectedOptionIds, answerText, answered } = validation.data;

  return prisma.attemptAnswer.upsert({
    where: { attemptId_questionId: { attemptId, questionId } },
    create: {
      attemptId,
      questionId,
      selectedOptionIds: selectedOptionIds as unknown as Prisma.InputJsonValue,
      answerText,
      answeredAt: answered ? new Date() : null,
    },
    update: {
      selectedOptionIds: selectedOptionIds as unknown as Prisma.InputJsonValue,
      answerText,
      answeredAt: answered ? new Date() : null,
      changeCount: { increment: 1 },
    },
  });
}

// ---------- Submit ----------

/**
 * Idempotent theo thiết kế (mục 27/29): dùng updateMany với điều kiện
 * status=IN_PROGRESS trong WHERE rồi luôn đọc lại bản ghi mới nhất — request
 * "thua" trong race (status đã đổi trước khi nó kịp update) vẫn nhận đúng
 * kết quả SUBMITTED cuối cùng thay vì lỗi, không có bản ghi nào khác bị tạo
 * thêm. Không tính điểm — chỉ đổi status, đúng scope Phase 9A (mục 49).
 */
export async function submitAttempt(studentId: string, attemptId: string): Promise<Attempt> {
  const attempt = await loadOwnedAttempt(studentId, attemptId);
  const finalized = await finalizeIfExpired(attempt);

  if (finalized.status === "SUBMITTED" || finalized.status === "AUTO_SUBMITTED") {
    return finalized;
  }
  if (finalized.status !== "IN_PROGRESS") {
    throw new AttemptClosedError();
  }

  const result = await prisma.attempt.updateMany({
    where: { id: attemptId, status: "IN_PROGRESS" },
    data: { status: "SUBMITTED", submittedAt: new Date() },
  });
  if (result.count === 1) {
    await scoreAndPersistIfNeeded(attemptId).catch((error) =>
      console.error(`[submitAttempt] Lỗi khi chấm điểm attempt ${attemptId}`, error),
    );
  }
  return prisma.attempt.findUniqueOrThrow({ where: { id: attemptId } });
}

/**
 * Kết quả chấm điểm cho Student (Phase 9B) — chỉ đọc được sau khi đã nộp bài.
 * Không trả questionResults/answer key ở đây — chỉ tổng hợp điểm toàn bài,
 * để tránh lấn phạm vi "review chi tiết từng câu" dành cho Phase 9D (mục 19).
 * Backfill điểm cho Attempt cũ (tạo trước khi Phase 9B tồn tại, score=null)
 * bằng scoreAndPersistIfNeeded — vô hại/idempotent nếu đã có điểm rồi.
 */
export async function getAttemptResult(studentId: string, attemptId: string) {
  const attempt = await loadOwnedAttempt(studentId, attemptId);
  const finalized = await finalizeIfExpired(attempt);

  if (finalized.status !== "SUBMITTED" && finalized.status !== "AUTO_SUBMITTED") {
    throw new AttemptNotSubmittedError();
  }

  await scoreAndPersistIfNeeded(attemptId);
  const scored = await prisma.attempt.findUniqueOrThrow({ where: { id: attemptId } });
  const snapshot = parseExamSnapshot(scored.examSnapshot);

  return {
    attemptId: scored.id,
    status: scored.status,
    submittedAt: scored.submittedAt,
    score: scored.score,
    maxScore: computeMaxScore(snapshot),
    correctCount: scored.correctCount,
    wrongCount: scored.wrongCount,
    unansweredCount: scored.unansweredCount,
  };
}

export interface QuestionReviewOption {
  id: string;
  label: string;
  content: string;
  isCorrect: boolean;
}

export interface QuestionReviewItem {
  questionId: string;
  order: number;
  type: SnapshotQuestion["type"];
  content: string;
  options: QuestionReviewOption[];
  correctAnswerText: string | null;
  studentAnswer: { selectedOptionIds: string[]; answerText: string | null };
  isAnswered: boolean;
  isCorrect: boolean;
  score: number;
  maxScore: number;
}

/**
 * Review chi tiết từng câu (Phase 9D) — CHỈ xem được sau khi Attempt đã
 * SUBMITTED/AUTO_SUBMITTED (chặn tuyệt đối trong lúc IN_PROGRESS, nếu không
 * sẽ lộ đáp án đúng giữa chừng bài thi — đúng nguyên tắc đã giữ xuyên suốt
 * 9A/9B/9C). Đây là NƠI DUY NHẤT được phép trả isCorrect/correctAnswerText
 * cho Student, vì bài đã kết thúc. Tái dùng scoreAttempt() của Phase 9B để
 * lấy đúng/sai từng câu — không viết lại logic chấm điểm ở đây.
 */
export async function getAttemptReview(studentId: string, attemptId: string): Promise<{
  attemptId: string;
  questions: QuestionReviewItem[];
}> {
  const attempt = await loadOwnedAttempt(studentId, attemptId);
  const finalized = await finalizeIfExpired(attempt);

  if (finalized.status !== "SUBMITTED" && finalized.status !== "AUTO_SUBMITTED") {
    throw new AttemptNotSubmittedError();
  }

  const snapshot = parseExamSnapshot(finalized.examSnapshot);
  const rawAnswers = await prisma.attemptAnswer.findMany({
    where: { attemptId },
    select: { questionId: true, selectedOptionIds: true, answerText: true },
  });
  const answerByQuestionId = new Map(
    rawAnswers
      .filter((a): a is typeof a & { questionId: string } => a.questionId !== null)
      .map((a) => [a.questionId, a]),
  );

  const answersForScoring: AnswerLike[] = [...answerByQuestionId.values()].map((a) => ({
    questionId: a.questionId,
    selectedOptionIds: a.selectedOptionIds,
    answerText: a.answerText,
  }));
  const scoring = scoreAttempt(snapshot, answersForScoring);
  const scoreByQuestionId = new Map(scoring.questionResults.map((r) => [r.questionId, r]));

  const questions: QuestionReviewItem[] = [...snapshot.questions]
    .sort((a, b) => a.order - b.order)
    .map((q) => {
      const answer = answerByQuestionId.get(q.questionId);
      const score = scoreByQuestionId.get(q.questionId);
      return {
        questionId: q.questionId,
        order: q.order,
        type: q.type,
        content: q.content,
        options: q.options.map((o) => ({ id: o.id, label: o.label, content: o.content, isCorrect: o.isCorrect })),
        correctAnswerText: q.correctAnswerText,
        studentAnswer: {
          selectedOptionIds: (answer?.selectedOptionIds as unknown as string[]) ?? [],
          answerText: answer?.answerText ?? null,
        },
        isAnswered: score?.isAnswered ?? false,
        isCorrect: score?.isCorrect ?? false,
        score: score?.score ?? 0,
        maxScore: score?.maxScore ?? 1,
      };
    });

  return { attemptId: finalized.id, questions };
}
