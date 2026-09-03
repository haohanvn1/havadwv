import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  AttemptClosedError,
  AttemptNotFoundError,
  MaxAttemptsReachedError,
  ExamNotAvailableError,
  QuestionNotInAttemptError,
  AnswerValidationError,
  getAttemptDetail,
  saveAnswer,
  startOrResumeAttempt,
  submitAttempt,
} from "@/server/services/studentAttemptService";

// Test này chạy trên database dev thật — tự tạo Subject/Topic/Question/Exam
// riêng (prefix "[vitest-attempt]") và dọn sạch sau khi chạy.

let studentAId: string;
let studentBId: string;
let adminId: string;
let subjectId: string;
let topicId: string;
const createdExamIds: string[] = [];
const createdQuestionIds: string[] = [];

async function makeQuestion(type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER") {
  const options =
    type === "SHORT_ANSWER"
      ? undefined
      : type === "TRUE_FALSE"
        ? [
            { label: "A", content: "Đúng", isCorrect: true, order: 0 },
            { label: "B", content: "Sai", isCorrect: false, order: 1 },
          ]
        : [
            { label: "A", content: "A", isCorrect: true, order: 0 },
            { label: "B", content: "B", isCorrect: false, order: 1 },
            { label: "C", content: "C", isCorrect: false, order: 2 },
          ];

  const q = await prisma.question.create({
    data: {
      content: `[vitest-attempt] Câu ${type} ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      difficulty: "EASY",
      subjectId,
      topicId,
      status: "ACTIVE",
      correctAnswerText: type === "SHORT_ANSWER" ? "42" : null,
      ...(options ? { options: { create: options } } : {}),
    },
    include: { options: true },
  });
  createdQuestionIds.push(q.id);
  return q;
}

async function makeExam(
  questions: { id: string }[],
  overrides: Partial<{ maxAttempts: number | null; durationMinutes: number; status: "PUBLISHED" | "DRAFT" }> = {},
) {
  const exam = await prisma.exam.create({
    data: {
      title: `[vitest-attempt] Exam ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      code: `VT-ATTEMPT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      examType: "TEST",
      subjectId,
      durationMinutes: overrides.durationMinutes ?? 60,
      questionCount: questions.length,
      difficulty: "MIXED",
      status: overrides.status ?? "PUBLISHED",
      maxAttempts: overrides.maxAttempts === undefined ? null : overrides.maxAttempts,
      createdById: adminId,
      examQuestions: {
        create: questions.map((q, i) => ({ questionId: q.id, order: i + 1 })),
      },
    },
  });
  createdExamIds.push(exam.id);
  return exam;
}

beforeAll(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { username: "admin" } });
  adminId = admin.id;
  const studentA = await prisma.user.findUniqueOrThrow({ where: { username: "student1" } });
  studentAId = studentA.id;
  const studentB = await prisma.user.findUniqueOrThrow({ where: { username: "student2" } });
  studentBId = studentB.id;
  const toan = await prisma.subject.findUniqueOrThrow({ where: { slug: "toan" } });
  subjectId = toan.id;
  const topic = await prisma.topic.findFirstOrThrow({ where: { subjectId: toan.id } });
  topicId = topic.id;
});

afterAll(async () => {
  if (createdExamIds.length > 0) {
    await prisma.attemptAnswer.deleteMany({ where: { attempt: { examId: { in: createdExamIds } } } });
    await prisma.attempt.deleteMany({ where: { examId: { in: createdExamIds } } });
    await prisma.examQuestion.deleteMany({ where: { examId: { in: createdExamIds } } });
    await prisma.exam.deleteMany({ where: { id: { in: createdExamIds } } });
  }
  if (createdQuestionIds.length > 0) {
    await prisma.question.deleteMany({ where: { id: { in: createdQuestionIds } } });
  }
  await prisma.$disconnect();
});

describe("startOrResumeAttempt — lifecycle", () => {
  it("start lần đầu → tạo Attempt IN_PROGRESS, attemptNumber=1, snapshot đúng", async () => {
    const q = await makeQuestion("SINGLE_CHOICE");
    const exam = await makeExam([q]);

    const { attempt, resumed } = await startOrResumeAttempt(studentAId, exam.id);
    expect(resumed).toBe(false);
    expect(attempt.attemptNumber).toBe(1);
    expect(attempt.status).toBe("IN_PROGRESS");
    expect(attempt.mode).toBe("MOCK_EXAM");

    const snapshot = attempt.examSnapshot as unknown as { questions: { questionId: string }[] };
    expect(snapshot.questions).toHaveLength(1);
    expect(snapshot.questions[0].questionId).toBe(q.id);
  });

  it("start lần 2 khi đang có Attempt active → resume, không tạo Attempt mới", async () => {
    const q = await makeQuestion("SINGLE_CHOICE");
    const exam = await makeExam([q]);

    const first = await startOrResumeAttempt(studentAId, exam.id);
    const second = await startOrResumeAttempt(studentAId, exam.id);

    expect(second.resumed).toBe(true);
    expect(second.attempt.id).toBe(first.attempt.id);

    const count = await prisma.attempt.count({ where: { studentId: studentAId, examId: exam.id } });
    expect(count).toBe(1);
  });

  it("Exam DRAFT (chưa publish) → ExamNotAvailableError", async () => {
    const q = await makeQuestion("SINGLE_CHOICE");
    const exam = await makeExam([q], { status: "DRAFT" });

    await expect(startOrResumeAttempt(studentAId, exam.id)).rejects.toBeInstanceOf(ExamNotAvailableError);
  });

  it("maxAttempts=1 → sau khi submit, start lần nữa bị chặn", async () => {
    const q = await makeQuestion("SINGLE_CHOICE");
    const exam = await makeExam([q], { maxAttempts: 1 });

    const { attempt } = await startOrResumeAttempt(studentBId, exam.id);
    await submitAttempt(studentBId, attempt.id);

    await expect(startOrResumeAttempt(studentBId, exam.id)).rejects.toBeInstanceOf(MaxAttemptsReachedError);
  });

  it("maxAttempts=null → không giới hạn, có thể start lại sau khi submit", async () => {
    const q = await makeQuestion("SINGLE_CHOICE");
    const exam = await makeExam([q], { maxAttempts: null });

    const { attempt: a1 } = await startOrResumeAttempt(studentAId, exam.id);
    await submitAttempt(studentAId, a1.id);

    const { attempt: a2, resumed } = await startOrResumeAttempt(studentAId, exam.id);
    expect(resumed).toBe(false);
    expect(a2.attemptNumber).toBe(2);
  });

  it("Attempt đã hết hạn (endsAt quá khứ) → lazy finalize AUTO_SUBMITTED, start mới được tạo với attemptNumber tăng", async () => {
    const q = await makeQuestion("SINGLE_CHOICE");
    const exam = await makeExam([q], { maxAttempts: null });

    const { attempt } = await startOrResumeAttempt(studentAId, exam.id);
    await prisma.attempt.update({ where: { id: attempt.id }, data: { endsAt: new Date(Date.now() - 60_000) } });

    const { attempt: resumedOrNew, resumed } = await startOrResumeAttempt(studentAId, exam.id);
    expect(resumed).toBe(false);
    expect(resumedOrNew.id).not.toBe(attempt.id);

    const expired = await prisma.attempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(expired.status).toBe("AUTO_SUBMITTED");
  });
});

describe("startOrResumeAttempt — race condition (mục 43)", () => {
  it("2 Start đồng thời → chỉ 1 Attempt IN_PROGRESS", async () => {
    const q = await makeQuestion("SINGLE_CHOICE");
    const exam = await makeExam([q], { maxAttempts: null });

    const [r1, r2] = await Promise.all([
      startOrResumeAttempt(studentAId, exam.id),
      startOrResumeAttempt(studentAId, exam.id),
    ]);
    expect(r1.attempt.id).toBe(r2.attempt.id);

    const inProgressCount = await prisma.attempt.count({
      where: { studentId: studentAId, examId: exam.id, status: "IN_PROGRESS" },
    });
    expect(inProgressCount).toBe(1);
  });
});

describe("saveAnswer — validation theo QuestionType", () => {
  it("SINGLE_CHOICE hợp lệ → lưu đúng, đổi đáp án → upsert không tạo duplicate", async () => {
    const q = await makeQuestion("SINGLE_CHOICE");
    const exam = await makeExam([q]);
    const { attempt } = await startOrResumeAttempt(studentAId, exam.id);

    await saveAnswer(studentAId, attempt.id, q.id, { selectedOptionId: q.options[0].id });
    await saveAnswer(studentAId, attempt.id, q.id, { selectedOptionId: q.options[1].id });

    const rows = await prisma.attemptAnswer.findMany({ where: { attemptId: attempt.id, questionId: q.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].selectedOptionIds).toEqual([q.options[1].id]);
    expect(rows[0].changeCount).toBe(1);
  });

  it("MULTIPLE_CHOICE hợp lệ", async () => {
    const q = await makeQuestion("MULTIPLE_CHOICE");
    const exam = await makeExam([q]);
    const { attempt } = await startOrResumeAttempt(studentAId, exam.id);

    await saveAnswer(studentAId, attempt.id, q.id, {
      selectedOptionIds: [q.options[0].id, q.options[1].id],
    });
    const row = await prisma.attemptAnswer.findFirstOrThrow({ where: { attemptId: attempt.id, questionId: q.id } });
    expect(row.selectedOptionIds).toEqual([q.options[0].id, q.options[1].id]);
  });

  it("TRUE_FALSE hợp lệ", async () => {
    const q = await makeQuestion("TRUE_FALSE");
    const exam = await makeExam([q]);
    const { attempt } = await startOrResumeAttempt(studentAId, exam.id);

    await saveAnswer(studentAId, attempt.id, q.id, { selectedOptionId: q.options[0].id });
    const row = await prisma.attemptAnswer.findFirstOrThrow({ where: { attemptId: attempt.id, questionId: q.id } });
    expect(row.selectedOptionIds).toEqual([q.options[0].id]);
  });

  it("SHORT_ANSWER hợp lệ", async () => {
    const q = await makeQuestion("SHORT_ANSWER");
    const exam = await makeExam([q]);
    const { attempt } = await startOrResumeAttempt(studentAId, exam.id);

    await saveAnswer(studentAId, attempt.id, q.id, { answerText: "câu trả lời của tôi" });
    const row = await prisma.attemptAnswer.findFirstOrThrow({ where: { attemptId: attempt.id, questionId: q.id } });
    expect(row.answerText).toBe("câu trả lời của tôi");
  });

  it("answer rỗng (null/[]/\"\") → coi là chưa trả lời, không lỗi", async () => {
    const q = await makeQuestion("SINGLE_CHOICE");
    const exam = await makeExam([q]);
    const { attempt } = await startOrResumeAttempt(studentAId, exam.id);

    await saveAnswer(studentAId, attempt.id, q.id, { selectedOptionId: null });
    const row = await prisma.attemptAnswer.findFirstOrThrow({ where: { attemptId: attempt.id, questionId: q.id } });
    expect(row.answeredAt).toBeNull();
    expect(row.selectedOptionIds).toEqual([]);
  });

  it("option thuộc câu hỏi khác → AnswerValidationError", async () => {
    const q1 = await makeQuestion("SINGLE_CHOICE");
    const q2 = await makeQuestion("SINGLE_CHOICE");
    const exam = await makeExam([q1, q2]);
    const { attempt } = await startOrResumeAttempt(studentAId, exam.id);

    await expect(
      saveAnswer(studentAId, attempt.id, q1.id, { selectedOptionId: q2.options[0].id }),
    ).rejects.toBeInstanceOf(AnswerValidationError);
  });

  it("Question không thuộc Exam của Attempt → QuestionNotInAttemptError", async () => {
    const q1 = await makeQuestion("SINGLE_CHOICE");
    const outsider = await makeQuestion("SINGLE_CHOICE");
    const exam = await makeExam([q1]);
    const { attempt } = await startOrResumeAttempt(studentAId, exam.id);

    await expect(
      saveAnswer(studentAId, attempt.id, outsider.id, { selectedOptionId: outsider.options[0].id }),
    ).rejects.toBeInstanceOf(QuestionNotInAttemptError);
  });

  it("Student khác không sở hữu Attempt → AttemptNotFoundError", async () => {
    const q = await makeQuestion("SINGLE_CHOICE");
    const exam = await makeExam([q]);
    const { attempt } = await startOrResumeAttempt(studentAId, exam.id);

    await expect(
      saveAnswer(studentBId, attempt.id, q.id, { selectedOptionId: q.options[0].id }),
    ).rejects.toBeInstanceOf(AttemptNotFoundError);
  });

  it("Save sau khi đã submit → AttemptClosedError", async () => {
    const q = await makeQuestion("SINGLE_CHOICE");
    const exam = await makeExam([q]);
    const { attempt } = await startOrResumeAttempt(studentAId, exam.id);
    await submitAttempt(studentAId, attempt.id);

    await expect(
      saveAnswer(studentAId, attempt.id, q.id, { selectedOptionId: q.options[0].id }),
    ).rejects.toBeInstanceOf(AttemptClosedError);
  });
});

describe("submitAttempt", () => {
  it("submit → SUBMITTED, submit lại → idempotent, không đổi lần nữa", async () => {
    const q = await makeQuestion("SINGLE_CHOICE");
    const exam = await makeExam([q]);
    const { attempt } = await startOrResumeAttempt(studentAId, exam.id);

    const first = await submitAttempt(studentAId, attempt.id);
    expect(first.status).toBe("SUBMITTED");
    const second = await submitAttempt(studentAId, attempt.id);
    expect(second.status).toBe("SUBMITTED");
    expect(second.submittedAt?.getTime()).toBe(first.submittedAt?.getTime());
  });

  it("2 submit đồng thời → không lỗi, chỉ 1 Attempt SUBMITTED, không tạo record khác", async () => {
    const q = await makeQuestion("SINGLE_CHOICE");
    const exam = await makeExam([q]);
    const { attempt } = await startOrResumeAttempt(studentAId, exam.id);

    const [r1, r2] = await Promise.all([
      submitAttempt(studentAId, attempt.id),
      submitAttempt(studentAId, attempt.id),
    ]);
    expect(r1.status).toBe("SUBMITTED");
    expect(r2.status).toBe("SUBMITTED");

    const count = await prisma.attempt.count({ where: { id: attempt.id } });
    expect(count).toBe(1);
  });
});

describe("getAttemptDetail — DTO an toàn + snapshot ổn định", () => {
  it("DTO không chứa isCorrect/correctAnswerText", async () => {
    const q = await makeQuestion("SINGLE_CHOICE");
    const exam = await makeExam([q]);
    const { attempt } = await startOrResumeAttempt(studentAId, exam.id);

    const detail = await getAttemptDetail(studentAId, attempt.id);
    const json = JSON.stringify(detail);
    expect(json).not.toContain("isCorrect");
    expect(json).not.toContain("correctAnswerText");
  });

  it("Snapshot giữ nguyên nội dung câu hỏi cũ dù Question bị sửa sau khi Start (mục 30/44)", async () => {
    const q = await makeQuestion("SINGLE_CHOICE");
    const exam = await makeExam([q]);
    const { attempt } = await startOrResumeAttempt(studentAId, exam.id);

    await prisma.question.update({ where: { id: q.id }, data: { content: "[vitest-attempt] ĐÃ BỊ SỬA" } });

    const detail = await getAttemptDetail(studentAId, attempt.id);
    expect(detail.snapshot.questions[0].content).toBe(q.content);
    expect(detail.snapshot.questions[0].content).not.toContain("ĐÃ BỊ SỬA");
  });

  it("Student khác không xem được Attempt → AttemptNotFoundError", async () => {
    const q = await makeQuestion("SINGLE_CHOICE");
    const exam = await makeExam([q]);
    const { attempt } = await startOrResumeAttempt(studentAId, exam.id);

    await expect(getAttemptDetail(studentBId, attempt.id)).rejects.toBeInstanceOf(AttemptNotFoundError);
  });
});
