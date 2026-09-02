import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Cấp quyền theo Subject — nền tảng cho "Lớp" (bài giảng) và "Bộ đề" (đề
 * thi) ở Phase 10. Không có model nội dung riêng cho Lớp/Bộ đề — Subject
 * chính là đơn vị cấp quyền, nội dung là VideoLesson/Exam PUBLISHED thuộc
 * Subject đó, hiển thị tự động (đã chốt qua AskUserQuestion khi thiết kế).
 */
export class SubjectAccessDeniedError extends Error {
  constructor() {
    super("Bạn chưa được cấp quyền truy cập môn học này.");
    this.name = "SubjectAccessDeniedError";
  }
}

/** Subject id mà student có quyền — cấp trực tiếp (SubjectAccess.studentId) hoặc qua StudentGroup. */
export async function getAccessibleSubjectIds(studentId: string): Promise<string[]> {
  const accesses = await prisma.subjectAccess.findMany({
    where: {
      OR: [{ studentId }, { studentGroup: { members: { some: { studentId } } } }],
    },
    select: { subjectId: true },
    distinct: ["subjectId"],
  });
  return accesses.map((a) => a.subjectId);
}

export async function hasSubjectAccess(studentId: string, subjectId: string): Promise<boolean> {
  const count = await prisma.subjectAccess.count({
    where: {
      subjectId,
      OR: [{ studentId }, { studentGroup: { members: { some: { studentId } } } }],
    },
  });
  return count > 0;
}

export interface AccessibleSubject {
  id: string;
  name: string;
  slug: string;
  videoLessonCount: number;
  examCount: number;
}

/** Danh sách môn học sinh có quyền, kèm số lượng nội dung — dùng cho card "Lớp"/"Bộ đề". */
export async function getAccessibleSubjects(studentId: string): Promise<AccessibleSubject[]> {
  const subjectIds = await getAccessibleSubjectIds(studentId);
  if (subjectIds.length === 0) return [];

  const subjects = await prisma.subject.findMany({
    where: { id: { in: subjectIds } },
    orderBy: { order: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      _count: {
        select: {
          videoLessons: { where: { status: "PUBLISHED" } },
          exams: { where: { status: "PUBLISHED" } },
        },
      },
    },
  });

  return subjects.map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    videoLessonCount: s._count.videoLessons,
    examCount: s._count.exams,
  }));
}

/** Idempotent — bỏ qua nếu đã có đúng lượt cấp quyền này. */
export async function grantSubjectAccessToStudent(studentId: string, subjectId: string) {
  const existing = await prisma.subjectAccess.findFirst({ where: { studentId, subjectId } });
  if (existing) return existing;
  return prisma.subjectAccess.create({ data: { studentId, subjectId } });
}

export async function grantSubjectAccessToGroup(studentGroupId: string, subjectId: string) {
  const existing = await prisma.subjectAccess.findFirst({ where: { studentGroupId, subjectId } });
  if (existing) return existing;
  return prisma.subjectAccess.create({ data: { studentGroupId, subjectId } });
}
