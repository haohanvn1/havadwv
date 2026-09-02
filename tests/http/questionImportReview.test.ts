import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { BASE_URL, startTestServer, stopTestServer } from "../support/server";
import { getAdminCookie, getStudentCookie } from "../support/tokens";

// Dùng AI_PROVIDER=demo (không gọi AI thật — xem server/services/ai/demoQuestionExtractor.ts)
// cho server test riêng của file này. Đặt TRƯỚC startTestServer() để child
// process `next dev` kế thừa đúng biến môi trường lúc spawn.
process.env.AI_PROVIDER = "demo";

let adminCookie: string;
let studentCookie: string;
let subjectId: string;
let topicId: string;
let uploaderId: string;

const createdImportedFileIds: string[] = [];
const createdQuestionIds: string[] = [];

beforeAll(async () => {
  await startTestServer();
  adminCookie = await getAdminCookie();
  studentCookie = await getStudentCookie();

  const subject = await prisma.subject.findUniqueOrThrow({ where: { slug: "toan" } });
  const topic = await prisma.topic.findFirstOrThrow({ where: { subjectId: subject.id } });
  subjectId = subject.id;
  topicId = topic.id;
  const admin = await prisma.user.findUniqueOrThrow({ where: { username: "admin" } });
  uploaderId = admin.id;
}, 70_000);

afterAll(async () => {
  if (createdQuestionIds.length > 0) {
    await prisma.question.deleteMany({ where: { id: { in: createdQuestionIds } } });
  }
  if (createdImportedFileIds.length > 0) {
    await prisma.importedFile.deleteMany({ where: { id: { in: createdImportedFileIds } } });
  }
  stopTestServer();
  await prisma.$disconnect();
});

function authedFetch(path: string, cookie: string, init: RequestInit = {}) {
  return fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { "content-type": "application/json", cookie, ...init.headers },
  });
}

/** Tạo sẵn 1 ImportJob DONE + 1 draft — bỏ qua pipeline upload (đã test riêng ở questionImports.test.ts), tập trung vào review/approve/reject của Phase 7B. */
async function createJobWithDraft(rawText: string) {
  const file = await prisma.importedFile.create({
    data: {
      filename: "[vitest-review] fixture.pdf",
      storagePath: `imports/vitest-review/${crypto.randomUUID()}/original.pdf`,
      mimeType: "application/pdf",
      sizeBytes: rawText.length,
      uploadedById: uploaderId,
    },
  });
  createdImportedFileIds.push(file.id);

  const job = await prisma.importJob.create({
    data: { importedFileId: file.id, status: "DONE", totalExtracted: 1 },
  });

  const draft = await prisma.importQuestionDraft.create({
    data: {
      importJobId: job.id,
      rawText,
      parsedContent: {
        detection: {
          questionNumberLabel: "1",
          pageNumber: 1,
          detectionMethod: "cau-prefix",
          confidence: "high",
          warning: null,
          order: 0,
        },
      },
    },
  });

  return { job, draft };
}

describe("Authorization — mọi endpoint review/extract/approve/reject", () => {
  it("chưa đăng nhập → 401 trên các endpoint chính", async () => {
    const { job, draft } = await createJobWithDraft("Câu 1. Test auth.");
    const endpoints = [
      { path: `/api/admin/question-imports/${job.id}/review`, method: "GET" },
      { path: `/api/admin/question-imports/${job.id}/extract`, method: "POST" },
      { path: `/api/admin/question-imports/${job.id}/extract/${draft.id}`, method: "POST" },
      { path: `/api/admin/question-imports/${job.id}/drafts/${draft.id}`, method: "PATCH" },
      { path: `/api/admin/question-imports/${job.id}/drafts/${draft.id}/approve`, method: "POST" },
      { path: `/api/admin/question-imports/${job.id}/drafts/${draft.id}/reject`, method: "POST" },
    ];
    for (const { path, method } of endpoints) {
      const res = await fetch(`${BASE_URL}${path}`, { method });
      expect(res.status, `${method} ${path}`).toBe(401);
    }
  });

  it("STUDENT → 403 trên các endpoint chính", async () => {
    const { job, draft } = await createJobWithDraft("Câu 1. Test auth student.");
    const endpoints = [
      { path: `/api/admin/question-imports/${job.id}/review`, method: "GET" },
      { path: `/api/admin/question-imports/${job.id}/extract/${draft.id}`, method: "POST" },
      { path: `/api/admin/question-imports/${job.id}/drafts/${draft.id}/approve`, method: "POST" },
      { path: `/api/admin/question-imports/${job.id}/drafts/${draft.id}/reject`, method: "POST" },
    ];
    for (const { path, method } of endpoints) {
      const res = await authedFetch(path, studentCookie, { method });
      expect(res.status, `${method} ${path}`).toBe(403);
    }
  });

  it("ADMIN → được phép truy cập trang review", async () => {
    const { job } = await createJobWithDraft("Câu 1. Test auth admin.");
    const res = await fetch(`${BASE_URL}/admin/question-bank/import/${job.id}/review`, {
      headers: { cookie: adminCookie },
      redirect: "manual",
    });
    expect(res.status).toBe(200);
  });

  it("STUDENT → bị chặn khỏi trang review", async () => {
    const { job } = await createJobWithDraft("Câu 1. Test auth student page.");
    const res = await fetch(`${BASE_URL}/admin/question-bank/import/${job.id}/review`, {
      headers: { cookie: studentCookie },
      redirect: "manual",
    });
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).not.toContain("/admin");
  });
});

