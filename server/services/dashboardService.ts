import "server-only";
import { prisma } from "@/lib/prisma";

export interface DashboardOverview {
  studentCount: number;
  questionCount: number;
  examCount: number;
  upcomingClassCount: number;
}

/** 4 số liệu tổng quan — toàn bộ đều là COUNT, không tải bản ghi nào về. */
export async function getDashboardOverview(): Promise<DashboardOverview> {
  const [studentCount, questionCount, examCount, upcomingClassCount] = await Promise.all([
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.question.count(),
    prisma.exam.count(),
    prisma.liveClass.count({
      where: { status: "SCHEDULED", startTime: { gte: new Date() } },
    }),
  ]);

  return { studentCount, questionCount, examCount, upcomingClassCount };
}

export interface QuestionBankSummary {
  total: number;
  draft: number;
  active: number;
  archived: number;
  byType: { type: string; count: number }[];
}

export async function getQuestionBankSummary(): Promise<QuestionBankSummary> {
  const [total, draft, active, archived, grouped] = await Promise.all([
    prisma.question.count(),
    prisma.question.count({ where: { status: "DRAFT" } }),
    prisma.question.count({ where: { status: "ACTIVE" } }),
    prisma.question.count({ where: { status: "ARCHIVED" } }),
    prisma.question.groupBy({ by: ["type"], _count: { _all: true } }),
  ]);

  const byType = grouped.map((row) => ({ type: row.type, count: row._count._all }));

  return { total, draft, active, archived, byType };
}

export interface ExamSummary {
  total: number;
  published: number;
  draft: number;
  archived: number;
}

/**
 * Không có "Upcoming" ở đây — Exam không có field ngày/giờ diễn ra (đó là
 * khái niệm của LiveClass hoặc Attempt), nên không có cơ sở để tính con số
 * này mà không tự bịa ra một quy tắc chưa được xác nhận. Xem báo cáo Phase 4.
 */
export async function getExamSummary(): Promise<ExamSummary> {
  const [total, published, draft, archived] = await Promise.all([
    prisma.exam.count(),
    prisma.exam.count({ where: { status: "PUBLISHED" } }),
    prisma.exam.count({ where: { status: "DRAFT" } }),
    prisma.exam.count({ where: { status: "ARCHIVED" } }),
  ]);

  return { total, published, draft, archived };
}

export interface UpcomingLiveClass {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  subjectName: string | null;
}

export async function getUpcomingLiveClasses(limit = 5): Promise<UpcomingLiveClass[]> {
  const classes = await prisma.liveClass.findMany({
    where: { status: "SCHEDULED", startTime: { gte: new Date() } },
    orderBy: { startTime: "asc" },
    take: limit,
    select: {
      id: true,
      title: true,
      startTime: true,
      endTime: true,
      subject: { select: { name: true } },
    },
  });

  return classes.map((c) => ({
    id: c.id,
    title: c.title,
    startTime: c.startTime,
    endTime: c.endTime,
    subjectName: c.subject?.name ?? null,
  }));
}

export type RecentActivityType = "question" | "exam" | "liveClass" | "video" | "blueprintImport";

export interface RecentActivityItem {
  id: string;
  type: RecentActivityType;
  label: string;
  actor: string | null;
  at: Date;
}

const ACTIVITY_TAKE = 5;

function truncate(text: string, max = 60) {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/**
 * Không có bảng Activity/Audit riêng — theo đúng chỉ đạo Phase 4, việc thêm
 * một bảng chỉ để phục vụ dashboard là over-engineering. Thay vào đó, gộp
 * `createdAt` của 5 loại nội dung hay tạo mới nhất (mỗi loại LIMIT 5), sắp
 * lại theo thời gian, rồi cắt còn `limit` — 5 truy vấn nhỏ, không có truy
 * vấn nào tải nhiều hơn 5 bản ghi.
 */
export async function getRecentActivity(limit = 8): Promise<RecentActivityItem[]> {
  const [questions, exams, liveClasses, videoLessons, blueprintImports] = await Promise.all([
    prisma.question.findMany({
      take: ACTIVITY_TAKE,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        content: true,
        createdAt: true,
        createdBy: { select: { fullName: true } },
      },
    }),
    prisma.exam.findMany({
      take: ACTIVITY_TAKE,
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, createdAt: true, createdBy: { select: { fullName: true } } },
    }),
    prisma.liveClass.findMany({
      take: ACTIVITY_TAKE,
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, createdAt: true, createdBy: { select: { fullName: true } } },
    }),
    prisma.videoLesson.findMany({
      take: ACTIVITY_TAKE,
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, createdAt: true, createdBy: { select: { fullName: true } } },
    }),
    prisma.blueprintImport.findMany({
      take: ACTIVITY_TAKE,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        filename: true,
        createdAt: true,
        uploadedBy: { select: { fullName: true } },
      },
    }),
  ]);

  const items: RecentActivityItem[] = [
    ...questions.map((q) => ({
      id: `question-${q.id}`,
      type: "question" as const,
      label: `Tạo câu hỏi mới: ${truncate(q.content)}`,
      actor: q.createdBy?.fullName ?? null,
      at: q.createdAt,
    })),
    ...exams.map((e) => ({
      id: `exam-${e.id}`,
      type: "exam" as const,
      label: `Tạo đề thi: ${e.title}`,
      actor: e.createdBy?.fullName ?? null,
      at: e.createdAt,
    })),
    ...liveClasses.map((c) => ({
      id: `liveclass-${c.id}`,
      type: "liveClass" as const,
      label: `Tạo lớp học: ${c.title}`,
      actor: c.createdBy?.fullName ?? null,
      at: c.createdAt,
    })),
    ...videoLessons.map((v) => ({
      id: `video-${v.id}`,
      type: "video" as const,
      label: `Thêm video bài giảng: ${v.title}`,
      actor: v.createdBy?.fullName ?? null,
      at: v.createdAt,
    })),
    ...blueprintImports.map((b) => ({
      id: `blueprint-${b.id}`,
      type: "blueprintImport" as const,
      label: `Import cấu trúc đề: ${b.filename}`,
      actor: b.uploadedBy?.fullName ?? null,
      at: b.createdAt,
    })),
  ];

  items.sort((a, b) => b.at.getTime() - a.at.getTime());
  return items.slice(0, limit);
}
