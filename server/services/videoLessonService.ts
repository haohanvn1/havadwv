import "server-only";
import { prisma } from "@/lib/prisma";
import { hasSubjectAccess, SubjectAccessDeniedError } from "./subjectAccessService";

export interface VideoLessonListItem {
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  completed: boolean;
}

/** Danh sách bài giảng PUBLISHED thuộc 1 Subject — trang chi tiết "Lớp". Ném SubjectAccessDeniedError nếu chưa có quyền hoặc subject không tồn tại (không phân biệt 2 trường hợp để không lộ thông tin). */
export async function listVideoLessonsForSubject(
  studentId: string,
  subjectId: string,
): Promise<{ subjectName: string; lessons: VideoLessonListItem[] }> {
  const allowed = await hasSubjectAccess(studentId, subjectId);
  if (!allowed) throw new SubjectAccessDeniedError();

  const subject = await prisma.subject.findUnique({ where: { id: subjectId }, select: { name: true } });
  if (!subject) throw new SubjectAccessDeniedError();

  const lessons = await prisma.videoLesson.findMany({
    where: { subjectId, status: "PUBLISHED" },
    orderBy: { order: "asc" },
    select: {
      id: true,
      title: true,
      description: true,
      thumbnailUrl: true,
      durationSeconds: true,
      progress: { where: { studentId }, select: { completed: true } },
    },
  });

  return {
    subjectName: subject.name,
    lessons: lessons.map((l) => ({
      id: l.id,
      title: l.title,
      description: l.description,
      thumbnailUrl: l.thumbnailUrl,
      durationSeconds: l.durationSeconds,
      completed: l.progress[0]?.completed ?? false,
    })),
  };
}

export interface VideoLessonDetail {
  id: string;
  title: string;
  description: string | null;
  youtubeVideoId: string;
  subjectId: string;
  subjectName: string;
}

/** Chi tiết 1 bài giảng — kiểm tra quyền theo subjectId của chính lesson (không tin subjectId truyền từ URL). */
export async function getVideoLessonForStudent(studentId: string, lessonId: string): Promise<VideoLessonDetail> {
  const lesson = await prisma.videoLesson.findUnique({
    where: { id: lessonId },
    select: {
      id: true,
      title: true,
      description: true,
      youtubeVideoId: true,
      status: true,
      subjectId: true,
      subject: { select: { name: true } },
    },
  });
  if (!lesson || lesson.status !== "PUBLISHED") throw new SubjectAccessDeniedError();

  const allowed = await hasSubjectAccess(studentId, lesson.subjectId);
  if (!allowed) throw new SubjectAccessDeniedError();

  // Ghi nhận đã mở bài giảng — chỉ đánh dấu "đã xem", chưa theo dõi chi tiết
  // tiến độ theo giây ở phase này (ngoài phạm vi Phase 10, xem kế hoạch).
  await prisma.studentVideoProgress.upsert({
    where: { studentId_videoLessonId: { studentId, videoLessonId: lesson.id } },
    update: { lastWatchedAt: new Date() },
    create: { studentId, videoLessonId: lesson.id },
  });

  return {
    id: lesson.id,
    title: lesson.title,
    description: lesson.description,
    youtubeVideoId: lesson.youtubeVideoId,
    subjectId: lesson.subjectId,
    subjectName: lesson.subject.name,
  };
}
