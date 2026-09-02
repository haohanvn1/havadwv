import "server-only";
import crypto from "node:crypto";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { createStudent, StudentValidationError } from "./studentService";
import { grantSubjectAccessToStudent } from "./subjectAccessService";
import { normalizePhone, validateRosterRow } from "@/validators/studentRoster";

export class RosterFileFormatError extends Error {
  constructor(message = "Không đọc được file — vui lòng kiểm tra đúng định dạng Excel (.xlsx).") {
    super(message);
    this.name = "RosterFileFormatError";
  }
}

export interface RosterRowPreview {
  rowNumber: number;
  fullName: string;
  phone: string;
  email: string | null;
  className: string | null;
  subjectIds: string[];
  status: "valid" | "error";
  errors: string[];
}

export interface RosterParsePreview {
  unmappedColumns: string[];
  rows: RosterRowPreview[];
  readyToCommit: boolean;
}

const FIXED_COLUMN_ALIASES: Record<"stt" | "fullName" | "phone" | "email", string[]> = {
  stt: ["stt"],
  fullName: ["ho va ten", "hoten", "ho ten"],
  phone: ["sdt", "so dien thoai", "dien thoai"],
  email: ["email"],
};

function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .trim()
    .toLowerCase();
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "text" in value) return String((value as { text: unknown }).text ?? "").trim();
  if (typeof value === "object" && "result" in value) return String((value as { result: unknown }).result ?? "").trim();
  return String(value).trim();
}

interface ParsedGrid {
  headerRowIndex: number;
  columns: { index: number; headerText: string; role: "stt" | "fullName" | "phone" | "email" | "subject" }[];
  rows: { index: number; cells: string[] }[];
}

function parseGrid(worksheet: ExcelJS.Worksheet): ParsedGrid {
  const grid: { index: number; cells: string[] }[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cells[colNumber - 1] = cellText(cell.value);
    });
    grid.push({ index: rowNumber, cells });
  });

  const headerRow = grid.find((r) => r.cells.some((c) => FIXED_COLUMN_ALIASES.fullName.includes(normalizeText(c))));
  if (!headerRow) {
    throw new RosterFileFormatError(
      "Không tìm thấy dòng tiêu đề (cần có cột 'Họ và tên') — vui lòng kiểm tra lại file.",
    );
  }

  const columns: ParsedGrid["columns"] = headerRow.cells.map((headerText, index) => {
    const normalized = normalizeText(headerText);
    if (FIXED_COLUMN_ALIASES.stt.includes(normalized)) return { index, headerText, role: "stt" as const };
    if (FIXED_COLUMN_ALIASES.fullName.includes(normalized)) return { index, headerText, role: "fullName" as const };
    if (FIXED_COLUMN_ALIASES.phone.includes(normalized)) return { index, headerText, role: "phone" as const };
    if (FIXED_COLUMN_ALIASES.email.includes(normalized)) return { index, headerText, role: "email" as const };
    return { index, headerText, role: "subject" as const };
  });

  return {
    headerRowIndex: headerRow.index,
    columns,
    rows: grid.filter((r) => r.index > headerRow.index),
  };
}

/**
 * Parse file roster Excel → preview danh sách dòng hợp lệ/lỗi + các cột môn
 * chưa nhận diện được (cần Admin chọn Subject tương ứng trước khi commit).
 * Không lưu gì vào DB — dùng để hiển thị preview lặp lại nhiều lần khi Admin
 * chỉnh sửa mapping cột, KHÔNG tin dữ liệu rows do client echo lại cho bước
 * commit (commit tự parse lại từ buffer gốc — xem commitRosterImport).
 */
