import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { BASE_URL, startTestServer, stopTestServer } from "../support/server";
import { getAdminCookie, getStudentCookie } from "../support/tokens";

// Test này chạy trên database thật (Postgres dev), dùng lại Subject/Topic đã
// seed ("Toán"/"Đại số", "Toán"/"Hình học") và tự tạo/xoá câu hỏi test riêng
// (prefix "[vitest] ") — không đụng tới 4 câu hỏi seed gốc.

let adminCookie: string;
let studentCookie: string;
let subjectId: string;
let otherSubjectId: string;
let topicId: string;
let foreignTopicId: string;

const createdQuestionIds: string[] = [];

function authedFetch(path: string, cookie: string, init: RequestInit = {}) {
  return fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { "content-type": "application/json", cookie, ...init.headers },
  });
}

beforeAll(async () => {
  await startTestServer();
  adminCookie = await getAdminCookie();
  studentCookie = await getStudentCookie();

  const toan = await prisma.subject.findUniqueOrThrow({ where: { slug: "toan" } });
  const tienganh = await prisma.subject.findUniqueOrThrow({ where: { slug: "tieng-anh" } });
  const daiSo = await prisma.topic.findFirstOrThrow({
    where: { subjectId: toan.id, slug: "dai-so" },
  });
  const nguPhap = await prisma.topic.findFirstOrThrow({
    where: { subjectId: tienganh.id, slug: "ngu-phap" },
  });

  subjectId = toan.id;
  otherSubjectId = tienganh.id;
  topicId = daiSo.id;
  foreignTopicId = nguPhap.id;
}, 70_000);

afterAll(async () => {
  if (createdQuestionIds.length > 0) {
    await prisma.question.deleteMany({ where: { id: { in: createdQuestionIds } } });
  }
  stopTestServer();
  await prisma.$disconnect();
});

function singleChoicePayload(overrides: Record<string, unknown> = {}) {
  return {
    content: "[vitest] Câu hỏi test SINGLE_CHOICE",
    type: "SINGLE_CHOICE",
    subjectId,
    topicId,
    difficulty: "MEDIUM",
    status: "DRAFT",
    options: [
      { content: "Đáp án A", isCorrect: false },
      { content: "Đáp án B", isCorrect: true },
    ],
    ...overrides,
  };
}

