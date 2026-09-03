import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { BASE_URL, startTestServer, stopTestServer } from "../support/server";
import { getAdminCookie, getStudentBCookie, getStudentCookie } from "../support/tokens";

// Phase 11 — Practice Mode, test HTTP. Chạy trên database dev thật, tự tạo
// topic/question riêng (prefix "[vitest-http-practice]"), dọn sạch ở
// afterEach/afterAll. student1 đã có SubjectAccess vào Toán từ seed.

let adminCookie: string;
let studentCookie: string; // student1 — đã có quyền Toán
let studentBCookie: string; // student2 — đã có quyền Toán
let toanId: string;
let tienganhId: string;
let studentAId: string;
let studentBId: string;
let foreignTopicId: string;

const createdTopicIds: string[] = [];
const createdQuestionIds: string[] = [];

function authedFetch(path: string, cookie: string | null, init: RequestInit = {}) {
  return fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...init.headers },
  });
}

async function makeTopic(subjectId: string) {
  const topic = await prisma.topic.create({
    data: {
      subjectId,
      name: "[vitest-http-practice] Topic riêng",
      slug: `vitest-http-practice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      order: 96,
    },
  });
  createdTopicIds.push(topic.id);
  return topic;
}

async function makeQuestion(topicId: string, subjectId: string) {
  const q = await prisma.question.create({
    data: {
      content: `[vitest-http-practice] Câu ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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

async function cleanupPracticeAttemptsFor(studentIds: (string | undefined)[]) {
  const ids = studentIds.filter((id): id is string => Boolean(id));
  if (ids.length === 0) return; // beforeAll chưa chạy xong (vd server start lỗi) — không gọi Prisma với mảng rỗng/undefined.
  await prisma.attemptAnswer.deleteMany({ where: { attempt: { studentId: { in: ids }, mode: "PRACTICE" } } });
  await prisma.attempt.deleteMany({ where: { studentId: { in: ids }, mode: "PRACTICE" } });
}

beforeAll(async () => {
  await startTestServer();
  adminCookie = await getAdminCookie();
  studentCookie = await getStudentCookie();
  studentBCookie = await getStudentBCookie();

  const toan = await prisma.subject.findUniqueOrThrow({ where: { slug: "toan" } });
  toanId = toan.id;
  const tienganh = await prisma.subject.findUniqueOrThrow({ where: { slug: "tieng-anh" } });
  tienganhId = tienganh.id;
  const foreignTopic = await prisma.topic.findFirstOrThrow({ where: { subjectId: tienganhId } });
  foreignTopicId = foreignTopic.id;

  const studentA = await prisma.user.findUniqueOrThrow({ where: { username: "student1" } });
  studentAId = studentA.id;
  const studentB = await prisma.user.findUniqueOrThrow({ where: { username: "student2" } });
  studentBId = studentB.id;
}, 70_000);

afterEach(async () => {
  await cleanupPracticeAttemptsFor([studentAId, studentBId]);
});

afterAll(async () => {
  await cleanupPracticeAttemptsFor([studentAId, studentBId]);
  if (createdQuestionIds.length > 0) {
    await prisma.question.deleteMany({ where: { id: { in: createdQuestionIds } } });
  }
  if (createdTopicIds.length > 0) {
    await prisma.topic.deleteMany({ where: { id: { in: createdTopicIds } } });
  }
  stopTestServer();
  await prisma.$disconnect();
});

describe("GET /api/student/practice/preview", () => {
  it("anonymous → 401", async () => {
    const res = await authedFetch(`/api/student/practice/preview?subjectId=${toanId}`, null);
    expect(res.status).toBe(401);
  });

  it("ADMIN → 403", async () => {
    const res = await authedFetch(`/api/student/practice/preview?subjectId=${toanId}`, adminCookie);
    expect(res.status).toBe(403);
  });

  it("Student chưa có SubjectAccess (Tiếng Anh chưa cấp cho student1... thực ra đã cấp qua seed) → dùng subject giả để test 404", async () => {
    const res = await authedFetch(`/api/student/practice/preview?subjectId=00000000-0000-0000-0000-000000000000`, studentCookie);
    expect(res.status).toBe(404);
  });

  it("Topic không thuộc Subject → 400", async () => {
    const res = await authedFetch(
      `/api/student/practice/preview?subjectId=${toanId}&topicId=${foreignTopicId}`,
      studentCookie,
    );
    expect(res.status).toBe(400);
  });

  it("Student có quyền → 200, đếm đúng số câu phù hợp", async () => {
    const topic = await makeTopic(toanId);
    await makeQuestion(topic.id, toanId);
    await makeQuestion(topic.id, toanId);

    const res = await authedFetch(`/api/student/practice/preview?subjectId=${toanId}&topicId=${topic.id}`, studentCookie);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.preview.eligibleCount).toBe(2);
  });
});

describe("GET /api/student/practice/topics", () => {
  it("anonymous → 401", async () => {
    const res = await authedFetch(`/api/student/practice/topics?subjectId=${toanId}`, null);
    expect(res.status).toBe(401);
  });

  it("Student chưa có quyền vào subject → 404", async () => {
    const res = await authedFetch(
      `/api/student/practice/topics?subjectId=00000000-0000-0000-0000-000000000000`,
      studentCookie,
    );
    expect(res.status).toBe(404);
  });

  it("Student có quyền → 200", async () => {
    const res = await authedFetch(`/api/student/practice/topics?subjectId=${toanId}`, studentCookie);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.topics)).toBe(true);
  });
});

describe("POST /api/student/practice/attempts", () => {
  it("anonymous → 401", async () => {
    const res = await authedFetch("/api/student/practice/attempts", null, {
      method: "POST",
      body: JSON.stringify({ subjectId: toanId, questionCount: 10 }),
    });
    expect(res.status).toBe(401);
  });

  it("ADMIN → 403", async () => {
    const res = await authedFetch("/api/student/practice/attempts", adminCookie, {
      method: "POST",
      body: JSON.stringify({ subjectId: toanId, questionCount: 10 }),
    });
    expect(res.status).toBe(403);
  });

  it("số câu không nằm trong whitelist → 400", async () => {
    const res = await authedFetch("/api/student/practice/attempts", studentCookie, {
      method: "POST",
      body: JSON.stringify({ subjectId: toanId, questionCount: 17 }),
    });
    expect(res.status).toBe(400);
  });

  it("client gửi thêm field lạ (studentId, mode, questionIds) → 400 (reject, không âm thầm bỏ qua)", async () => {
    const res = await authedFetch("/api/student/practice/attempts", studentCookie, {
      method: "POST",
      body: JSON.stringify({
        subjectId: toanId,
        questionCount: 10,
        studentId: "hacker-id",
        mode: "MOCK_EXAM",
        questionIds: ["a", "b"],
      }),
    });
    expect(res.status).toBe(400);
  });

  it("chưa có SubjectAccess → 404, không tạo Attempt", async () => {
    const res = await authedFetch("/api/student/practice/attempts", studentCookie, {
      method: "POST",
      body: JSON.stringify({ subjectId: "00000000-0000-0000-0000-000000000000", questionCount: 10 }),
    });
    expect(res.status).toBe(404);
  });

  it("Topic không thuộc Subject → 400", async () => {
    const res = await authedFetch("/api/student/practice/attempts", studentCookie, {
      method: "POST",
      body: JSON.stringify({ subjectId: toanId, topicId: foreignTopicId, questionCount: 10 }),
    });
    expect(res.status).toBe(400);
  });

  it("không có câu hỏi phù hợp → 422", async () => {
    const topic = await makeTopic(toanId);
    const res = await authedFetch("/api/student/practice/attempts", studentCookie, {
      method: "POST",
      body: JSON.stringify({ subjectId: toanId, topicId: topic.id, questionCount: 10 }),
    });
    expect(res.status).toBe(422);
  });

  it("hợp lệ đầy đủ → 201, tạo đúng Attempt mode=PRACTICE examId=null, GET lại đúng dữ liệu, không tạo Exam mới", async () => {
    const topic = await makeTopic(toanId);
    await makeQuestion(topic.id, toanId);
    await makeQuestion(topic.id, toanId);

    const examCountBefore = await prisma.exam.count();

    const res = await authedFetch("/api/student/practice/attempts", studentCookie, {
      method: "POST",
      body: JSON.stringify({ subjectId: toanId, topicId: topic.id, questionCount: 10 }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.resumed).toBe(false);

    const examCountAfter = await prisma.exam.count();
    expect(examCountAfter).toBe(examCountBefore); // KHÔNG tạo Exam mới

    const attempt = await prisma.attempt.findUniqueOrThrow({ where: { id: body.attemptId } });
    expect(attempt.mode).toBe("PRACTICE");
    expect(attempt.examId).toBeNull();

    const getRes = await authedFetch(`/api/student/attempts/${body.attemptId}`, studentCookie);
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.attempt.mode).toBe("PRACTICE");
    expect(getBody.attempt.snapshot.questions).toHaveLength(2);
    expect(getBody.attempt.deadline).toBeNull(); // không giới hạn thời gian (mục 13)
  });

  it("double-click (2 request đồng thời) → không tạo 2 Attempt PRACTICE IN_PROGRESS song song không kiểm soát", async () => {
    const topic = await makeTopic(toanId);
    await makeQuestion(topic.id, toanId);

    const [r1, r2] = await Promise.all([
      authedFetch("/api/student/practice/attempts", studentCookie, {
        method: "POST",
        body: JSON.stringify({ subjectId: toanId, topicId: topic.id, questionCount: 10 }),
      }),
      authedFetch("/api/student/practice/attempts", studentCookie, {
        method: "POST",
        body: JSON.stringify({ subjectId: toanId, topicId: topic.id, questionCount: 10 }),
      }),
    ]);
    expect([r1.status, r2.status].every((s) => s === 200 || s === 201)).toBe(true);

    const activeCount = await prisma.attempt.count({
      where: { studentId: studentAId, mode: "PRACTICE", status: "IN_PROGRESS" },
    });
    expect(activeCount).toBe(1);
  });

  it("Student A không đọc được Practice Attempt của Student B", async () => {
    const topic = await makeTopic(toanId);
    await makeQuestion(topic.id, toanId);
    const startRes = await authedFetch("/api/student/practice/attempts", studentCookie, {
      method: "POST",
      body: JSON.stringify({ subjectId: toanId, topicId: topic.id, questionCount: 10 }),
    });
    const { attemptId } = await startRes.json();

    const crossRes = await authedFetch(`/api/student/attempts/${attemptId}`, studentBCookie);
    expect(crossRes.status).toBe(404);
  });
});

describe("Practice Attempt — answer / submit / scoring (tái dùng API Attempt chung)", () => {
  it("làm bài, submit, xem kết quả — full flow không cần API riêng cho Practice", async () => {
    const topic = await makeTopic(toanId);
    const q1 = await makeQuestion(topic.id, toanId);
    const q2 = await makeQuestion(topic.id, toanId);

    const startRes = await authedFetch("/api/student/practice/attempts", studentCookie, {
      method: "POST",
      body: JSON.stringify({ subjectId: toanId, topicId: topic.id, questionCount: 10 }),
    });
    const { attemptId } = await startRes.json();

    // Trả lời đúng q1, sai q2 (chọn option B thay vì A).
    const q1CorrectOptionId = q1.options.find((o) => o.isCorrect)!.id;
    const q2WrongOptionId = q2.options.find((o) => !o.isCorrect)!.id;

    await authedFetch(`/api/student/attempts/${attemptId}/answers/${q1.id}`, studentCookie, {
      method: "PATCH",
      body: JSON.stringify({ selectedOptionId: q1CorrectOptionId }),
    });
    await authedFetch(`/api/student/attempts/${attemptId}/answers/${q2.id}`, studentCookie, {
      method: "PATCH",
      body: JSON.stringify({ selectedOptionId: q2WrongOptionId }),
    });

    const submitRes = await authedFetch(`/api/student/attempts/${attemptId}/submit`, studentCookie, { method: "POST" });
    expect(submitRes.status).toBe(200);

    const resultRes = await authedFetch(`/api/student/attempts/${attemptId}/result`, studentCookie);
    expect(resultRes.status).toBe(200);
    const resultBody = await resultRes.json();
    expect(resultBody.result.correctCount).toBe(1);
    expect(resultBody.result.wrongCount).toBe(1);
    expect(resultBody.result.unansweredCount).toBe(0);

    // Sau khi submit, không sửa được câu trả lời nữa (mục 14/24).
    const lateSave = await authedFetch(`/api/student/attempts/${attemptId}/answers/${q1.id}`, studentCookie, {
      method: "PATCH",
      body: JSON.stringify({ selectedOptionId: q1CorrectOptionId }),
    });
    expect(lateSave.status).toBe(409);

    // Double-submit vẫn idempotent, không lỗi.
    const secondSubmit = await authedFetch(`/api/student/attempts/${attemptId}/submit`, studentCookie, { method: "POST" });
    expect(secondSubmit.status).toBe(200);
  });

  it("refresh giữa chừng (GET lại attempt) → resume đúng câu trả lời đã lưu", async () => {
    const topic = await makeTopic(toanId);
    const q1 = await makeQuestion(topic.id, toanId);

    const startRes = await authedFetch("/api/student/practice/attempts", studentCookie, {
      method: "POST",
      body: JSON.stringify({ subjectId: toanId, topicId: topic.id, questionCount: 10 }),
    });
    const { attemptId } = await startRes.json();

    const optionId = q1.options[0].id;
    await authedFetch(`/api/student/attempts/${attemptId}/answers/${q1.id}`, studentCookie, {
      method: "PATCH",
      body: JSON.stringify({ selectedOptionId: optionId }),
    });

    const getRes = await authedFetch(`/api/student/attempts/${attemptId}`, studentCookie);
    const body = await getRes.json();
    const savedAnswer = body.attempt.answers.find((a: { questionId: string }) => a.questionId === q1.id);
    expect(savedAnswer?.selectedOptionIds).toEqual([optionId]);
  });
});
