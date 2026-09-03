import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { authenticate } from "@/server/services/authService";
import {
  commitRosterImport,
  parseRosterFile,
  RosterFileFormatError,
} from "@/server/services/studentRosterImportService";

// Phase 10 — nhập roster Excel. Test chạy trên database dev thật, tự tạo/xoá
// dữ liệu riêng (prefix SĐT "09990000xx", tên "[vitest-roster]") — không
// đụng student1/student2 đã seed.

let toanId: string;
let tienganhId: string;
const createdUserIds: string[] = [];
const createdMappingHeaders: string[] = [];

async function buildWorkbookBuffer(rows: (string | number)[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Roster");
  for (const row of rows) sheet.addRow(row);
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

function sampleRows(overrides?: { phone1?: string; phone2?: string }) {
  const phone1 = overrides?.phone1 ?? "0999000001";
  const phone2 = overrides?.phone2 ?? "0999000002";
  return [
    ["STT", "Họ và tên", "SĐT", "Email", "T", "A"],
    ["TỔNG", "", "", "", 2, 1],
    ["LỚP 12A9", "", "", "", "", ""],
    [1, "[vitest-roster] Nguyễn Văn A", phone1, "vitesta@example.com", 1, 1],
    [2, "[vitest-roster] Trần Thị B", phone2, "", 1, 0],
  ];
}

beforeAll(async () => {
  const toan = await prisma.subject.findUniqueOrThrow({ where: { slug: "toan" } });
  toanId = toan.id;
  const tienganh = await prisma.subject.findUniqueOrThrow({ where: { slug: "tieng-anh" } });
  tienganhId = tienganh.id;
});

afterEach(async () => {
  if (createdUserIds.length > 0) {
    await prisma.subjectAccess.deleteMany({ where: { studentId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdUserIds.length = 0;
  }
});

afterAll(async () => {
  if (createdMappingHeaders.length > 0) {
    await prisma.rosterColumnMapping.deleteMany({ where: { headerText: { in: createdMappingHeaders } } });
  }
  await prisma.$disconnect();
});

describe("parseRosterFile", () => {
  it("cột chưa từng gặp → unmappedColumns, readyToCommit=false, không đoán mò", async () => {
    const buffer = await buildWorkbookBuffer(sampleRows({ phone1: "0999000011", phone2: "0999000012" }));
    const preview = await parseRosterFile(buffer, {});
    expect(preview.unmappedColumns.sort()).toEqual(["A", "T"]);
    expect(preview.readyToCommit).toBe(false);
  });

  it("bỏ qua dòng TỔNG, nhận đúng section LỚP, parse đúng dữ liệu + subjectIds", async () => {
    const buffer = await buildWorkbookBuffer(sampleRows({ phone1: "0999000021", phone2: "0999000022" }));
    const preview = await parseRosterFile(buffer, { T: toanId, A: tienganhId });

    expect(preview.readyToCommit).toBe(true);
    expect(preview.rows).toHaveLength(2);

    const rowA = preview.rows.find((r) => r.phone === "0999000021")!;
    expect(rowA.fullName).toBe("[vitest-roster] Nguyễn Văn A");
    expect(rowA.className).toBe("12A9");
    expect(rowA.subjectIds.sort()).toEqual([tienganhId, toanId].sort());
    expect(rowA.status).toBe("valid");

    const rowB = preview.rows.find((r) => r.phone === "0999000022")!;
    expect(rowB.subjectIds).toEqual([toanId]); // cột A = 0 → không đăng ký Tiếng Anh
  });

  it("thiếu họ tên / SĐT sai định dạng → status error, không chặn dòng khác", async () => {
    const buffer = await buildWorkbookBuffer([
      ["STT", "Họ và tên", "SĐT", "Email", "T"],
      ["LỚP 12A9", "", "", "", ""],
      [1, "", "0999000031", "", 1],
      [2, "[vitest-roster] SĐT sai", "123", "", 1],
      [3, "[vitest-roster] Hợp lệ", "0999000033", "", 1],
    ]);
    const preview = await parseRosterFile(buffer, { T: toanId });
    const byPhoneOrName = new Map(preview.rows.map((r) => [r.fullName || r.phone, r]));

    expect(byPhoneOrName.get("0999000031")?.status).toBe("error"); // thiếu tên
    expect(byPhoneOrName.get("[vitest-roster] SĐT sai")?.status).toBe("error");
    expect(byPhoneOrName.get("[vitest-roster] Hợp lệ")?.status).toBe("valid");
  });

  it("SĐT trùng trong file → dòng thứ 2 bị đánh dấu lỗi", async () => {
    const buffer = await buildWorkbookBuffer([
      ["STT", "Họ và tên", "SĐT", "Email", "T"],
      ["LỚP 12A9", "", "", "", ""],
      [1, "[vitest-roster] Dòng 1", "0999000041", "", 1],
      [2, "[vitest-roster] Dòng 2 trùng SĐT", "0999000041", "", 1],
    ]);
    const preview = await parseRosterFile(buffer, { T: toanId });
    expect(preview.rows[0].status).toBe("valid");
    expect(preview.rows[1].status).toBe("error");
    expect(preview.rows[1].errors.join(" ")).toMatch(/trùng trong file/);
  });

  it("SĐT đã có tài khoản trong hệ thống → báo lỗi trùng", async () => {
    const existing = await prisma.user.create({
      data: {
        username: "0999000051",
        passwordHash: "x",
        role: "STUDENT",
        fullName: "[vitest-roster] Đã tồn tại",
        phone: "0999000051",
        status: "ACTIVE",
      },
    });
    createdUserIds.push(existing.id);

    const buffer = await buildWorkbookBuffer([
      ["STT", "Họ và tên", "SĐT", "Email", "T"],
      ["LỚP 12A9", "", "", "", ""],
      [1, "[vitest-roster] Trùng với DB", "0999000051", "", 1],
    ]);
    const preview = await parseRosterFile(buffer, { T: toanId });
    expect(preview.rows[0].status).toBe("error");
    expect(preview.rows[0].errors.join(" ")).toMatch(/đã có tài khoản/);
  });
});

describe("commitRosterImport", () => {
  it("tạo tài khoản cho dòng hợp lệ, cấp đúng SubjectAccess, mật khẩu sinh ra đăng nhập được, bắt đổi mật khẩu lần đầu", async () => {
    const buffer = await buildWorkbookBuffer(sampleRows({ phone1: "0999000061", phone2: "0999000062" }));
    const result = await commitRosterImport(buffer, { T: toanId, A: tienganhId });

    expect(result.created).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.failed).toBe(0);

    const rowA = result.rows.find((r) => r.username === "0999000061")!;
    expect(rowA.status).toBe("created");
    expect(rowA.password).toBeTruthy();

    const created = await prisma.user.findUniqueOrThrow({ where: { username: "0999000061" } });
    createdUserIds.push(created.id);
    const other = await prisma.user.findUniqueOrThrow({ where: { username: "0999000062" } });
    createdUserIds.push(other.id);

    expect(created.mustChangePassword).toBe(true);
    const authenticated = await authenticate("0999000061", rowA.password!);
    expect(authenticated.id).toBe(created.id);

    const grants = await prisma.subjectAccess.findMany({ where: { studentId: created.id } });
    expect(grants.map((g) => g.subjectId).sort()).toEqual([tienganhId, toanId].sort());

    // Ghi nhớ mapping cột cho lần nhập sau.
    createdMappingHeaders.push("T", "A");
    const remembered = await prisma.rosterColumnMapping.findUnique({ where: { headerText: "T" } });
    expect(remembered?.subjectId).toBe(toanId);
  });

  it("dòng lỗi bị skip, không chặn các dòng hợp lệ khác trong cùng file", async () => {
    const buffer = await buildWorkbookBuffer([
      ["STT", "Họ và tên", "SĐT", "Email", "T"],
      ["LỚP 12A9", "", "", "", ""],
      [1, "", "0999000071", "", 1],
      [2, "[vitest-roster] Vẫn tạo được", "0999000072", "", 1],
    ]);
    const result = await commitRosterImport(buffer, { T: toanId });
    expect(result.created).toBe(1);
    expect(result.skipped).toBe(1);

    const created = await prisma.user.findUniqueOrThrow({ where: { username: "0999000072" } });
    createdUserIds.push(created.id);
  });

  it("còn cột chưa map → ném RosterFileFormatError, không tạo gì cả", async () => {
    // Dùng tên cột chưa từng xuất hiện ở test nào khác trong file này — nếu
    // dùng lại "T"/"A" sẽ bị chính tính năng "ghi nhớ mapping" (đã test ở
    // trên) tự động resolve, khiến test mất đi tiền đề "còn cột chưa map".
    const buffer = await buildWorkbookBuffer([
      ["STT", "Họ và tên", "SĐT", "Email", "UNMAPPED_COL_XYZ"],
      ["LỚP 12A9", "", "", "", ""],
      [1, "[vitest-roster] Chưa map", "0999000081", "", 1],
      [2, "[vitest-roster] Chưa map 2", "0999000082", "", 1],
    ]);
    await expect(commitRosterImport(buffer, {})).rejects.toBeInstanceOf(RosterFileFormatError);

    const count = await prisma.user.count({ where: { username: { in: ["0999000081", "0999000082"] } } });
    expect(count).toBe(0);
  });
});