export async function parseRosterFile(
  buffer: Buffer,
  columnMappingOverrides: Record<string, string> = {},
): Promise<RosterParsePreview> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw new RosterFileFormatError();
  }
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new RosterFileFormatError();

  const { columns, rows } = parseGrid(worksheet);
  const subjectColumns = columns.filter((c) => c.role === "subject" && c.headerText.length > 0);
  const fullNameCol = columns.find((c) => c.role === "fullName")!.index;
  const phoneCol = columns.find((c) => c.role === "phone")?.index;
  const emailCol = columns.find((c) => c.role === "email")?.index;

  const rememberedMappings = await prisma.rosterColumnMapping.findMany({
    select: { headerText: true, subjectId: true },
  });
  const mappingByHeader = new Map<string, string>(rememberedMappings.map((m) => [m.headerText, m.subjectId]));
  for (const [header, subjectId] of Object.entries(columnMappingOverrides)) {
    mappingByHeader.set(header, subjectId);
  }

  const unmappedColumns = subjectColumns
    .map((c) => c.headerText)
    .filter((headerText) => !mappingByHeader.has(headerText));

  let currentClassName: string | null = null;
  const previewRows: RosterRowPreview[] = [];
  const seenPhones = new Set<string>();

  for (const row of rows) {
    const firstNonEmpty = row.cells.find((c) => c.trim().length > 0);
    if (!firstNonEmpty) continue;
    const normalizedFirst = normalizeText(firstNonEmpty);

    if (normalizedFirst === "tong") continue;

    if (normalizedFirst.startsWith("lop")) {
      // Bỏ từ đầu tiên ("LỚP"/"Lớp") theo dạng đã chuẩn hoá (bỏ dấu) thay vì
      // regex khớp dấu tiếng Việt trực tiếp — "ớ" không nằm trong [oó].
      const words = firstNonEmpty.trim().split(/\s+/);
      const rest = normalizeText(words[0]) === "lop" ? words.slice(1).join(" ").trim() : firstNonEmpty;
      currentClassName = rest || firstNonEmpty;
      continue;
    }

    const fullName = row.cells[fullNameCol] ?? "";
    const rawPhone = phoneCol != null ? (row.cells[phoneCol] ?? "") : "";
    const email = emailCol != null ? (row.cells[emailCol] ?? "").trim() || null : null;
    // Dòng trống thật sự (không ai nhập gì) thì bỏ qua — nhưng nếu có bất kỳ
    // dữ liệu nào (kể cả chỉ thiếu tên) vẫn phải coi là 1 dòng học sinh và
    // báo lỗi rõ ràng, không được âm thầm bỏ qua như dòng đệm.
    if (!fullName.trim() && !rawPhone.trim() && !email) continue;

    const phone = normalizePhone(rawPhone);

    const errors: string[] = [];
    const validation = validateRosterRow({ fullName, phone, email });
    if (!validation.success) errors.push(...validation.errors);

    if (phone) {
      if (seenPhones.has(phone)) {
        errors.push("Số điện thoại bị trùng trong file.");
      }
      seenPhones.add(phone);
    }

    const subjectIds: string[] = [];
    for (const col of subjectColumns) {
      const raw = (row.cells[col.index] ?? "").trim();
      const registered = raw === "1";
      if (!registered) continue;
      const subjectId = mappingByHeader.get(col.headerText);
      if (subjectId) subjectIds.push(subjectId);
    }

    previewRows.push({
      rowNumber: row.index,
      fullName: fullName.trim(),
      phone,
      email,
      className: currentClassName,
      subjectIds,
      status: errors.length > 0 ? "error" : "valid",
      errors,
    });
  }

  // Trùng SĐT với tài khoản đã có trong hệ thống — kiểm tra theo lô, không
  // từng dòng một, để tránh N+1 query trên file có hàng trăm học sinh.
  const phones = previewRows.map((r) => r.phone).filter(Boolean);
  if (phones.length > 0) {
    const existingUsers = await prisma.user.findMany({
      where: { OR: [{ username: { in: phones } }, { phone: { in: phones } }] },
      select: { username: true, phone: true },
    });
    const existingPhones = new Set([
      ...existingUsers.map((u) => u.username),
      ...existingUsers.map((u) => u.phone).filter((p): p is string => p !== null),
    ]);
    for (const row of previewRows) {
      if (existingPhones.has(row.phone)) {
        row.errors.push("Số điện thoại này đã có tài khoản trong hệ thống.");
        row.status = "error";
      }
    }
  }

  return {
    unmappedColumns,
    rows: previewRows,
    readyToCommit: unmappedColumns.length === 0,
  };
}

const PASSWORD_CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

function generateRandomPassword(length = 10): string {
  const bytes = crypto.randomBytes(length);
  let password = "";
  for (let i = 0; i < length; i++) {
    password += PASSWORD_CHARSET[bytes[i] % PASSWORD_CHARSET.length];
  }
  return password;
}

export interface RosterCommitRowResult {
  rowNumber: number;
  fullName: string;
  status: "created" | "skipped" | "failed";
  username?: string;
  password?: string;
  reason?: string;
}

export interface RosterCommitResult {
  created: number;
  skipped: number;
  failed: number;
  rows: RosterCommitRowResult[];
}

/**
 * Tự parse lại file từ buffer gốc (không tin rows do client echo lại) rồi
 * tạo tài khoản + cấp quyền cho từng dòng "valid". Dòng lỗi bị bỏ qua
 * (skipped), không chặn các dòng hợp lệ khác — một dòng lỗi không huỷ cả
 * file (đã thống nhất khi thiết kế).
 */
export async function commitRosterImport(
  buffer: Buffer,
  columnMappingOverrides: Record<string, string>,
): Promise<RosterCommitResult> {
  const preview = await parseRosterFile(buffer, columnMappingOverrides);
  if (!preview.readyToCommit) {
    throw new RosterFileFormatError("Còn cột môn chưa được gán — vui lòng chọn môn cho tất cả các cột trước khi tạo tài khoản.");
  }

  // Ghi nhớ mapping cột mới (nếu có) để lần nhập sau tự nhận diện.
  for (const [headerText, subjectId] of Object.entries(columnMappingOverrides)) {
    await prisma.rosterColumnMapping.upsert({
      where: { headerText },
      update: { subjectId },
      create: { headerText, subjectId },
    });
  }

  const results: RosterCommitRowResult[] = [];
  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of preview.rows) {
    if (row.status === "error") {
      skipped++;
      results.push({ rowNumber: row.rowNumber, fullName: row.fullName, status: "skipped", reason: row.errors.join(" ") });
      continue;
    }

    const password = generateRandomPassword();
    try {
      const student = await createStudent(
        {
          username: row.phone,
          password,
          fullName: row.fullName,
          email: row.email ?? undefined,
          phone: row.phone,
          class: row.className ?? undefined,
        },
        { mustChangePassword: true },
      );

      for (const subjectId of row.subjectIds) {
        await grantSubjectAccessToStudent(student.id, subjectId);
      }

      created++;
      results.push({
        rowNumber: row.rowNumber,
        fullName: row.fullName,
        status: "created",
        username: student.username,
        password,
      });
    } catch (error) {
      failed++;
      const reason = error instanceof StudentValidationError ? Object.values(error.fieldErrors)[0] : "Không thể tạo tài khoản.";
      results.push({ rowNumber: row.rowNumber, fullName: row.fullName, status: "failed", reason });
    }
  }

  return { created, skipped, failed, rows: results };
}
