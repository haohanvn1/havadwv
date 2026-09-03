import path from "node:path";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { BASE_URL, startTestServer, stopTestServer } from "../support/server";
import { getAdminCookie, getStudentCookie } from "../support/tokens";

// Test này chạy trên database thật (Postgres dev), upload file fixture thật
// (tests/fixtures/sample.pdf, sample.docx) qua HTTP thật — tự dọn
// ImportedFile/ImportJob/ImportQuestionDraft đã tạo ra sau khi chạy xong.

const FIXTURES_DIR = path.join(process.cwd(), "tests", "fixtures");

let adminCookie: string;
let studentCookie: string;
const createdImportedFileIds: string[] = [];

beforeAll(async () => {
  await startTestServer();
  adminCookie = await getAdminCookie();
  studentCookie = await getStudentCookie();
}, 70_000);

afterAll(async () => {
  if (createdImportedFileIds.length > 0) {
    await prisma.importedFile.deleteMany({ where: { id: { in: createdImportedFileIds } } });
  }
  stopTestServer();
  await prisma.$disconnect();
});

function uploadForm(filename: string, mimeType: string, buffer: Buffer) {
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
  formData.append("file", blob, filename);
  return formData;
}

async function upload(cookie: string, filename: string, mimeType: string, buffer: Buffer) {
  return fetch(`${BASE_URL}/api/admin/question-imports`, {
    method: "POST",
    headers: { cookie },
    body: uploadForm(filename, mimeType, buffer),
  });
}

