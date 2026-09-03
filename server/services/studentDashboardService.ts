import "server-only";
import { prisma } from "@/lib/prisma";

// ---------- Continue Learning ----------

export type ContinueLearningItem =
  | {
      kind: "attempt";
      attemptId: string;
      title: string;
      subjectName: string | null;
      answeredCount: number;
      totalCount: number | null;
      at: Date;
    }
  | {
      kind: "video";
      videoLessonId: string;
      title: string;
      subjectName: string | null;
      progressSeconds: number;
      durationSeconds: number | null;
      at: Date;
    };

/**
 * Đề đang làm dở HOẶC video đang xem dở — lấy cái nào có hoạt động gần đây
 * nhất. total câu của một Attempt lấy từ Exam.questionCount (field đếm sẵn)
 * khi Attempt gắn với một Exam thật; nếu là bộ ôn tập cá nhân hoá
 * (examId = null) thì không đoán tổng số câu, chỉ hiện "đang tiếp tục".
 */
export async function getContinueLearning(studentId: string): Promise<ContinueLearningItem | null> {
  const [attempt, video] = await Promise.all([
    prisma.attempt.findFirst({
      where: { studentId, status: "IN_PROGRESS" },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        updatedAt: true,
        exam: { select: { title: true, questionCount: true, subject: { select: { name: true } } } },
        _count: { select: { answers: true } },
      },
    }),
    prisma.studentVideoProgress.findFirst({
      where: { studentId, completed: false },
      orderBy: { lastWatchedAt: "desc" },
      select: {
        videoLessonId: true,
        progressSeconds: true,
        lastWatchedAt: true,
        videoLesson: {
          select: { title: true, durationSeconds: true, subject: { select: { name: true } } },
        },
      },
    }),
  ]);

  const attemptAt = attempt?.updatedAt ?? null;
  const videoAt = video?.lastWatchedAt ?? null;

  if (!attemptAt && !videoAt) return null;

  if (attemptAt && (!videoAt || attemptAt >= videoAt) && attempt) {
    return {
      kind: "attempt",
      attemptId: attempt.id,
      title: attempt.exam?.title ?? "Ôn tập theo chủ đề",
      subjectName: attempt.exam?.subject?.name ?? null,
      answeredCount: attempt._count.answers,
      totalCount: attempt.exam?.questionCount ?? null,
      at: attempt.updatedAt,
    };
  }

  if (video) {
    return {
      kind: "video",
      videoLessonId: video.videoLessonId,
      title: video.videoLesson.title,
      subjectName: video.videoLesson.subject.name,
      progressSeconds: video.progressSeconds,
      durationSeconds: video.videoLesson.durationSeconds,
      at: video.lastWatchedAt,
    };
  }

  return null;
}

// ---------- Upcoming Live Classes ----------

export interface UpcomingLiveClassItem {
  id: string;
  title: string;
  subjectName: string | null;
  teacherName: string | null;
  startTime: Date;
  endTime: Date;
}

/** Chỉ trả về lớp học sinh THẬT SỰ được phép xem — tái dùng đúng luật ở LiveClassAccess/StudentGroupMember, không phải mọi lớp SCHEDULED. */
export async function getUpcomingLiveClasses(
  studentId: string,
  limit = 5,
): Promise<UpcomingLiveClassItem[]> {
  const memberships = await prisma.studentGroupMember.findMany({
    where: { studentId },
    select: { groupId: true },
  });
  const groupIds = memberships.map((m) => m.groupId);

  const classes = await prisma.liveClass.findMany({
    where: {
      status: "SCHEDULED",
      startTime: { gte: new Date() },
      OR: [
        { visibility: "ALL_STUDENTS" },
        ...(groupIds.length > 0
          ? [
              {
                visibility: "SPECIFIC_GROUP" as const,
                accesses: { some: { studentGroupId: { in: groupIds } } },
              },
            ]
          : []),
        { visibility: "SPECIFIC_STUDENTS", accesses: { some: { studentId } } },
      ],
    },
    orderBy: { startTime: "asc" },
    take: limit,
    select: {
      id: true,
      title: true,
      startTime: true,
      endTime: true,
      subject: { select: { name: true } },
      teacher: { select: { name: true } },
    },
  });

  return classes.map((c) => ({
    id: c.id,
    title: c.title,
    subjectName: c.subject?.name ?? null,
    teacherName: c.teacher?.name ?? null,
    startTime: c.startTime,
    endTime: c.endTime,
  }));
}

// ---------- Available Exams ----------

export interface AvailableExamItem {
  id: string;
  title: string;
  examType: string;
  subjectName: string | null;
  questionCount: number;
  durationMinutes: number;
  attemptsByStudent: number;
}

export async function getAvailableExams(
  studentId: string,
  limit = 5,
): Promise<AvailableExamItem[]> {
  const exams = await prisma.exam.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      title: true,
      examType: true,
      questionCount: true,
      durationMinutes: true,
      subject: { select: { name: true } },
      _count: { select: { attempts: { where: { studentId } } } },
    },
  });

  return exams.map((e) => ({
    id: e.id,
    title: e.title,
    examType: e.examType,
    subjectName: e.subject?.name ?? null,
    questionCount: e.questionCount,
    durationMinutes: e.durationMinutes,
    attemptsByStudent: e._count.attempts,
  }));
}

// ---------- Recent Results ----------

export interface RecentResultItem {
  id: string;
  title: string;
  score: number | null;
  status: string;
  submittedAt: Date | null;
}

const SUBMITTED_STATUSES = ["SUBMITTED", "AUTO_SUBMITTED"] as const;

export async function getRecentResults(studentId: string, limit = 5): Promise<RecentResultItem[]> {
  const attempts = await prisma.attempt.findMany({
    where: { studentId, status: { in: [...SUBMITTED_STATUSES] } },
    orderBy: { submittedAt: "desc" },
    take: limit,
    select: {
      id: true,
      score: true,
      status: true,
      submittedAt: true,
      exam: { select: { title: true } },
      examSnapshot: true,
    },
  });

  return attempts.map((a) => {
    const snapshotTitle =
      a.examSnapshot && typeof a.examSnapshot === "object" && "title" in a.examSnapshot
        ? String((a.examSnapshot as Record<string, unknown>).title)
        : null;
    return {
      id: a.id,
      title: a.exam?.title ?? snapshotTitle ?? "Bộ đề ôn tập",
      score: a.score,
      status: a.status,
      submittedAt: a.submittedAt,
    };
  });
}

// ---------- Learning overview / progress ----------

export interface LearningOverview {
  examsCompleted: number;
  averageScore: number | null;
  questionsAnswered: number;
  correctAnswers: number;
  studyTimeSeconds: number;
}

export async function getLearningOverview(studentId: string): Promise<LearningOverview> {
  const [attemptAgg, answerAgg, correctCount] = await Promise.all([
    prisma.attempt.aggregate({
      where: { studentId, status: { in: [...SUBMITTED_STATUSES] } },
      _count: { _all: true },
      _avg: { score: true },
    }),
    prisma.attemptAnswer.aggregate({
      where: { attempt: { studentId } },
      _count: { _all: true },
      _sum: { timeSpentSeconds: true },
    }),
    prisma.attemptAnswer.count({
      where: { attempt: { studentId }, isCorrect: true },
    }),
  ]);

  return {
    examsCompleted: attemptAgg._count._all,
    averageScore: attemptAgg._avg.score,
    questionsAnswered: answerAgg._count._all,
    correctAnswers: correctCount,
    studyTimeSeconds: answerAgg._sum.timeSpentSeconds ?? 0,
  };
}