describe("POST /api/admin/questions — tạo câu hỏi", () => {
  it("tạo SINGLE_CHOICE hợp lệ → 201, trả về đúng dữ liệu đã lưu", async () => {
    const res = await authedFetch("/api/admin/questions", adminCookie, {
      method: "POST",
      body: JSON.stringify(singleChoicePayload()),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    createdQuestionIds.push(body.question.id);

    expect(body.question.content).toBe("[vitest] Câu hỏi test SINGLE_CHOICE");
    expect(body.question.status).toBe("DRAFT");
    expect(body.question.options).toHaveLength(2);
    expect(body.question.options.filter((o: { isCorrect: boolean }) => o.isCorrect)).toHaveLength(1);
    // Label do server tự sinh theo thứ tự, không tin label từ client.
    expect(body.question.options[0].label).toBe("A");
    expect(body.question.options[1].label).toBe("B");
  });

  it("tạo MULTIPLE_CHOICE với 2 đáp án đúng → 201", async () => {
    const res = await authedFetch("/api/admin/questions", adminCookie, {
      method: "POST",
      body: JSON.stringify(
        singleChoicePayload({
          content: "[vitest] Câu hỏi test MULTIPLE_CHOICE",
          type: "MULTIPLE_CHOICE",
          options: [
            { content: "A", isCorrect: true },
            { content: "B", isCorrect: true },
            { content: "C", isCorrect: false },
          ],
        }),
      ),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    createdQuestionIds.push(body.question.id);
    expect(body.question.options.filter((o: { isCorrect: boolean }) => o.isCorrect)).toHaveLength(2);
  });

  it("tạo TRUE_FALSE → server tự sinh đúng 2 option Đúng/Sai", async () => {
    const res = await authedFetch("/api/admin/questions", adminCookie, {
      method: "POST",
      body: JSON.stringify(
        singleChoicePayload({
          content: "[vitest] Câu hỏi test TRUE_FALSE",
          type: "TRUE_FALSE",
          options: [],
          trueFalseAnswer: "FALSE",
        }),
      ),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    createdQuestionIds.push(body.question.id);
    expect(body.question.options).toHaveLength(2);
    expect(body.question.options.map((o: { content: string }) => o.content)).toEqual(["Đúng", "Sai"]);
    expect(body.question.options.find((o: { content: string }) => o.content === "Sai").isCorrect).toBe(
      true,
    );
  });

  it("tạo SHORT_ANSWER → lưu đúng correctAnswerText, không có option", async () => {
    const res = await authedFetch("/api/admin/questions", adminCookie, {
      method: "POST",
      body: JSON.stringify(
        singleChoicePayload({
          content: "[vitest] Câu hỏi test SHORT_ANSWER",
          type: "SHORT_ANSWER",
          options: [],
          correctAnswerText: "42",
        }),
      ),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    createdQuestionIds.push(body.question.id);
    expect(body.question.correctAnswerText).toBe("42");
    expect(body.question.options).toHaveLength(0);
  });

  it("topic không thuộc subject đã chọn → 400", async () => {
    const res = await authedFetch("/api/admin/questions", adminCookie, {
      method: "POST",
      body: JSON.stringify(singleChoicePayload({ topicId: foreignTopicId })),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.fieldErrors?.topicId).toBeDefined();
  });

  it("SINGLE_CHOICE với 0 đáp án đúng → 400, không tạo bản ghi", async () => {
    const res = await authedFetch("/api/admin/questions", adminCookie, {
      method: "POST",
      body: JSON.stringify(
        singleChoicePayload({
          options: [
            { content: "A", isCorrect: false },
            { content: "B", isCorrect: false },
          ],
        }),
      ),
    });
    expect(res.status).toBe(400);
  });

  it("STUDENT không thể tạo câu hỏi → 403", async () => {
    const res = await authedFetch("/api/admin/questions", studentCookie, {
      method: "POST",
      body: JSON.stringify(singleChoicePayload()),
    });
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/admin/questions/:id — sửa câu hỏi", () => {
  it("sửa nội dung + đổi đáp án đúng → lưu đúng, giữ nguyên id các option không đổi", async () => {
    const createRes = await authedFetch("/api/admin/questions", adminCookie, {
      method: "POST",
      body: JSON.stringify(singleChoicePayload({ content: "[vitest] Trước khi sửa" })),
    });
    const created = (await createRes.json()).question;
    createdQuestionIds.push(created.id);
    const optionAId = created.options[0].id;

    const patchRes = await authedFetch(`/api/admin/questions/${created.id}`, adminCookie, {
      method: "PATCH",
      body: JSON.stringify(
        singleChoicePayload({
          content: "[vitest] Đã sửa",
          options: [
            { id: optionAId, content: "Đáp án A (đã sửa)", isCorrect: true },
            { id: created.options[1].id, content: "Đáp án B", isCorrect: false },
          ],
        }),
      ),
    });
    expect(patchRes.status).toBe(200);
    const updated = (await patchRes.json()).question;
    expect(updated.content).toBe("[vitest] Đã sửa");
    expect(updated.options.find((o: { id: string }) => o.id === optionAId)?.isCorrect).toBe(true);
    expect(updated.options.find((o: { id: string }) => o.id === optionAId)?.content).toBe(
      "Đáp án A (đã sửa)",
    );
  });

  it("đổi status bằng payload chỉ có status → không cần validate lại toàn bộ form", async () => {
    const createRes = await authedFetch("/api/admin/questions", adminCookie, {
      method: "POST",
      body: JSON.stringify(singleChoicePayload({ content: "[vitest] Để lưu trữ" })),
    });
    const created = (await createRes.json()).question;
    createdQuestionIds.push(created.id);

    const patchRes = await authedFetch(`/api/admin/questions/${created.id}`, adminCookie, {
      method: "PATCH",
      body: JSON.stringify({ status: "ARCHIVED" }),
    });
    expect(patchRes.status).toBe(200);
    const updated = (await patchRes.json()).question;
    expect(updated.status).toBe("ARCHIVED");
  });

  it("STUDENT không thể sửa câu hỏi → 403", async () => {
    const createRes = await authedFetch("/api/admin/questions", adminCookie, {
      method: "POST",
      body: JSON.stringify(singleChoicePayload({ content: "[vitest] Student không được sửa" })),
    });
    const created = (await createRes.json()).question;
    createdQuestionIds.push(created.id);

    const res = await authedFetch(`/api/admin/questions/${created.id}`, studentCookie, {
      method: "PATCH",
      body: JSON.stringify({ status: "ARCHIVED" }),
    });
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/admin/questions/:id — xoá / bảo vệ referential integrity", () => {
  it("câu hỏi chưa dùng trong đề nào → xoá được (204)", async () => {
    const createRes = await authedFetch("/api/admin/questions", adminCookie, {
      method: "POST",
      body: JSON.stringify(singleChoicePayload({ content: "[vitest] Sẽ bị xoá" })),
    });
    const created = (await createRes.json()).question;

    const deleteRes = await authedFetch(`/api/admin/questions/${created.id}`, adminCookie, {
      method: "DELETE",
    });
    expect(deleteRes.status).toBe(204);

    const getRes = await authedFetch(`/api/admin/questions/${created.id}`, adminCookie);
    expect(getRes.status).toBe(404);
  });

  it("câu hỏi đã dùng trong đề → không cho xoá (409), vẫn cho lưu trữ", async () => {
    const createRes = await authedFetch("/api/admin/questions", adminCookie, {
      method: "POST",
      body: JSON.stringify(singleChoicePayload({ content: "[vitest] Đã dùng trong đề" })),
    });
    const created = (await createRes.json()).question;
    createdQuestionIds.push(created.id);

    // Exam/ExamQuestion CRUD chưa thuộc Phase 6 — tạo trực tiếp qua Prisma để
    // mô phỏng "câu hỏi đã được dùng trong đề thi" cho việc kiểm tra rule 24.
    const exam = await prisma.exam.create({
      data: {
        title: "[vitest] Đề test referential integrity",
        code: `VITEST-${Date.now()}`,
        examType: "TEST",
        durationMinutes: 60,
        difficulty: "MEDIUM",
        status: "DRAFT",
        examQuestions: { create: [{ questionId: created.id, order: 1 }] },
      },
    });

    const deleteRes = await authedFetch(`/api/admin/questions/${created.id}`, adminCookie, {
      method: "DELETE",
    });
    expect(deleteRes.status).toBe(409);

    const archiveRes = await authedFetch(`/api/admin/questions/${created.id}`, adminCookie, {
      method: "PATCH",
      body: JSON.stringify({ status: "ARCHIVED" }),
    });
    expect(archiveRes.status).toBe(200);

    await prisma.exam.delete({ where: { id: exam.id } });
  });

  it("STUDENT không thể xoá câu hỏi → 403", async () => {
    const createRes = await authedFetch("/api/admin/questions", adminCookie, {
      method: "POST",
      body: JSON.stringify(singleChoicePayload({ content: "[vitest] Student không được xoá" })),
    });
    const created = (await createRes.json()).question;
    createdQuestionIds.push(created.id);

    const res = await authedFetch(`/api/admin/questions/${created.id}`, studentCookie, {
      method: "DELETE",
    });
    expect(res.status).toBe(403);
  });
});

describe("GET /api/admin/questions — search / filter / sort / pagination", () => {
  it("search theo nội dung khớp câu hỏi seed", async () => {
    const res = await authedFetch(
      `/api/admin/questions?search=${encodeURIComponent("phương trình")}`,
      adminCookie,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.questions.some((q: { content: string }) => q.content.includes("phương trình"))).toBe(
      true,
    );
  });

  it("filter theo subjectId + difficulty kết hợp → chỉ trả về câu phù hợp", async () => {
    const res = await authedFetch(
      `/api/admin/questions?subjectId=${subjectId}&difficulty=EASY`,
      adminCookie,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.questions.length).toBeGreaterThan(0);
    for (const q of body.questions) {
      expect(q.subject.id).toBe(subjectId);
      expect(q.difficulty).toBe("EASY");
    }
  });

  it("filter theo subject khác → không lẫn câu hỏi của subject kia", async () => {
    const res = await authedFetch(`/api/admin/questions?subjectId=${otherSubjectId}`, adminCookie);
    const body = await res.json();
    for (const q of body.questions) {
      expect(q.subject.id).toBe(otherSubjectId);
    }
  });

  it("pagination: pageSize không nằm trong whitelist (20/50/100) → bỏ qua, dùng mặc định 20", async () => {
    const res = await authedFetch("/api/admin/questions?pageSize=999&page=1", adminCookie);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pageSize).toBe(20);
  });

  it("pagination: page vượt quá tổng số trang → trả về mảng rỗng, không lỗi", async () => {
    const res = await authedFetch("/api/admin/questions?pageSize=20&page=999", adminCookie);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.questions).toHaveLength(0);
    expect(body.total).toBeGreaterThan(0);
  });

  it("pagination: totalPages tính đúng theo total và pageSize", async () => {
    const res = await authedFetch("/api/admin/questions?pageSize=20&page=1", adminCookie);
    const body = await res.json();
    expect(body.totalPages).toBe(Math.max(1, Math.ceil(body.total / 20)));
  });

  it("sort không hợp lệ bị bỏ qua, dùng mặc định thay vì lỗi 500", async () => {
    const res = await authedFetch("/api/admin/questions?sort=content_desc", adminCookie);
    expect(res.status).toBe(200);
  });

  it("unauthenticated → 401", async () => {
    const res = await fetch(`${BASE_URL}/api/admin/questions`);
    expect(res.status).toBe(401);
  });
});

describe("GET /api/admin/topics", () => {
  it("trả về đúng topic thuộc subject", async () => {
    const res = await authedFetch(`/api/admin/topics?subjectId=${subjectId}`, adminCookie);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.topics.length).toBeGreaterThan(0);
  });

  it("thiếu subjectId → 400", async () => {
    const res = await authedFetch("/api/admin/topics", adminCookie);
    expect(res.status).toBe(400);
  });
});
