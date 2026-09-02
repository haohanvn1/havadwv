import { afterAll, beforeAll, describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { BASE_URL, startTestServer, stopTestServer } from "../support/server";
import { getAdminCookie, getStudentCookie } from "../support/tokens";

// Phase 10 — test HTTP cho API nhập roster Excel. Chạy trên database dev
// thật, tự tạo dữ liệu riêng (prefix SĐT "0998xxxxxx"), dọn sạch ở afterAll.

let adminCookie: string;
let studentCookie: string;
let toanId: string;
const createdUserIds: string[] = [];
const createdMappingHeaders: string[] = [];

async function buildWorkbookBuffer(rows: (string | number)[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Roster");
  for (const row of rows) sheet.addRow(row);
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

function makeFormData(buffer: Buffer, mapping: Record<string, string> = {}) {
  const formData = new FormData();
  formData.append("file", new Blob([new Uint8Array(buffer)]), "roster.xlsx");
  formData.append("columnMappingOverrides", JSON.stringify(mapping));
  return formData;
}

beforeAll(async () => {
  await startTestServer();
  adminCookie = await getAdminCookie();
  studentCookie = await getStudentCookie();
  const toan = await prisma.subject.findUniqueOrThrow({ where: { slug: "toan" } });
  toanId = toan.id;
}, 70_000);

afterAll(async () => {
  if (createdUserIds.length > 0) {
    await prisma.subjectAccess.deleteMany({ where: { studentId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
  if (createdMappingHeaders.length > 0) {
    await prisma.rosterColumnMapping.deleteMany({ where: { headerText: { in: createdMappingHeaders } } });
  }
  stopTestServer();
  await prisma.$disconnect();
});

describe("POST /api/admin/students/import/preview", () => {
  it("unauthenticated → 401", async () => {
    const buffer = await buildWorkbookBuffer([["STT", "Họ và tên", "SĐT", "Email"]]);
    const res = await fetch(`${BASE_URL}/api/admin/students/import/preview`, {
      method: "POST",
      body: makeFormData(buffer),
    });
    expect(res.status).toBe(401);
  });

  it("STUDENT → 403", async () => {
    const buffer = await buildWorkbookBuffer([["STT", "Họ và tên", "SĐT", "Email"]]);
    const res = await fetch(`${BASE_URL}/api/admin/students/import/preview`, {
      method: "POST",
      headers: { cookie: studentCookie },
      body: makeFormData(buffer),
    });
    expect(res.status).toBe(403);
  });

  it("thiếu file → 400", async () => {
    const res = await fetch(`${BASE_URL}/api/admin/students/import/preview`, {
      method: "POST",
      headers: { cookie: adminCookie },
      body: new FormData(),
    });
    expect(res.status).toBe(400);
  });

  it("file hợp lệ, cột chưa map → 200, unmappedColumns đúng", async () => {
    const buffer = await buildWorkbookBuffer([
      ["STT", "Họ và tên", "SĐT", "Email", "HTTP_TEST_COL"],
      ["LỚP 12A9", "", "", "", ""],
      [1, "[vitest-http-roster] A", "0998000001", "", 1],
    ]);
    const res = await fetch(`${BASE_URL}/api/admin/students/import/preview`, {
      method: "POST",
      headers: { cookie: adminCookie },
      body: makeFormData(buffer),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.preview.unmappedColumns).toContain("HTTP_TEST_COL");
    expect(body.preview.readyToCommit).toBe(false);
  });
});

describe("POST /api/admin/students/import/commit", () => {
  it("unauthenticated → 401", async () => {
    const buffer = await buildWorkbookBuffer([["STT", "Họ và tên", "SĐT", "Email"]]);
    const res = await fetch(`${BASE_URL}/api/admin/students/import/commit`, {
      method: "POST",
      body: makeFormData(buffer),
    });
    expect(res.status).toBe(401);
  });

  it("STUDENT → 403", async () => {
    const buffer = await buildWorkbookBuffer([["STT", "Họ và tên", "SĐT", "Email"]]);
    const res = await fetch(`${BASE_URL}/api/admin/students/import/commit`, {
      method: "POST",
      headers: { cookie: studentCookie },
      body: makeFormData(buffer),
    });
    expect(res.status).toBe(403);
  });

  it("còn cột chưa map → 400, không tạo tài khoản nào", async () => {
    const buffer = await buildWorkbookBuffer([
      ["STT", "Họ và tên", "SĐT", "Email", "HTTP_TEST_COL_2"],
      ["LỚP 12A9", "", "", "", ""],
      [1, "[vitest-http-roster] B", "0998000002", "", 1],
    ]);
    const res = await fetch(`${BASE_URL}/api/admin/students/import/commit`, {
      method: "POST",
      headers: { cookie: adminCookie },
      body: makeFormData(buffer),
    });
    expect(res.status).toBe(400);
    const count = await prisma.user.count({ where: { username: "0998000002" } });
    expect(count).toBe(0);
  });

  it("file hợp lệ đầy đủ mapping → 200, tạo tài khoản + cấp quyền đúng, mật khẩu chỉ trả về đúng 1 lần trong response", async () => {
    createdMappingHeaders.push("HTTP_TEST_COL_3");
    const buffer = await buildWorkbookBuffer([
      ["STT", "Họ và tên", "SĐT", "Email", "HTTP_TEST_COL_3"],
      ["LỚP 12A9", "", "", "", ""],
      [1, "[vitest-http-roster] C", "0998000003", "", 1],
    ]);
    const res = await fetch(`${BASE_URL}/api/admin/students/import/commit`, {
      method: "POST",
      headers: { cookie: adminCookie },
      body: makeFormData(buffer, { HTTP_TEST_COL_3: toanId }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.created).toBe(1);
    expect(body.result.rows[0].password).toBeTruthy();
    expect(body.result.rows[0].username).toBe("0998000003");

    const created = await prisma.user.findUniqueOrThrow({ where: { username: "0998000003" } });
    createdUserIds.push(created.id);
    expect(created.mustChangePassword).toBe(true);

    const grants = await prisma.subjectAccess.findMany({ where: { studentId: created.id } });
    expect(grants.map((g) => g.subjectId)).toEqual([toanId]);
  });
});
