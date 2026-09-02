import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  AttemptNotFoundError,
  AttemptNotSubmittedError,
  getAttemptReview,
  saveAnswer,
  startOrResumeAttempt,
  submitAttempt,
} from "@/server/services/studentAttemptService";

// Phase 9D — review chi tiết từng câu sau khi nộp bài. Test này chạy trên
// database dev thật, tiếp nối đúng pattern fixture của
// tests/unit/scoringIntegration.test.ts (Phase 9B).

let studentAId: string;
let studentBId: string;
let adminId: string;
let subjectId: string;
let topicId: string;
const createdExamIds: string[] = [];
const createdQuestionIds: string[] = [];

async function makeQuestion(type: "SINGLE_CHOICE" | "SHORT_ANSWER" = "SINGLE_CHOICE") {
  const q = await prisma.question.create({
    data: {
      content: `[vitest-review] Câu ${type} ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      difficulty: "EASY",
      subjectId,
      topicId,
      status: "ACTIVE",
      correctAnswerText: type === "SHORT_ANSWER" ? "42" : null,
      ...(type === "SINGLE_CHOICE"
        ? {
            options: {
              create: [
                { label: "A", content: "A", isCorrect: true, order: 0 },
                { label: "B", content: "B", isCorrect: false, order: 1 },
              ],
            },
          }
        : {}),
    },
    include: { options: true },
  });
  createdQuestionIds.push(q.id);
  return q;
}

async function makeExam(questions: { id: string }[]) {
  const exam = await prisma.exam.create({
    data: {
      title: `[vitest-review] Exam ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      code: `VT-REVIEW-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      examType: "TEST",
      subjectId,
      durationMinutes: 60,
      questionCount: questions.length,
      difficulty: "MIXED",
      status: "PUBLISHED",
      maxAttempts: null,
      createdById: adminId,
      examQuestions: { create: questions.map((q, i) => ({ questionId: q.id, order: i + 1 })) },
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

describe("getAttemptReview", () => {
  it("Attempt còn IN_PROGRESS → AttemptNotSubmittedError, tuyệt đối không lộ đáp án giữa bài thi", async () => {
    const q = await makeQuestion();
    const exam = await makeExam([q]);
    const { attempt } = await startOrResumeAttempt(studentAId, exam.id);

    await expect(getAttemptReview(studentAId, attempt.id)).rejects.toBeInstanceOf(AttemptNotSubmittedError);
  });

  it("sau khi nộp → trả đúng isCorrect/correctAnswerText/studentAnswer từng câu", async () => {
    const correct = await makeQuestion("SINGLE_CHOICE");
    const wrong = await makeQuestion("SINGLE_CHOICE");
    const blank = await makeQuestion("SINGLE_CHOICE");
    const short = await makeQuestion("SHORT_ANSWER");
    const exam = await makeExam([correct, wrong, blank, short]);
    const { attempt } = await startOrResumeAttempt(studentAId, exam.id);

    await saveAnswer(studentAId, attempt.id, correct.id, { selectedOptionId: correct.options[0].id }); // đúng
    await saveAnswer(studentAId, attempt.id, wrong.id, { selectedOptionId: wrong.options[1].id }); // sai
    // blank: không trả lời
    await saveAnswer(studentAId, attempt.id, short.id, { answerText: "42" }); // đúng

    await submitAttempt(studentAId, attempt.id);
    const review = await getAttemptReview(studentAId, attempt.id);

    const byId = new Map(review.questions.map((q) => [q.questionId, q]));

    const correctReview = byId.get(correct.id)!;
    expect(correctReview.isCorrect).toBe(true);
    expect(correctReview.isAnswered).toBe(true);
    expect(correctReview.studentAnswer.selectedOptionIds).toEqual([correct.options[0].id]);
    expect(correctReview.options.find((o) => o.id === correct.options[0].id)?.isCorrect).toBe(true);

    const wrongReview = byId.get(wrong.id)!;
    expect(wrongReview.isCorrect).toBe(false);
    expect(wrongReview.isAnswered).toBe(true);
    expect(wrongReview.studentAnswer.selectedOptionIds).toEqual([wrong.options[1].id]);
    // Đáp án đúng vẫn phải xuất hiện trong options dù Student chọn sai — đây là review, không phải lúc làm bài.
    expect(wrongReview.options.some((o) => o.isCorrect)).toBe(true);

    const blankReview = byId.get(blank.id)!;
    expect(blankReview.isAnswered).toBe(false);
    expect(blankReview.isCorrect).toBe(false);

    const shortReview = byId.get(short.id)!;
    expect(shortReview.isCorrect).toBe(true);
    expect(shortReview.correctAnswerText).toBe("42");
    expect(shortReview.studentAnswer.answerText).toBe("42");
  });

  it("câu hỏi được sắp đúng theo order của snapshot", async () => {
    const q1 = await makeQuestion();
    const q2 = await makeQuestion();
    const exam = await makeExam([q1, q2]);
    const { attempt } = await startOrResumeAttempt(studentBId, exam.id);
    await submitAttempt(studentBId, attempt.id);

    const review = await getAttemptReview(studentBId, attempt.id);
    expect(review.questions.map((q) => q.questionId)).toEqual([q1.id, q2.id]);
    expect(review.questions[0].order).toBeLessThan(review.questions[1].order);
  });

  it("Student khác không xem được review của người khác → AttemptNotFoundError", async () => {
    const q = await makeQuestion();
    const exam = await makeExam([q]);
    const { attempt } = await startOrResumeAttempt(studentAId, exam.id);
    await submitAttempt(studentAId, attempt.id);

    await expect(getAttemptReview(studentBId, attempt.id)).rejects.toBeInstanceOf(AttemptNotFoundError);
  });

  it("AUTO_SUBMITTED cũng xem được review bình thường", async () => {
    const q = await makeQuestion();
    const exam = await makeExam([q]);
    const { attempt } = await startOrResumeAttempt(studentAId, exam.id);
    await prisma.attempt.update({ where: { id: attempt.id }, data: { endsAt: new Date(Date.now() - 1000) } });

    const review = await getAttemptReview(studentAId, attempt.id);
    expect(review.questions).toHaveLength(1);
    const fresh = await prisma.attempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(fresh.status).toBe("AUTO_SUBMITTED");
  });
});
