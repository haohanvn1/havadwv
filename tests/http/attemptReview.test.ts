import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { BASE_URL, startTestServer, stopTestServer } from "../support/server";
import { getAdminCookie, getStudentBCookie, getStudentCookie } from "../support/tokens";

// Phase 9D — test HTTP cho endpoint review chi tiết, tiếp nối đúng pattern
// của tests/http/attemptResult.test.ts (Phase 9B).

let adminCookie: string;
let studentACookie: string;
let studentBCookie: string;
let subjectId: string;
let topicId: string;
const createdExamIds: string[] = [];
const createdQuestionIds: string[] = [];

async function api(path: string, cookie: string | null, init?: RequestInit) {
  return fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}), ...(init?.headers ?? {}) },
  });
}

async function makeQuestion() {
  const q = await prisma.question.create({
    data: {
      content: `[vitest-http-review] Câu ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: "SINGLE_CHOICE",
      difficulty: "EASY",
      subjectId,
      topicId,
      status: "ACTIVE",
      options: {
        create: [
          { label: "A", content: "A", isCorrect: true, order: 0 },
          { label: "B", content: "B", isCorrect: false, order: 1 },
        ],
      },
    },
    include: { options: true },
  });
  createdQuestionIds.push(q.id);
  return q;
}

async function makeExam(questions: { id: string }[]) {
  const admin = await prisma.user.findUniqueOrThrow({ where: { username: "admin" } });
  const exam = await prisma.exam.create({
    data: {
      title: `[vitest-http-review] Exam ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      code: `VT-HTTP-REVIEW-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      examType: "TEST",
      subjectId,
      durationMinutes: 60,
      questionCount: questions.length,
      difficulty: "MIXED",
      status: "PUBLISHED",
      maxAttempts: null,
      createdById: admin.id,
      examQuestions: { create: questions.map((q, i) => ({ questionId: q.id, order: i + 1 })) },
    },
  });
  createdExamIds.push(exam.id);
  return exam;
}

beforeAll(async () => {
  await startTestServer();
  adminCookie = await getAdminCookie();
  studentACookie = await getStudentCookie();
  studentBCookie = await getStudentBCookie();
  const toan = await prisma.subject.findUniqueOrThrow({ where: { slug: "toan" } });
  subjectId = toan.id;
  const topic = await prisma.topic.findFirstOrThrow({ where: { subjectId: toan.id } });
  topicId = topic.id;
}, 70_000);

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
  stopTestServer();
  await prisma.$disconnect();
});

describe("GET /api/student/attempts/:attemptId/review", () => {
  it("anonymous → 401", async () => {
    const q = await makeQuestion();
    const exam = await makeExam([q]);
    const startRes = await api(`/api/student/exams/${exam.id}/attempts`, studentACookie, { method: "POST" });
    const { attemptId } = await startRes.json();
    await api(`/api/student/attempts/${attemptId}/submit`, studentACookie, { method: "POST" });

    expect((await api(`/api/student/attempts/${attemptId}/review`, null)).status).toBe(401);
  });

  it("owner → 200, KHÔNG bị chặn dù đã nộp, trả đúng đáp án đúng", async () => {
    const q = await makeQuestion();
    const exam = await makeExam([q]);
    const startRes = await api(`/api/student/exams/${exam.id}/attempts`, studentACookie, { method: "POST" });
    const { attemptId } = await startRes.json();
    await api(`/api/student/attempts/${attemptId}/answers/${q.id}`, studentACookie, {
      method: "PATCH",
      body: JSON.stringify({ selectedOptionId: q.options[1].id }),
    });
    await api(`/api/student/attempts/${attemptId}/submit`, studentACookie, { method: "POST" });

    const res = await api(`/api/student/attempts/${attemptId}/review`, studentACookie);
    expect(res.status).toBe(200);
    const body = await res.json();
    const item = body.review.questions[0];
    expect(item.isCorrect).toBe(false);
    expect(item.options.some((o: { isCorrect: boolean }) => o.isCorrect)).toBe(true);
  });

  it("student khác → 404", async () => {
    const q = await makeQuestion();
    const exam = await makeExam([q]);
    const startRes = await api(`/api/student/exams/${exam.id}/attempts`, studentACookie, { method: "POST" });
    const { attemptId } = await startRes.json();
    await api(`/api/student/attempts/${attemptId}/submit`, studentACookie, { method: "POST" });

    const res = await api(`/api/student/attempts/${attemptId}/review`, studentBCookie);
    expect(res.status).toBe(404);
  });

  it("admin → 403 (không dùng chung API Student)", async () => {
    const q = await makeQuestion();
    const exam = await makeExam([q]);
    const startRes = await api(`/api/student/exams/${exam.id}/attempts`, studentACookie, { method: "POST" });
    const { attemptId } = await startRes.json();
    await api(`/api/student/attempts/${attemptId}/submit`, studentACookie, { method: "POST" });

    const res = await api(`/api/student/attempts/${attemptId}/review`, adminCookie);
    expect(res.status).toBe(403);
  });

  it("Attempt còn IN_PROGRESS (chưa nộp) → 409, không lộ đáp án giữa bài thi", async () => {
    const q = await makeQuestion();
    const exam = await makeExam([q]);
    const startRes = await api(`/api/student/exams/${exam.id}/attempts`, studentACookie, { method: "POST" });
    const { attemptId } = await startRes.json();

    const res = await api(`/api/student/attempts/${attemptId}/review`, studentACookie);
    expect(res.status).toBe(409);
  });
});
