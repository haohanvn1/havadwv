import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  AttemptNotFoundError,
  AttemptNotSubmittedError,
  getAttemptResult,
  saveAnswer,
  startOrResumeAttempt,
  submitAttempt,
} from "@/server/services/studentAttemptService";

// Test này chạy trên database dev thật — tự tạo Subject/Topic/Question/Exam
// riêng (prefix "[vitest-scoring]") và dọn sạch sau khi chạy. Tiếp nối đúng
// pattern fixture của tests/unit/studentAttemptService.test.ts (Phase 9A).

let studentAId: string;
let studentBId: string;
let adminId: string;
let subjectId: string;
let topicId: string;
const createdExamIds: string[] = [];
const createdQuestionIds: string[] = [];

async function makeQuestion(
  type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER",
  overrides: { correctAnswerText?: string } = {},
) {
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
            { label: "C", content: "C", isCorrect: type === "MULTIPLE_CHOICE", order: 2 },
          ];

  const q = await prisma.question.create({
    data: {
      content: `[vitest-scoring] Câu ${type} ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      difficulty: "EASY",
      subjectId,
      topicId,
      status: "ACTIVE",
      correctAnswerText: type === "SHORT_ANSWER" ? (overrides.correctAnswerText ?? "42") : null,
      ...(options ? { options: { create: options } } : {}),
    },
    include: { options: true },
  });
  createdQuestionIds.push(q.id);
  return q;
}

async function makeExam(questions: { id: string; points?: number }[]) {
  const exam = await prisma.exam.create({
    data: {
      title: `[vitest-scoring] Exam ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      code: `VT-SCORING-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      examType: "TEST",
      subjectId,
      durationMinutes: 60,
      questionCount: questions.length,
      difficulty: "MIXED",
      status: "PUBLISHED",
      maxAttempts: null,
      createdById: adminId,
      examQuestions: {
        create: questions.map((q, i) => ({ questionId: q.id, order: i + 1, points: q.points ?? 1 })),
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

describe("Submit → scoring tự động (mục 11 Option 1)", () => {
  it("submit → Attempt.score/correctCount/wrongCount/unansweredCount được persist đúng", async () => {
    const q1 = await makeQuestion("SINGLE_CHOICE");
    const q2 = await makeQuestion("SHORT_ANSWER");
    const exam = await makeExam([q1, q2]);
    const { attempt } = await startOrResumeAttempt(studentAId, exam.id);

    await saveAnswer(studentAId, attempt.id, q1.id, { selectedOptionId: q1.options[0].id }); // đúng
    // q2 bỏ trống

    await submitAttempt(studentAId, attempt.id);

    const fresh = await prisma.attempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(fresh.score).toBe(1);
    expect(fresh.correctCount).toBe(1);
    expect(fresh.wrongCount).toBe(0);
    expect(fresh.unansweredCount).toBe(1);
  });

  it("getAttemptResult trả đúng DTO, maxScore tính từ points", async () => {
    const q1 = await makeQuestion("SINGLE_CHOICE");
    const exam = await makeExam([{ id: q1.id, points: 5 }]);
    const { attempt } = await startOrResumeAttempt(studentAId, exam.id);
    await saveAnswer(studentAId, attempt.id, q1.id, { selectedOptionId: q1.options[1].id }); // sai
    await submitAttempt(studentAId, attempt.id);

    const result = await getAttemptResult(studentAId, attempt.id);
    expect(result.score).toBe(0);
    expect(result.maxScore).toBe(5);
    expect(result.correctCount).toBe(0);
    expect(result.wrongCount).toBe(1);
  });

  it("Attempt chưa nộp (IN_PROGRESS) → getAttemptResult ném AttemptNotSubmittedError", async () => {
    const q1 = await makeQuestion("SINGLE_CHOICE");
    const exam = await makeExam([q1]);
    const { attempt } = await startOrResumeAttempt(studentAId, exam.id);

    await expect(getAttemptResult(studentAId, attempt.id)).rejects.toBeInstanceOf(AttemptNotSubmittedError);
  });

  it("Student khác không xem được kết quả → AttemptNotFoundError", async () => {
    const q1 = await makeQuestion("SINGLE_CHOICE");
    const exam = await makeExam([q1]);
    const { attempt } = await startOrResumeAttempt(studentBId, exam.id);
    await submitAttempt(studentBId, attempt.id);

    await expect(getAttemptResult(studentAId, attempt.id)).rejects.toBeInstanceOf(AttemptNotFoundError);
  });
});

describe("AUTO_SUBMITTED cũng được chấm điểm (mục 13)", () => {
  it("Attempt hết hạn → lazy finalize AUTO_SUBMITTED và vẫn có điểm, câu chưa trả lời tính unanswered", async () => {
    const q1 = await makeQuestion("SINGLE_CHOICE");
    const q2 = await makeQuestion("SINGLE_CHOICE");
    const exam = await makeExam([q1, q2]);
    const { attempt } = await startOrResumeAttempt(studentAId, exam.id);
    await saveAnswer(studentAId, attempt.id, q1.id, { selectedOptionId: q1.options[0].id }); // đúng
    // q2 không trả lời — hết giờ giữa chừng

    await prisma.attempt.update({ where: { id: attempt.id }, data: { endsAt: new Date(Date.now() - 1000) } });

    const result = await getAttemptResult(studentAId, attempt.id);
    expect(result.status).toBe("AUTO_SUBMITTED");
    expect(result.correctCount).toBe(1);
    expect(result.unansweredCount).toBe(1);
    expect(result.score).toBe(1);
  });
});

describe("Idempotency (mục 12)", () => {
  it("submit nhiều lần → score không đổi, không tính lại", async () => {
    const q1 = await makeQuestion("SINGLE_CHOICE");
    const exam = await makeExam([q1]);
    const { attempt } = await startOrResumeAttempt(studentAId, exam.id);
    await saveAnswer(studentAId, attempt.id, q1.id, { selectedOptionId: q1.options[0].id });

    await submitAttempt(studentAId, attempt.id);
    const first = await prisma.attempt.findUniqueOrThrow({ where: { id: attempt.id } });

    await submitAttempt(studentAId, attempt.id);
    await submitAttempt(studentAId, attempt.id);
    const second = await prisma.attempt.findUniqueOrThrow({ where: { id: attempt.id } });

    expect(second.score).toBe(first.score);
    expect(second.correctCount).toBe(first.correctCount);
  });

  it("getAttemptResult gọi nhiều lần sau submit → luôn trả cùng kết quả", async () => {
    const q1 = await makeQuestion("SHORT_ANSWER", { correctAnswerText: "hello" });
    const exam = await makeExam([q1]);
    const { attempt } = await startOrResumeAttempt(studentAId, exam.id);
    await saveAnswer(studentAId, attempt.id, q1.id, { answerText: "HELLO" }); // đúng theo rule case-insensitive
    await submitAttempt(studentAId, attempt.id);

    const r1 = await getAttemptResult(studentAId, attempt.id);
    const r2 = await getAttemptResult(studentAId, attempt.id);
    const r3 = await getAttemptResult(studentAId, attempt.id);
    expect(r1).toEqual(r2);
    expect(r2).toEqual(r3);
    expect(r1.correctCount).toBe(1);
  });
});

describe("Snapshot regression — scoring dùng answer key cũ, không phải Question hiện tại (mục 3)", () => {
  it("Question.correctAnswerText bị Admin sửa sau khi Start → scoring vẫn theo answer key lúc Start", async () => {
    const q1 = await makeQuestion("SHORT_ANSWER", { correctAnswerText: "6" });
    const exam = await makeExam([q1]);
    const { attempt } = await startOrResumeAttempt(studentAId, exam.id);
    await saveAnswer(studentAId, attempt.id, q1.id, { answerText: "6" }); // đúng theo answer key lúc start

    // Admin đổi đáp án đúng thành "999" sau khi Student đã Start.
    await prisma.question.update({ where: { id: q1.id }, data: { correctAnswerText: "999" } });

    await submitAttempt(studentAId, attempt.id);
    const result = await getAttemptResult(studentAId, attempt.id);
    // Nếu scoring lỡ đọc Question hiện tại thay vì snapshot, câu này sẽ thành sai (6 !== 999).
    expect(result.correctCount).toBe(1);
    expect(result.score).toBe(1);
  });

  it("Question bị archive sau khi Start → không ảnh hưởng scoring (vẫn chấm theo snapshot)", async () => {
    const q1 = await makeQuestion("SINGLE_CHOICE");
    const exam = await makeExam([q1]);
    const { attempt } = await startOrResumeAttempt(studentAId, exam.id);
    await saveAnswer(studentAId, attempt.id, q1.id, { selectedOptionId: q1.options[0].id });

    await prisma.question.update({ where: { id: q1.id }, data: { status: "ARCHIVED" } });

    await submitAttempt(studentAId, attempt.id);
    const result = await getAttemptResult(studentAId, attempt.id);
    expect(result.correctCount).toBe(1);
  });
});

describe("Concurrency — chấm điểm khi 2 submit đồng thời (mục 24)", () => {
  it("2 submit đồng thời → chỉ tính điểm một lần, kết quả cuối cùng nhất quán", async () => {
    const q1 = await makeQuestion("SINGLE_CHOICE");
    const exam = await makeExam([q1]);
    const { attempt } = await startOrResumeAttempt(studentAId, exam.id);
    await saveAnswer(studentAId, attempt.id, q1.id, { selectedOptionId: q1.options[0].id });

    await Promise.all([submitAttempt(studentAId, attempt.id), submitAttempt(studentAId, attempt.id)]);

    const fresh = await prisma.attempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(fresh.status).toBe("SUBMITTED");
    expect(fresh.score).toBe(1);
    expect(fresh.correctCount).toBe(1);

    const attemptCount = await prisma.attempt.count({ where: { id: attempt.id } });
    expect(attemptCount).toBe(1);
  });
});

describe("Dữ liệu bất thường không làm crash luồng thật (mục 15)", () => {
  it("AttemptAnswer mồ côi (question đã bị xoá khỏi Exam qua đường khác) không làm submit/scoring lỗi", async () => {
    const q1 = await makeQuestion("SINGLE_CHOICE");
    const outsider = await makeQuestion("SINGLE_CHOICE");
    const exam = await makeExam([q1]);
    const { attempt } = await startOrResumeAttempt(studentAId, exam.id);
    await saveAnswer(studentAId, attempt.id, q1.id, { selectedOptionId: q1.options[0].id });

    // Chèn thẳng một AttemptAnswer "mồ côi" không thuộc snapshot — mô phỏng
    // dữ liệu bất thường mà scoring phải bỏ qua an toàn thay vì crash.
    await prisma.attemptAnswer.create({
      data: {
        attemptId: attempt.id,
        questionId: outsider.id,
        selectedOptionIds: [outsider.options[0].id],
        answeredAt: new Date(),
      },
    });

    await expect(submitAttempt(studentAId, attempt.id)).resolves.toBeTruthy();
    const result = await getAttemptResult(studentAId, attempt.id);
    expect(result.correctCount).toBe(1);
    expect(result.wrongCount).toBe(0);
    expect(result.unansweredCount).toBe(0);
  });
});
