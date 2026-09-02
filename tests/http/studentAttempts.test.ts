import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { BASE_URL, startTestServer, stopTestServer } from "../support/server";
import { getAdminCookie, getStudentBCookie, getStudentCookie } from "../support/tokens";

// Test HTTP đầy đủ cho Phase 9A (Start/Save/Resume/Submit + authorization
// matrix mục 38) — chạy trên server thật + database dev thật, tự tạo
// Subject/Question/Exam riêng (prefix "[vitest-http-attempt]") và dọn sạch.

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

async function makeQuestion(type: "SINGLE_CHOICE" | "SHORT_ANSWER" = "SINGLE_CHOICE") {
  const q = await prisma.question.create({
    data: {
      content: `[vitest-http-attempt] Câu ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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

async function makeExam(
  questions: { id: string }[],
  overrides: Partial<{ maxAttempts: number | null; durationMinutes: number; status: "PUBLISHED" | "DRAFT" }> = {},
) {
  const admin = await prisma.user.findUniqueOrThrow({ where: { username: "admin" } });
  const exam = await prisma.exam.create({
    data: {
      title: `[vitest-http-attempt] Exam ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      code: `VT-HTTP-ATTEMPT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      examType: "TEST",
      subjectId,
      durationMinutes: overrides.durationMinutes ?? 60,
      questionCount: questions.length,
      difficulty: "MIXED",
      status: overrides.status ?? "PUBLISHED",
      maxAttempts: overrides.maxAttempts === undefined ? null : overrides.maxAttempts,
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

describe("Authorization matrix (mục 38)", () => {
  it("List exams: anonymous 401, Student OK", async () => {
    expect((await api("/api/student/exams", null)).status).toBe(401);
    expect((await api("/api/student/exams", studentACookie)).status).toBe(200);
  });

  it("Start exam: anonymous 401, Student OK", async () => {
    const q = await makeQuestion();
    const exam = await makeExam([q]);
    expect((await api(`/api/student/exams/${exam.id}/attempts`, null, { method: "POST" })).status).toBe(401);
    const res = await api(`/api/student/exams/${exam.id}/attempts`, studentACookie, { method: "POST" });
    expect(res.status).toBe(201);
  });

  it("Get own attempt: OK; Get other's attempt: Student B bị chặn; anonymous 401", async () => {
    const q = await makeQuestion();
    const exam = await makeExam([q]);
    const startRes = await api(`/api/student/exams/${exam.id}/attempts`, studentACookie, { method: "POST" });
    const { attemptId } = await startRes.json();

    expect((await api(`/api/student/attempts/${attemptId}`, null)).status).toBe(401);
    expect((await api(`/api/student/attempts/${attemptId}`, studentACookie)).status).toBe(200);
    const otherRes = await api(`/api/student/attempts/${attemptId}`, studentBCookie);
    expect([403, 404]).toContain(otherRes.status);
  });

  it("Save own answer: OK; Save other's answer: Student B bị chặn; anonymous 401", async () => {
    const q = await makeQuestion();
    const exam = await makeExam([q]);
    const startRes = await api(`/api/student/exams/${exam.id}/attempts`, studentACookie, { method: "POST" });
    const { attemptId } = await startRes.json();

    expect(
      (
        await api(`/api/student/attempts/${attemptId}/answers/${q.id}`, null, {
          method: "PATCH",
          body: JSON.stringify({ selectedOptionId: q.options[0].id }),
        })
      ).status,
    ).toBe(401);

    const ownRes = await api(`/api/student/attempts/${attemptId}/answers/${q.id}`, studentACookie, {
      method: "PATCH",
      body: JSON.stringify({ selectedOptionId: q.options[0].id }),
    });
    expect(ownRes.status).toBe(200);

    const otherRes = await api(`/api/student/attempts/${attemptId}/answers/${q.id}`, studentBCookie, {
      method: "PATCH",
      body: JSON.stringify({ selectedOptionId: q.options[0].id }),
    });
    expect([403, 404]).toContain(otherRes.status);
  });

  it("Submit own: OK; Submit other's: Student B bị chặn; anonymous 401", async () => {
    const q = await makeQuestion();
    const exam = await makeExam([q]);
    const startRes = await api(`/api/student/exams/${exam.id}/attempts`, studentACookie, { method: "POST" });
    const { attemptId } = await startRes.json();

    expect((await api(`/api/student/attempts/${attemptId}/submit`, null, { method: "POST" })).status).toBe(401);
    const otherRes = await api(`/api/student/attempts/${attemptId}/submit`, studentBCookie, { method: "POST" });
    expect([403, 404]).toContain(otherRes.status);

    const ownRes = await api(`/api/student/attempts/${attemptId}/submit`, studentACookie, { method: "POST" });
    expect(ownRes.status).toBe(200);
  });

  it("Admin không dùng API Student (không có session Student) → 403 nếu gọi trực tiếp", async () => {
    const q = await makeQuestion();
    const exam = await makeExam([q]);
    const res = await api(`/api/student/exams/${exam.id}/attempts`, adminCookie, { method: "POST" });
    expect(res.status).toBe(403);
  });
});

describe("Start → Save → Resume → Submit flow đầy đủ", () => {
  it("toàn bộ vòng đời qua HTTP thật", async () => {
    const q1 = await makeQuestion("SINGLE_CHOICE");
    const q2 = await makeQuestion("SHORT_ANSWER");
    const exam = await makeExam([q1, q2]);

    // Start
    const startRes = await api(`/api/student/exams/${exam.id}/attempts`, studentACookie, { method: "POST" });
    expect(startRes.status).toBe(201);
    const { attemptId, resume } = await startRes.json();
    expect(resume).toBe(false);

    // Start lại (double click) → resume, không tạo attempt mới
    const startAgainRes = await api(`/api/student/exams/${exam.id}/attempts`, studentACookie, { method: "POST" });
    expect(startAgainRes.status).toBe(200);
    const startAgainBody = await startAgainRes.json();
    expect(startAgainBody.attemptId).toBe(attemptId);
    expect(startAgainBody.resume).toBe(true);

    // Save answer
    const saveRes = await api(`/api/student/attempts/${attemptId}/answers/${q1.id}`, studentACookie, {
      method: "PATCH",
      body: JSON.stringify({ selectedOptionId: q1.options[0].id }),
    });
    expect(saveRes.status).toBe(200);

    // Resume — GET attempt trả lại answer vừa lưu
    const getRes = await api(`/api/student/attempts/${attemptId}`, studentACookie);
    const attemptDetail = (await getRes.json()).attempt;
    expect(attemptDetail.status).toBe("IN_PROGRESS");
    expect(attemptDetail.answers.find((a: { questionId: string }) => a.questionId === q1.id).answered).toBe(true);
    const json = JSON.stringify(attemptDetail);
    expect(json).not.toContain("isCorrect");
    expect(json).not.toContain("correctAnswerText");

    // Question không thuộc Exam → reject
    const outsider = await makeQuestion("SINGLE_CHOICE");
    const invalidRes = await api(`/api/student/attempts/${attemptId}/answers/${outsider.id}`, studentACookie, {
      method: "PATCH",
      body: JSON.stringify({ selectedOptionId: outsider.options[0].id }),
    });
    expect(invalidRes.status).toBe(422);

    // Option sai (thuộc câu khác) → reject
    const wrongOptionRes = await api(`/api/student/attempts/${attemptId}/answers/${q1.id}`, studentACookie, {
      method: "PATCH",
      body: JSON.stringify({ selectedOptionId: outsider.options[0].id }),
    });
    expect(wrongOptionRes.status).toBe(422);

    // Submit
    const submitRes = await api(`/api/student/attempts/${attemptId}/submit`, studentACookie, { method: "POST" });
    expect(submitRes.status).toBe(200);
    expect((await submitRes.json()).status).toBe("SUBMITTED");

    // Submit lại → idempotent
    const submitAgainRes = await api(`/api/student/attempts/${attemptId}/submit`, studentACookie, { method: "POST" });
    expect(submitAgainRes.status).toBe(200);
    expect((await submitAgainRes.json()).status).toBe("SUBMITTED");

    // Save sau khi submit → 409
    const saveAfterSubmitRes = await api(`/api/student/attempts/${attemptId}/answers/${q2.id}`, studentACookie, {
      method: "PATCH",
      body: JSON.stringify({ answerText: "quá muộn" }),
    });
    expect(saveAfterSubmitRes.status).toBe(409);

    // Refresh — vẫn SUBMITTED
    const finalGetRes = await api(`/api/student/attempts/${attemptId}`, studentACookie);
    expect((await finalGetRes.json()).attempt.status).toBe("SUBMITTED");
  });
});

describe("maxAttempts qua HTTP", () => {
  it("Đề DRAFT (chưa publish) → Student không start được (404)", async () => {
    const q = await makeQuestion();
    const exam = await makeExam([q], { status: "DRAFT" });
    const res = await api(`/api/student/exams/${exam.id}/attempts`, studentACookie, { method: "POST" });
    expect(res.status).toBe(404);
  });

  it("maxAttempts=1 → sau khi submit, start lần nữa trả 409", async () => {
    const q = await makeQuestion();
    const exam = await makeExam([q], { maxAttempts: 1 });
    const startRes = await api(`/api/student/exams/${exam.id}/attempts`, studentBCookie, { method: "POST" });
    const { attemptId } = await startRes.json();
    await api(`/api/student/attempts/${attemptId}/submit`, studentBCookie, { method: "POST" });

    const secondStartRes = await api(`/api/student/exams/${exam.id}/attempts`, studentBCookie, { method: "POST" });
    expect(secondStartRes.status).toBe(409);
  });
});
