import "server-only";
import { prisma } from "@/lib/prisma";

export class ExamNotFoundError extends Error {
  constructor() {
    super("Không tìm thấy đề thi.");
    this.name = "ExamNotFoundError";
  }
}

export class ExamPublishError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExamPublishError";
  }
}

export async function listExams() {
  return prisma.exam.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      subject: { select: { id: true, name: true } },
      generatedFromBlueprint: { select: { id: true, name: true } },
    },
  });
}

export async function getExamDetail(id: string) {
  return prisma.exam.findUnique({
    where: { id },
    include: {
      subject: { select: { id: true, name: true } },
      generatedFromBlueprint: { select: { id: true, name: true } },
      examQuestions: {
        orderBy: { order: "asc" },
        include: {
          question: {
            select: {
              id: true,
              content: true,
              type: true,
              difficulty: true,
              status: true,
              topic: { select: { id: true, name: true } },
              subject: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });
}

export type ExamDetail = NonNullable<Awaited<ReturnType<typeof getExamDetail>>>;

/**
 * Publish server-side authoritative (mục 26) — không chỉ disable nút ở
 * client. Chỉ publish được khi Exam đang DRAFT, có ít nhất 1 câu hỏi, và
 * toàn bộ câu hỏi trong đề vẫn đang ACTIVE (một câu có thể đã bị Admin lưu
 * trữ sau khi đề được sinh ra).
 */
export async function publishExam(id: string) {
  const exam = await prisma.exam.findUnique({
    where: { id },
    include: { examQuestions: { include: { question: { select: { status: true } } } } },
  });
  if (!exam) throw new ExamNotFoundError();

  if (exam.status !== "DRAFT") {
    throw new ExamPublishError("Chỉ có thể publish đề đang ở trạng thái Nháp.");
  }
  if (exam.examQuestions.length === 0) {
    throw new ExamPublishError("Đề thi chưa có câu hỏi nào — không thể publish.");
  }
  const invalidQuestions = exam.examQuestions.filter((eq) => eq.question.status !== "ACTIVE");
  if (invalidQuestions.length > 0) {
    throw new ExamPublishError(
      `Đề thi có ${invalidQuestions.length} câu hỏi không còn ở trạng thái hợp lệ (đã bị lưu trữ/nháp) — vui lòng kiểm tra lại trước khi publish.`,
    );
  }

  return prisma.exam.update({ where: { id }, data: { status: "PUBLISHED" } });
}