describe("POST /api/admin/question-imports — upload + xử lý", () => {
  it("upload PDF hợp lệ → 201, job DONE, drafts đúng theo pattern 'Cau N.'", async () => {
    const buffer = readFileSync(path.join(FIXTURES_DIR, "sample.pdf"));
    const res = await upload(adminCookie, "sample.pdf", "application/pdf", buffer);
    expect(res.status).toBe(201);

    const body = await res.json();
    createdImportedFileIds.push(body.job.importedFileId);

    expect(body.job.status).toBe("DONE");
    expect(body.job.totalExtracted).toBe(2);
    expect(body.job.importedFile.mimeType).toBe("application/pdf");
  });

  it("upload DOCX hợp lệ → 201, job DONE, drafts đúng theo pattern 'Question N'", async () => {
    const buffer = readFileSync(path.join(FIXTURES_DIR, "sample.docx"));
    const res = await upload(
      adminCookie,
      "sample.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer,
    );
    expect(res.status).toBe(201);

    const body = await res.json();
    createdImportedFileIds.push(body.job.importedFileId);

    expect(body.job.status).toBe("DONE");
    expect(body.job.totalExtracted).toBe(2);
  });

  it("sai extension (.txt) → 400", async () => {
    const res = await upload(adminCookie, "sample.txt", "application/pdf", Buffer.from("hello"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("MIME khai báo không khớp đuôi file → 400", async () => {
    const buffer = readFileSync(path.join(FIXTURES_DIR, "sample.pdf"));
    // Đuôi .pdf nhưng khai báo MIME của docx — không khớp EXTENSION_TO_MIME.
    const res = await upload(
      adminCookie,
      "sample.pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer,
    );
    expect(res.status).toBe(400);
  });

  it("nội dung tệp không khớp magic byte đã khai báo (giả mạo đuôi) → 400", async () => {
    const fakeBuffer = Buffer.from("day khong phai la mot file PDF that su");
    const res = await upload(adminCookie, "fake.pdf", "application/pdf", fakeBuffer);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/không khớp|hỏng|giả/i);
  });

  it("file rỗng → 400", async () => {
    const res = await upload(adminCookie, "empty.pdf", "application/pdf", Buffer.alloc(0));
    expect(res.status).toBe(400);
  });

  it("file vượt quá dung lượng cho phép → 400", async () => {
    // 20MB + 1 byte, header PDF hợp lệ để không bị chặn ở bước magic-byte trước.
    const oversized = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(20 * 1024 * 1024)]);
    const res = await upload(adminCookie, "big.pdf", "application/pdf", oversized);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/dung lượng/i);
  });

  it("filename nguy hiểm (path traversal) → vẫn xử lý an toàn, không ghi ra ngoài thư mục storage", async () => {
    const buffer = readFileSync(path.join(FIXTURES_DIR, "sample.pdf"));
    const res = await upload(adminCookie, "../../../../etc/passwd.pdf", "application/pdf", buffer);
    expect(res.status).toBe(201);
    const body = await res.json();
    createdImportedFileIds.push(body.job.importedFileId);
    // filename hiển thị đã được sanitize, storagePath không chứa path traversal.
    expect(body.job.importedFile.filename).not.toContain("..");
  });

  it("STUDENT không thể upload → 403", async () => {
    const buffer = readFileSync(path.join(FIXTURES_DIR, "sample.pdf"));
    const res = await upload(studentCookie, "sample.pdf", "application/pdf", buffer);
    expect(res.status).toBe(403);
  });

  it("chưa đăng nhập → 401", async () => {
    const buffer = readFileSync(path.join(FIXTURES_DIR, "sample.pdf"));
    const res = await fetch(`${BASE_URL}/api/admin/question-imports`, {
      method: "POST",
      body: uploadForm("sample.pdf", "application/pdf", buffer),
    });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/admin/question-imports — danh sách & chi tiết", () => {
  it("GET list (ADMIN) → 200, có job vừa tạo", async () => {
    const res = await fetch(`${BASE_URL}/api/admin/question-imports`, {
      headers: { cookie: adminCookie },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.jobs)).toBe(true);
    expect(body.jobs.length).toBeGreaterThan(0);
  });

  it("GET list (STUDENT) → 403", async () => {
    const res = await fetch(`${BASE_URL}/api/admin/question-imports`, {
      headers: { cookie: studentCookie },
    });
    expect(res.status).toBe(403);
  });

  it("GET :id (ADMIN) → 200 + đúng job", async () => {
    const buffer = readFileSync(path.join(FIXTURES_DIR, "sample.pdf"));
    const uploadRes = await upload(adminCookie, "sample.pdf", "application/pdf", buffer);
    const uploaded = (await uploadRes.json()).job;
    createdImportedFileIds.push(uploaded.importedFileId);

    const res = await fetch(`${BASE_URL}/api/admin/question-imports/${uploaded.id}`, {
      headers: { cookie: adminCookie },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.job.id).toBe(uploaded.id);
  });

  it("GET :id không tồn tại → 404", async () => {
    const res = await fetch(
      `${BASE_URL}/api/admin/question-imports/00000000-0000-4000-8000-000000000000`,
      { headers: { cookie: adminCookie } },
    );
    expect(res.status).toBe(404);
  });

  it("GET :id/drafts (ADMIN) → 200, đúng số draft, có pageNumber trong parsedContent", async () => {
    const buffer = readFileSync(path.join(FIXTURES_DIR, "sample.pdf"));
    const uploadRes = await upload(adminCookie, "sample.pdf", "application/pdf", buffer);
    const uploaded = (await uploadRes.json()).job;
    createdImportedFileIds.push(uploaded.importedFileId);

    const res = await fetch(`${BASE_URL}/api/admin/question-imports/${uploaded.id}/drafts`, {
      headers: { cookie: adminCookie },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.drafts).toHaveLength(2);
    expect(body.drafts[0].parsedContent.detection.pageNumber).toBe(1);
    expect(body.drafts[1].parsedContent.detection.pageNumber).toBe(2);
    expect(body.drafts[0].rawText).toContain("Cau 1");
  });

  it("GET :id/drafts (STUDENT) → 403", async () => {
    const res = await fetch(`${BASE_URL}/api/admin/question-imports/anything/drafts`, {
      headers: { cookie: studentCookie },
    });
    expect(res.status).toBe(403);
  });
});

describe("POST /api/admin/question-imports/:id/retry — idempotent", () => {
  it("retry không tạo trùng lặp draft (xoá cũ rồi tạo lại đúng số lượng)", async () => {
    const buffer = readFileSync(path.join(FIXTURES_DIR, "sample.pdf"));
    const uploadRes = await upload(adminCookie, "sample.pdf", "application/pdf", buffer);
    const uploaded = (await uploadRes.json()).job;
    createdImportedFileIds.push(uploaded.importedFileId);

    const retryRes = await fetch(`${BASE_URL}/api/admin/question-imports/${uploaded.id}/retry`, {
      method: "POST",
      headers: { cookie: adminCookie },
    });
    expect(retryRes.status).toBe(200);
    const retried = (await retryRes.json()).job;
    expect(retried.status).toBe("DONE");
    expect(retried.totalExtracted).toBe(2);

    const draftCount = await prisma.importQuestionDraft.count({
      where: { importJobId: uploaded.id },
    });
    expect(draftCount).toBe(2);
  });

  it("retry job không tồn tại → 404", async () => {
    const res = await fetch(
      `${BASE_URL}/api/admin/question-imports/00000000-0000-4000-8000-000000000000/retry`,
      { method: "POST", headers: { cookie: adminCookie } },
    );
    expect(res.status).toBe(404);
  });

  it("STUDENT không thể retry → 403", async () => {
    const res = await fetch(
      `${BASE_URL}/api/admin/question-imports/00000000-0000-4000-8000-000000000000/retry`,
      { method: "POST", headers: { cookie: studentCookie } },
    );
    expect(res.status).toBe(403);
  });
});