describe("AI extraction (demo provider — không gọi AI thật)", () => {
  it("extract 1 draft → aiExtraction DONE, review được khởi tạo", async () => {
    const { job, draft } = await createJobWithDraft("Câu 1. 2+2=? *A. 3 B. 4 C. 5 D. 6");
    const res = await authedFetch(`/api/admin/question-imports/${job.id}/extract/${draft.id}`, adminCookie, {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    const content = body.draft.parsedContent;
    expect(content.aiExtraction.status).toBe("DONE");
    expect(content.review.questionType).toBe("SINGLE_CHOICE");
    expect(content.review.options.some((o: { isCorrect: boolean }) => o.isCorrect)).toBe(true);
  });

  it("extract tất cả draft trong job (batch)", async () => {
    const { job } = await createJobWithDraft("Câu 1. Tính 1+1. Đáp án: 2");
    const res = await authedFetch(`/api/admin/question-imports/${job.id}/extract`, adminCookie, {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.succeeded).toBe(1);
    expect(body.failed).toBe(0);
  });

  it("draft đã APPROVED → 409 khi cố phân tích lại", async () => {
    const { job, draft } = await createJobWithDraft("Câu 1. Đã duyệt.");
    await prisma.importQuestionDraft.update({ where: { id: draft.id }, data: { status: "APPROVED" } });
    const res = await authedFetch(`/api/admin/question-imports/${job.id}/extract/${draft.id}`, adminCookie, {
      method: "POST",
    });
    expect(res.status).toBe(409);
  });
});

describe("Save draft (PATCH) — không bao giờ tạo Question", () => {
  it("lưu chỉnh sửa của Admin thành công, KHÔNG tạo Question", async () => {
    const { job, draft } = await createJobWithDraft("Câu 1. Nội dung gốc.");
    const beforeCount = await prisma.question.count();

    const res = await authedFetch(`/api/admin/question-imports/${job.id}/drafts/${draft.id}`, adminCookie, {
      method: "PATCH",
      body: JSON.stringify({
        questionText: "Nội dung đã chỉnh sửa",
        questionType: "SINGLE_CHOICE",
        options: [
          { label: "A", text: "Sai", isCorrect: false },
          { label: "B", text: "Đúng", isCorrect: true },
        ],
        correctAnswerText: null,
        explanation: null,
        cognitiveLevel: null,
        tags: ["test"],
        subjectId,
        topicId,
        difficulty: "EASY",
      }),
    });
    expect(res.status).toBe(200);

    const afterCount = await prisma.question.count();
    expect(afterCount).toBe(beforeCount);

    const fresh = await prisma.importQuestionDraft.findUniqueOrThrow({ where: { id: draft.id } });
    expect(fresh.status).toBe("PENDING");
    expect((fresh.parsedContent as { review: { questionText: string } }).review.questionText).toBe(
      "Nội dung đã chỉnh sửa",
    );
  });

  it("topic không thuộc subject đã chọn → 400", async () => {
    const { job, draft } = await createJobWithDraft("Câu 1. Test.");
    const otherSubject = await prisma.subject.findUniqueOrThrow({ where: { slug: "tieng-anh" } });
    const foreignTopic = await prisma.topic.findFirstOrThrow({ where: { subjectId: otherSubject.id } });

    const res = await authedFetch(`/api/admin/question-imports/${job.id}/drafts/${draft.id}`, adminCookie, {
      method: "PATCH",
      body: JSON.stringify({
        questionText: "Test",
        questionType: "SHORT_ANSWER",
        options: [],
        correctAnswerText: "x",
        explanation: null,
        cognitiveLevel: null,
        tags: [],
        subjectId,
        topicId: foreignTopic.id,
        difficulty: "EASY",
      }),
    });
    expect(res.status).toBe(400);
  });
});

describe("Approve — tạo Question thật, atomic, chống duplicate", () => {
  it("approve draft hợp lệ → tạo Question + QuestionOption đúng, cập nhật draft", async () => {
    const { job, draft } = await createJobWithDraft("Câu 1. Approve test SINGLE_CHOICE.");

    await authedFetch(`/api/admin/question-imports/${job.id}/drafts/${draft.id}`, adminCookie, {
      method: "PATCH",
      body: JSON.stringify({
        questionText: "[vitest-review] Approve test SINGLE_CHOICE",
        questionType: "SINGLE_CHOICE",
        options: [
          { label: "A", text: "Sai", isCorrect: false },
          { label: "B", text: "Đúng", isCorrect: true },
        ],
        correctAnswerText: null,
        explanation: "Giải thích test",
        cognitiveLevel: null,
        tags: ["vitest"],
        subjectId,
        topicId,
        difficulty: "EASY",
      }),
    });

    const res = await authedFetch(
      `/api/admin/question-imports/${job.id}/drafts/${draft.id}/approve`,
      adminCookie,
      { method: "POST" },
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.alreadyApproved).toBe(false);
    createdQuestionIds.push(body.question.id);

    expect(body.question.content).toBe("[vitest-review] Approve test SINGLE_CHOICE");
    expect(body.question.status).toBe("ACTIVE");
    expect(body.question.options).toHaveLength(2);
    expect(body.question.options.filter((o: { isCorrect: boolean }) => o.isCorrect)).toHaveLength(1);

    const freshDraft = await prisma.importQuestionDraft.findUniqueOrThrow({ where: { id: draft.id } });
    expect(freshDraft.status).toBe("APPROVED");
    expect(freshDraft.approvedQuestionId).toBe(body.question.id);
    expect(freshDraft.reviewedById).not.toBeNull();
    expect(freshDraft.reviewedAt).not.toBeNull();
  });

  it("approve TRUE_FALSE hợp lệ (Admin tự soạn qua Save, không phụ thuộc AI)", async () => {
    const { job, draft } = await createJobWithDraft("Câu 1. Approve test TRUE_FALSE.");
    await authedFetch(`/api/admin/question-imports/${job.id}/drafts/${draft.id}`, adminCookie, {
      method: "PATCH",
      body: JSON.stringify({
        questionText: "[vitest-review] Approve test TRUE_FALSE",
        questionType: "TRUE_FALSE",
        options: [
          { label: "A", text: "Đúng", isCorrect: true },
          { label: "B", text: "Sai", isCorrect: false },
        ],
        correctAnswerText: null,
        explanation: null,
        cognitiveLevel: null,
        tags: [],
        subjectId,
        topicId,
        difficulty: "MEDIUM",
      }),
    });

    const res = await authedFetch(
      `/api/admin/question-imports/${job.id}/drafts/${draft.id}/approve`,
      adminCookie,
      { method: "POST" },
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    createdQuestionIds.push(body.question.id);
    expect(body.question.type).toBe("TRUE_FALSE");
    expect(body.question.options.find((o: { content: string }) => o.content === "Đúng").isCorrect).toBe(true);
  });

  it("approve 2 lần liên tiếp → KHÔNG tạo Question trùng lặp, lần 2 trả lại đúng Question cũ", async () => {
    const { job, draft } = await createJobWithDraft("Câu 1. Double approve test.");
    await authedFetch(`/api/admin/question-imports/${job.id}/drafts/${draft.id}`, adminCookie, {
      method: "PATCH",
      body: JSON.stringify({
        questionText: "[vitest-review] Double approve test",
        questionType: "SHORT_ANSWER",
        options: [],
        correctAnswerText: "42",
        explanation: null,
        cognitiveLevel: null,
        tags: [],
        subjectId,
        topicId,
        difficulty: "HARD",
      }),
    });

    const firstRes = await authedFetch(
      `/api/admin/question-imports/${job.id}/drafts/${draft.id}/approve`,
      adminCookie,
      { method: "POST" },
    );
    const firstBody = await firstRes.json();
    createdQuestionIds.push(firstBody.question.id);

    const secondRes = await authedFetch(
      `/api/admin/question-imports/${job.id}/drafts/${draft.id}/approve`,
      adminCookie,
      { method: "POST" },
    );
    expect(secondRes.status).toBe(200);
    const secondBody = await secondRes.json();
    expect(secondBody.alreadyApproved).toBe(true);
    expect(secondBody.question.id).toBe(firstBody.question.id);

    const totalWithThisContent = await prisma.question.count({
      where: { content: "[vitest-review] Double approve test" },
    });
    expect(totalWithThisContent).toBe(1);
  });

  it("thiếu Subject/Topic/Difficulty → 400, KHÔNG tạo Question (không có bản ghi nửa chừng)", async () => {
    const { job, draft } = await createJobWithDraft("Câu 1. Thiếu dữ liệu.");
    const beforeCount = await prisma.question.count();

    const res = await authedFetch(
      `/api/admin/question-imports/${job.id}/drafts/${draft.id}/approve`,
      adminCookie,
      { method: "POST" },
    );
    expect(res.status).toBe(400);

    const afterCount = await prisma.question.count();
    expect(afterCount).toBe(beforeCount);

    const freshDraft = await prisma.importQuestionDraft.findUniqueOrThrow({ where: { id: draft.id } });
    expect(freshDraft.status).toBe("PENDING");
  });

  it("SINGLE_CHOICE với 0 đáp án đúng → 400 (tái sử dụng validator Phase 6), KHÔNG tạo Question", async () => {
    const { job, draft } = await createJobWithDraft("Câu 1. Không có đáp án đúng.");
    await authedFetch(`/api/admin/question-imports/${job.id}/drafts/${draft.id}`, adminCookie, {
      method: "PATCH",
      body: JSON.stringify({
        questionText: "Không có đáp án đúng",
        questionType: "SINGLE_CHOICE",
        options: [
          { label: "A", text: "A", isCorrect: false },
          { label: "B", text: "B", isCorrect: false },
        ],
        correctAnswerText: null,
        explanation: null,
        cognitiveLevel: null,
        tags: [],
        subjectId,
        topicId,
        difficulty: "EASY",
      }),
    });

    const beforeCount = await prisma.question.count();
    const res = await authedFetch(
      `/api/admin/question-imports/${job.id}/drafts/${draft.id}/approve`,
      adminCookie,
      { method: "POST" },
    );
    expect(res.status).toBe(400);
    expect(await prisma.question.count()).toBe(beforeCount);
  });

  it("STUDENT không thể approve → 403, không tạo Question", async () => {
    const { job, draft } = await createJobWithDraft("Câu 1. Student approve test.");
    const beforeCount = await prisma.question.count();
    const res = await authedFetch(
      `/api/admin/question-imports/${job.id}/drafts/${draft.id}/approve`,
      studentCookie,
      { method: "POST" },
    );
    expect(res.status).toBe(403);
    expect(await prisma.question.count()).toBe(beforeCount);
  });
});

describe("Reject", () => {
  it("reject draft PENDING với lý do → status REJECTED, lưu lý do, KHÔNG tạo Question", async () => {
    const { job, draft } = await createJobWithDraft("Câu 1. Reject test.");
    const beforeCount = await prisma.question.count();

    const res = await authedFetch(`/api/admin/question-imports/${job.id}/drafts/${draft.id}/reject`, adminCookie, {
      method: "POST",
      body: JSON.stringify({ reason: "Duplicate question" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.draft.status).toBe("REJECTED");
    expect((body.draft.parsedContent as { rejectReason: string }).rejectReason).toBe("Duplicate question");
    expect(await prisma.question.count()).toBe(beforeCount);
  });

  it("reject draft đã APPROVED → 409", async () => {
    const { job, draft } = await createJobWithDraft("Câu 1. Reject-after-approve test.");
    await prisma.importQuestionDraft.update({ where: { id: draft.id }, data: { status: "APPROVED" } });
    const res = await authedFetch(`/api/admin/question-imports/${job.id}/drafts/${draft.id}/reject`, adminCookie, {
      method: "POST",
    });
    expect(res.status).toBe(409);
  });
});

describe("Review data & retry-blocked-after-approve", () => {
  it("GET review trả về đúng summary", async () => {
    const { job } = await createJobWithDraft("Câu 1. Summary test.");
    const res = await authedFetch(`/api/admin/question-imports/${job.id}/review`, adminCookie);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary.total).toBe(1);
    expect(body.summary.needsReview).toBe(1);
  });

  it("job có draft APPROVED → retry (Phase 7A) bị chặn 409", async () => {
    const { job, draft } = await createJobWithDraft("Câu 1. Retry-blocked test.");
    await prisma.importQuestionDraft.update({ where: { id: draft.id }, data: { status: "APPROVED" } });

    const res = await authedFetch(`/api/admin/question-imports/${job.id}/retry`, adminCookie, {
      method: "POST",
    });
    expect(res.status).toBe(409);
  });
});
