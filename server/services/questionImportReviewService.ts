import "server-only";
import { prisma } from "@/lib/prisma";
import { ImportNotFoundError } from "./questionImportService";
import { DraftAlreadyApprovedError, DraftNotFoundError, DraftValidationError } from "./importDraftErrors";
import { readDraftParsedContent } from "./importDraftContent";
import type { Difficulty, QuestionType } from "@/lib/generated/prisma/enums";

export async function getReviewData(importJobId: string) {
  const job = await prisma.importJob.findUnique({
    where: { id: importJobId },
    include: {
      importedFile: { select: { filename: true, mimeType: true, sizeBytes: true, createdAt: true } },
    },
  });
  if (!job) throw new ImportNotFoundError();

  const drafts = await prisma.importQuestionDraft.findMany({
    where: { importJobId },
    orderBy: { createdAt: "asc" },
    include: {
      suggestedSubject: { select: { id: true, name: true } },
      suggestedTopic: { select: { id: true, name: true } },
      reviewedBy: { select: { fullName: true } },
      approvedQuestion: { select: { id: true } },
    },
  });

  const parsedList = drafts.map((d) => readDraftParsedContent(d.parsedContent));

  const summary = {
    total: drafts.length,
    aiProcessed: parsedList.filter((p) => p.aiExtraction?.status === "DONE").length,
    needsReview: drafts.filter((d) => d.status === "PENDING").length,
    approved: drafts.filter((d) => d.status === "APPROVED").length,
    rejected: drafts.filter((d) => d.status === "REJECTED").length,
  };

  return { job, drafts, summary };
}

export interface SaveDraftReviewInput {
  questionText: string;
  questionType: QuestionType;
  options: { id?: string; label: string; text: string; isCorrect: boolean }[];
  correctAnswerText: string | null;
  explanation: string | null;
  cognitiveLevel: string | null;
  tags: string[];
  subjectId: string | null;
  topicId: string | null;
  difficulty: Difficulty | null;
}

/**
 * Lưu bản Admin đang chỉnh sửa vào draft — chỉ update ImportQuestionDraft,
 * KHÔNG bao giờ tạo Question ở đây (mục 24, 40). Approve là bước riêng.
 */
export async function saveDraftReview(draftId: string, input: SaveDraftReviewInput) {
  const draft = await prisma.importQuestionDraft.findUnique({ where: { id: draftId } });
  if (!draft) throw new DraftNotFoundError();
  if (draft.status === "APPROVED") throw new DraftAlreadyApprovedError();

  if (input.topicId) {
    if (!input.subjectId) {
      throw new DraftValidationError("Vui lòng chọn môn học trước khi chọn chủ đề.");
    }
    const topic = await prisma.topic.findUnique({ where: { id: input.topicId } });
    if (!topic || topic.subjectId !== input.subjectId) {
      throw new DraftValidationError("Chủ đề không thuộc môn học đã chọn.", { topicId: "Chủ đề không thuộc môn học đã chọn." });
    }
  }

  const content = readDraftParsedContent(draft.parsedContent);
  content.review = {
    questionText: input.questionText,
    questionType: input.questionType,
    options: input.options,
    correctAnswerText: input.correctAnswerText,
    explanation: input.explanation,
    cognitiveLevel: input.cognitiveLevel,
    tags: input.tags,
    savedAt: new Date().toISOString(),
  };

  return prisma.importQuestionDraft.update({
    where: { id: draftId },
    data: {
      parsedContent: content as object,
      suggestedSubjectId: input.subjectId,
      suggestedTopicId: input.topicId,
      suggestedDifficulty: input.difficulty,
    },
  });
}
