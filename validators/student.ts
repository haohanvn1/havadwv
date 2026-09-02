import { z } from "zod";
import { UserStatus } from "@/lib/generated/prisma/enums";

const emptyToUndefined = (val: unknown) => (val === "" || val === null ? undefined : val);

const usernamePattern = /^[a-z0-9._-]+$/;

/** Tạo mới — username bắt buộc và không đổi được sau này (đồng nhất với hành vi đăng nhập). */
export const studentCreateSchema = z.object({
  username: z
    .string({ error: "Vui lòng nhập tên đăng nhập." })
    .trim()
    .min(3, "Tên đăng nhập phải có ít nhất 3 ký tự.")
    .max(50, "Tên đăng nhập tối đa 50 ký tự.")
    .regex(usernamePattern, "Tên đăng nhập chỉ được chứa chữ thường, số, dấu chấm/gạch dưới/gạch ngang."),
  fullName: z.string({ error: "Vui lòng nhập họ tên." }).trim().min(1, "Vui lòng nhập họ tên."),
  email: z.preprocess(emptyToUndefined, z.string().trim().email("Email không hợp lệ.").optional()),
  phone: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  password: z
    .string({ error: "Vui lòng nhập mật khẩu." })
    .min(8, "Mật khẩu phải có ít nhất 8 ký tự."),
  class: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  school: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  targetExamType: z.preprocess(emptyToUndefined, z.string().trim().optional()),
});
export type StudentCreateInput = z.infer<typeof studentCreateSchema>;

/** Sửa — không đổi username/password ở đây (password có action riêng — mục "reset password"). */
export const studentUpdateSchema = z.object({
  fullName: z.string({ error: "Vui lòng nhập họ tên." }).trim().min(1, "Vui lòng nhập họ tên."),
  email: z.preprocess(emptyToUndefined, z.string().trim().email("Email không hợp lệ.").optional()),
  phone: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  class: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  school: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  targetExamType: z.preprocess(emptyToUndefined, z.string().trim().optional()),
});
export type StudentUpdateInput = z.infer<typeof studentUpdateSchema>;

export const studentStatusSchema = z.object({
  status: z.enum(Object.values(UserStatus) as [UserStatus, ...UserStatus[]], {
    error: "Trạng thái không hợp lệ.",
  }),
});

export const studentPasswordResetSchema = z.object({
  password: z.string({ error: "Vui lòng nhập mật khẩu mới." }).min(8, "Mật khẩu phải có ít nhất 8 ký tự."),
});

export type StudentFieldErrors = Record<string, string>;

function zodErrorsToFieldErrors(error: z.ZodError): StudentFieldErrors {
  const errors: StudentFieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

export function validateStudentCreate(
  raw: unknown,
): { success: true; data: StudentCreateInput } | { success: false; errors: StudentFieldErrors } {
  const parsed = studentCreateSchema.safeParse(raw);
  if (!parsed.success) return { success: false, errors: zodErrorsToFieldErrors(parsed.error) };
  return { success: true, data: parsed.data };
}

export function validateStudentUpdate(
  raw: unknown,
): { success: true; data: StudentUpdateInput } | { success: false; errors: StudentFieldErrors } {
  const parsed = studentUpdateSchema.safeParse(raw);
  if (!parsed.success) return { success: false, errors: zodErrorsToFieldErrors(parsed.error) };
  return { success: true, data: parsed.data };
}
