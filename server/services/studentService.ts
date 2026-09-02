import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import type { UserStatus } from "@/lib/generated/prisma/enums";
import type { StudentCreateInput, StudentUpdateInput } from "@/validators/student";

const BCRYPT_COST = 10;

export class StudentValidationError extends Error {
  fieldErrors: Record<string, string>;
  constructor(fieldErrors: Record<string, string>) {
    super("Dữ liệu học sinh không hợp lệ.");
    this.name = "StudentValidationError";
    this.fieldErrors = fieldErrors;
  }
}

export class StudentNotFoundError extends Error {
  constructor() {
    super("Không tìm thấy học sinh.");
    this.name = "StudentNotFoundError";
  }
}

export class StudentConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StudentConflictError";
  }
}

/**
 * Với driver adapter (@prisma/adapter-pg) đang dùng, error.meta.target không
 * được điền field name như bản Prisma engine cũ — chỉ có driverAdapterError
 * lồng bên trong. Constraint name Postgres theo đúng quy ước
 * `${Model}_${field}_key` vẫn xuất hiện trong error.message nên dùng nó để
 * phân biệt username vs email (đã kiểm chứng thực tế qua P2002 thật, không
 * đoán — xem tests/http/studentCrud.test.ts).
 */
function isUniqueConstraintError(error: unknown, field: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    error.message.includes(`_${field}_key`)
  );
}

const listSelect = {
  id: true,
  username: true,
  fullName: true,
  email: true,
  phone: true,
  status: true,
  createdAt: true,
  studentProfile: { select: { class: true, school: true, targetExamType: true } },
  _count: { select: { attempts: true } },
} as const;

export async function listStudents(search?: string) {
  return prisma.user.findMany({
    where: {
      role: "STUDENT",
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: "insensitive" } },
              { username: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: listSelect,
    orderBy: { createdAt: "desc" },
  });
}

export async function getStudentDetail(id: string) {
  const student = await prisma.user.findUnique({
    where: { id, role: "STUDENT" },
    select: {
      id: true,
      username: true,
      fullName: true,
      email: true,
      phone: true,
      status: true,
      createdAt: true,
      studentProfile: { select: { class: true, school: true, targetExamType: true } },
      _count: { select: { attempts: true } },
    },
  });
  return student;
}

export type StudentDetail = NonNullable<Awaited<ReturnType<typeof getStudentDetail>>>;

/**
 * Tạo tài khoản Student mới — User + StudentProfile trong một transaction
 * (StudentProfile luôn tồn tại song song với User Student, không để User
 * Student nào thiếu profile — nhất quán với cách seed.ts đã tạo student1/2).
 */
export async function createStudent(input: StudentCreateInput, options?: { mustChangePassword?: boolean }) {
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);

  try {
    return await prisma.user.create({
      data: {
        username: input.username,
        passwordHash,
        role: "STUDENT",
        fullName: input.fullName,
        email: input.email ?? null,
        phone: input.phone ?? null,
        status: "ACTIVE",
        mustChangePassword: options?.mustChangePassword ?? false,
        studentProfile: {
          create: {
            class: input.class ?? null,
            school: input.school ?? null,
            targetExamType: input.targetExamType ?? null,
          },
        },
      },
      select: listSelect,
    });
  } catch (error) {
    if (isUniqueConstraintError(error, "username")) {
      throw new StudentValidationError({ username: "Tên đăng nhập này đã được sử dụng." });
    }
    if (isUniqueConstraintError(error, "email")) {
      throw new StudentValidationError({ email: "Email này đã được sử dụng." });
    }
    throw error;
  }
}

export async function updateStudent(id: string, input: StudentUpdateInput) {
  const existing = await prisma.user.findUnique({ where: { id, role: "STUDENT" }, select: { id: true } });
  if (!existing) throw new StudentNotFoundError();

  try {
    return await prisma.user.update({
      where: { id },
      data: {
        fullName: input.fullName,
        email: input.email ?? null,
        phone: input.phone ?? null,
        studentProfile: {
          upsert: {
            create: {
              class: input.class ?? null,
              school: input.school ?? null,
              targetExamType: input.targetExamType ?? null,
            },
            update: {
              class: input.class ?? null,
              school: input.school ?? null,
              targetExamType: input.targetExamType ?? null,
            },
          },
        },
      },
      select: listSelect,
    });
  } catch (error) {
    if (isUniqueConstraintError(error, "email")) {
      throw new StudentValidationError({ email: "Email này đã được sử dụng." });
    }
    throw error;
  }
}

/** Khoá/mở tài khoản — reuse UserStatus đã có sẵn từ Phase 3 (INACTIVE = không đăng nhập được, xem authService.ts). */
export async function setStudentStatus(id: string, status: UserStatus) {
  const existing = await prisma.user.findUnique({ where: { id, role: "STUDENT" }, select: { id: true } });
  if (!existing) throw new StudentNotFoundError();
  return prisma.user.update({ where: { id }, data: { status }, select: listSelect });
}

/** Đặt lại mật khẩu do Admin thực hiện — bắt học sinh đổi lại mật khẩu ở lần đăng nhập kế tiếp (Phase 10), nhất quán với tài khoản tự tạo từ import Excel. */
export async function resetStudentPassword(id: string, newPassword: string) {
  const existing = await prisma.user.findUnique({ where: { id, role: "STUDENT" }, select: { id: true } });
  if (!existing) throw new StudentNotFoundError();
  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
  await prisma.user.update({ where: { id }, data: { passwordHash, mustChangePassword: true } });
}

/**
 * Hard delete chỉ khi Student chưa có Attempt/tiến độ học (Attempt.studentId
 * và StudentVideoProgress.studentId đều onDelete:Restrict trong schema) —
 * chặn sớm ở đây để trả lỗi tiếng Việt rõ ràng thay vì để Postgres tự chặn
 * bằng lỗi FK thô. Nếu đã có dữ liệu học tập, dùng "Khoá tài khoản" thay vì xoá.
 */
export async function deleteStudent(id: string) {
  const existing = await prisma.user.findUnique({
    where: { id, role: "STUDENT" },
    select: {
      id: true,
      _count: { select: { attempts: true, videoProgress: true } },
    },
  });
  if (!existing) throw new StudentNotFoundError();

  if (existing._count.attempts > 0 || existing._count.videoProgress > 0) {
    throw new StudentConflictError(
      "Học sinh đã có dữ liệu học tập (bài làm/tiến độ video) — chỉ có thể khoá tài khoản, không thể xoá.",
    );
  }

  await prisma.user.delete({ where: { id } });
}

export async function listTopicsForSubject(subjectId: string) {
  return prisma.topic.findMany({
    where: { subjectId },
    select: { id: true, name: true },
    orderBy: { order: "asc" },
  });
}
