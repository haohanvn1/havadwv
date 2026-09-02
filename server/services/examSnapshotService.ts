import "server-only";
import { prisma } from "@/lib/prisma";
import type { QuestionType } from "@/lib/generated/prisma/enums";

/**
 * Snapshot đầy đủ lưu SERVER-SIDE trong Attempt.examSnapshot — có chứa đáp
 * án đúng (isCorrect/correctAnswerText) vì Phase 9B (chấm điểm) sẽ cần chấm
 * dựa trên đúng phiên bản câu hỏi tại thời điểm Student bắt đầu làm bài, chứ
 * không phải Question hiện tại (có thể đã bị sửa/lưu trữ). Không bao giờ trả
 * thẳng object này cho client — luôn đi qua sanitizeSnapshotForStudent trước.
 */
export interface SnapshotOption {
  id: string;
  label: string;
  content: string;
  isCorrect: boolean;
}

export interface SnapshotQuestion {
  questionId: string;
  order: number;
  type: QuestionType;
  content: string;
  options: SnapshotOption[];
  correctAnswerText: string | null;
  /**
   * Trọng số điểm của câu này tại thời điểm Start — sao chép từ
   * ExamQuestion.points (mục 3 Phase 9B: Exam có thể đổi points về sau nhưng
   * Attempt đã bắt đầu phải giữ nguyên cấu trúc chấm điểm cũ). Optional để
   * đọc ngược được snapshot tạo trước khi field này tồn tại (Phase 9A) —
   * nơi đọc phải tự mặc định 1 khi thiếu, không phải ở đây.
   */
  points?: number;
}

export interface ExamSnapshot {
  examId: string;
  title: string;
  examType: string;
  durationMinutes: number;
  questionCount: number;
  questions: SnapshotQuestion[];
}

/** Phiên bản an toàn cho Student — không có isCorrect/correctAnswerText (mục 32). */
export interface ClientSnapshotOption {
  id: string;
  label: string;
  content: string;
}
export interface ClientSnapshotQuestion {
  questionId: string;
  order: number;
  type: QuestionType;
  content: string;
  options: ClientSnapshotOption[];
  /** Không nhạy cảm (không phải answer key) — hiển thị "X điểm" trên UI làm bài (Phase 9C mục 7). */
  points: number;
}
export interface ClientExamSnapshot {
  examId: string;
  title: string;
  examType: string;
  durationMinutes: number;
  questionCount: number;
  questions: ClientSnapshotQuestion[];
}

export class ExamNotFoundError extends Error {
  constructor() {
    super("Không tìm thấy đề thi.");
    this.name = "ExamNotFoundError";
  }
}

/**
 * Tạo snapshot point-in-time từ Exam hiện tại — gọi đúng 1 lần lúc Start
 * Attempt. Sau đó Attempt không bao giờ đọc lại Exam/Question/QuestionOption
 * để hiển thị nội dung nữa — mọi thứ Student thấy đều lấy từ snapshot đã lưu,
 * kể cả khi Question/ExamQuestion bị Admin sửa hoặc lưu trữ sau đó (mục 30/31).
 */
export async function buildExamSnapshot(examId: string): Promise<ExamSnapshot> {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      examQuestions: {
        orderBy: { order: "asc" },
        include: {
          question: {
            include: { options: { orderBy: { order: "asc" } } },
          },
        },
      },
    },
  });
  if (!exam) throw new ExamNotFoundError();

  const questions: SnapshotQuestion[] = exam.examQuestions.map((eq) => ({
    questionId: eq.question.id,
    order: eq.order,
    type: eq.question.type,
    content: eq.question.content,
    options: eq.question.options.map((o) => ({
      id: o.id,
      label: o.label,
      content: o.content,
      isCorrect: o.isCorrect,
    })),
    correctAnswerText: eq.question.correctAnswerText,
    points: eq.points,
  }));

  return {
    examId: exam.id,
    title: exam.title,
    examType: exam.examType,
    durationMinutes: exam.durationMinutes,
    questionCount: questions.length,
    questions,
  };
}

/** Bóc tách field nhạy cảm trước khi trả cho Student — không bao giờ serialize snapshot gốc trực tiếp. */
export function sanitizeSnapshotForStudent(snapshot: ExamSnapshot): ClientExamSnapshot {
  return {
    examId: snapshot.examId,
    title: snapshot.title,
    examType: snapshot.examType,
    durationMinutes: snapshot.durationMinutes,
    questionCount: snapshot.questionCount,
    questions: snapshot.questions.map((q) => ({
      questionId: q.questionId,
      order: q.order,
      type: q.type,
      content: q.content,
      options: q.options.map((o) => ({ id: o.id, label: o.label, content: o.content })),
      points: typeof q.points === "number" && q.points > 0 ? q.points : 1,
    })),
  };
}

export function parseExamSnapshot(value: unknown): ExamSnapshot {
  return value as ExamSnapshot;
}
