import { z } from "zod";

const emptyToUndefined = (val: unknown) => (val === "" || val === null || val === undefined ? undefined : val);

// SĐT Việt Nam: 0xxxxxxxxx (10 số) hoặc +84xxxxxxxxx — chấp nhận khoảng
// trắng/gạch ngang trong file gốc, đã được chuẩn hoá (loại bỏ) trước khi validate.
const phonePattern = /^(0\d{9}|\+84\d{9})$/;

export const rosterRowSchema = z.object({
  fullName: z.string({ error: "Thiếu họ tên." }).trim().min(1, "Thiếu họ tên."),
  phone: z
    .string({ error: "Thiếu số điện thoại." })
    .trim()
    .regex(phonePattern, "Số điện thoại không hợp lệ (VD 0912345678)."),
  email: z.preprocess(emptyToUndefined, z.string().trim().email("Email không hợp lệ.").optional()),
});

export type RosterRowFieldErrors = Record<string, string>;

export function validateRosterRow(raw: {
  fullName: string;
  phone: string;
  email: string | null;
}): { success: true } | { success: false; errors: string[] } {
  const parsed = rosterRowSchema.safeParse({
    fullName: raw.fullName,
    phone: raw.phone,
    email: raw.email ?? undefined,
  });
  if (parsed.success) return { success: true };
  return { success: false, errors: parsed.error.issues.map((issue) => issue.message) };
}

/** Chuẩn hoá SĐT về dạng chỉ số + dấu "+" — bỏ khoảng trắng, dấu chấm, gạch ngang thường gặp khi copy từ Excel. */
export function normalizePhone(raw: string): string {
  return raw.trim().replace(/[\s.\-()]/g, "");
}
