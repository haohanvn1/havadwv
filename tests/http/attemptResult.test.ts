import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { BASE_URL, startTestServer, stopTestServer } from "../support/server";
import { getAdminCookie, getStudentBCookie, getStudentCookie } from "../support/tokens";

// Test HTTP cho endpoint kết quả Phase 9B — chạy trên server thật + database
// dev thật, tự tạo Subject/Question/Exam riêng (prefix "[vitest-http-score]")
// và dọn sạch sau khi chạy. Tiếp nối đúng pattern của tests/http/studentAttempts.test.ts.

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
      content: `[vitest-http-score] Câu ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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
      title: `[vitest-http-score] Exam ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      code: `VT-HTTP-SCORE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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

describe("GET /api/student/attempts/:attemptId/result — authorization", () => {
  it("anonymous → 401", async () => {
    const q = await makeQuestion();
    const exam = await makeExam([q]);
    const startRes = await api(`/api/student/exams/${exam.id}/attempts`, studentACookie, { method: "POST" });
    const { attemptId } = await startRes.json();
    await api(`/api/student/attempts/${attemptId}/submit`, studentACookie, { method: "POST" });

    const res = await api(`/api/student/attempts/${attemptId}/result`, null);
    expect(res.status).toBe(401);
  });

  it("owner (student1) → 200 với đúng dữ liệu điểm", async () => {
    const q = await makeQuestion();
    const exam = await makeExam([q]);
    const startRes = await api(`/api/student/exams/${exam.id}/attempts`, studentACookie, { method: "POST" });
    const { attemptId } = await startRes.json();
    await api(`/api/student/attempts/${attemptId}/answers/${q.id}`, studentACookie, {
      method: "PATCH",
      body: JSON.stringify({ selectedOptionId: q.options[0].id }),
    });
    await api(`/api/student/attempts/${attemptId}/submit`, studentACookie, { method: "POST" });

    const res = await api(`/api/student/attempts/${attemptId}/result`, studentACookie);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result).toMatchObject({ score: 1, maxScore: 1, correctCount: 1, wrongCount: 0, unansweredCount: 0 });
  });

  it("student khác (student2) → 404", async () => {
    const q = await makeQuestion();
    const exam = await makeExam([q]);
    const startRes = await api(`/api/student/exams/${exam.id}/attempts`, studentACookie, { method: "POST" });
    const { attemptId } = await startRes.json();
    await api(`/api/student/attempts/${attemptId}/submit`, studentACookie, { method: "POST" });

    const res = await api(`/api/student/attempts/${attemptId}/result`, studentBCookie);
    expect(res.status).toBe(404);
  });

  it("admin → 403 (không dùng chung API Student)", async () => {
    const q = await makeQuestion();
    const exam = await makeExam([q]);
    const startRes = await api(`/api/student/exams/${exam.id}/attempts`, studentACookie, { method: "POST" });
    const { attemptId } = await startRes.json();
    await api(`/api/student/attempts/${attemptId}/submit`, studentACookie, { method: "POST" });

    const res = await api(`/api/student/attempts/${attemptId}/result`, adminCookie);
    expect(res.status).toBe(403);
  });
});

describe("GET result — theo trạng thái Attempt", () => {
  it("Attempt còn IN_PROGRESS (chưa nộp) → 409", async () => {
    const q = await makeQuestion();
    const exam = await makeExam([q]);
    const startRes = await api(`/api/student/exams/${exam.id}/attempts`, studentACookie, { method: "POST" });
    const { attemptId } = await startRes.json();

    const res = await api(`/api/student/attempts/${attemptId}/result`, studentACookie);
    expect(res.status).toBe(409);
  });

  it("Attempt AUTO_SUBMITTED (hết hạn) → vẫn trả kết quả 200", async () => {
    const q = await makeQuestion();
    const exam = await makeExam([q]);
    const startRes = await api(`/api/student/exams/${exam.id}/attempts`, studentACookie, { method: "POST" });
    const { attemptId } = await startRes.json();
    await api(`/api/student/attempts/${attemptId}/answers/${q.id}`, studentACookie, {
      method: "PATCH",
      body: JSON.stringify({ selectedOptionId: q.options[0].id }),
    });
    await prisma.attempt.update({ where: { id: attemptId }, data: { endsAt: new Date(Date.now() - 1000) } });

    const res = await api(`/api/student/attempts/${attemptId}/result`, studentACookie);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.status).toBe("AUTO_SUBMITTED");
    expect(body.result.correctCount).toBe(1);
  });

  it("GET result nhiều lần liên tiếp → luôn trả cùng một kết quả (idempotent qua HTTP)", async () => {
    const q = await makeQuestion();
    const exam = await makeExam([q]);
    const startRes = await api(`/api/student/exams/${exam.id}/attempts`, studentACookie, { method: "POST" });
    const { attemptId } = await startRes.json();
    await api(`/api/student/attempts/${attemptId}/submit`, studentACookie, { method: "POST" });

    const first = await (await api(`/api/student/attempts/${attemptId}/result`, studentACookie)).json();
    const second = await (await api(`/api/student/attempts/${attemptId}/result`, studentACookie)).json();
    expect(first.result).toEqual(second.result);
  });
});
