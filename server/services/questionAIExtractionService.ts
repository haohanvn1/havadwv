import "server-only";
import { prisma } from "@/lib/prisma";
import { AI_MAX_CONCURRENCY } from "@/lib/constants/ai";
import { AIExtractionError, getAIQuestionExtractor } from "./ai";
import { extractAnswerHint } from "./answerHintExtractor";
import { ImportNotFoundError } from "./questionImportService";
import {
  buildReviewFromExtraction,
  readDraftParsedContent,
  type DraftParsedContent,
} from "./importDraftContent";
import { DraftAlreadyApprovedError, DraftNotFoundError } from "./importDraftErrors";

export { DraftAlreadyApprovedError, DraftNotFoundError };

/** Khớp text AI đề xuất với Subject/Topic THẬT trong DB — không bao giờ tự tạo mới (mục 22). */
async function matchSubjectAndTopic(subjectText: string | null, topicText: string | null) {
  let subjectId: string | null = null;
  let topicId: string | null = null;

  if (subjectText?.trim()) {
    const subject = await prisma.subject.findFirst({
      where: { name: { equals: subjectText.trim(), mode: "insensitive" } },
      select: { id: true },
    });
    if (subject) {
      subjectId = subject.id;
      if (topicText?.trim()) {
        const topic = await prisma.topic.findFirst({
          where: { subjectId: subject.id, name: { equals: topicText.trim(), mode: "insensitive" } },
          select: { id: true },
        });
        if (topic) topicId = topic.id;
      }
    }
  }

  return { subjectId, topicId };
}

async function saveContent(draftId: string, content: DraftParsedContent, extra: Record<string, unknown> = {}) {
  await prisma.importQuestionDraft.update({
    where: { id: draftId },
    data: { parsedContent: content as object, ...extra },
  });
}

/**
 * Chạy AI extraction cho MỘT draft — dùng chung cho cả lần phân tích đầu tiên
 * lẫn "Phân tích lại" (regenerate), vì về bản chất là cùng một thao tác idempotent:
 * luôn ghi đè aiExtraction + review bằng kết quả mới nhất, không bao giờ đụng
 * tới rawText (nguồn sự thật) hay tạo Question.
 */
export async function extractDraft(draftId: string) {
  const draft = await prisma.importQuestionDraft.findUnique({
    where: { id: draftId },
    include: { importJob: { include: { importedFile: { select: { filename: true } } } } },
  });
  if (!draft) throw new DraftNotFoundError();
  if (draft.status === "APPROVED") throw new DraftAlreadyApprovedError();

  const content = readDraftParsedContent(draft.parsedContent);
  const priorAttempts = content.aiExtraction?.attempts ?? 0;

  content.aiExtraction = {
    status: "PROCESSING",
    result: content.aiExtraction?.result ?? null,
    errorMessage: null,
    model: null,
    extractedAt: null,
    attempts: priorAttempts,
  };
  await saveContent(draftId, content);

  const extractor = getAIQuestionExtractor();
  const hint = extractAnswerHint(draft.rawText);

  try {
    const result = await extractor.extract({
      rawText: draft.rawText,
      sourceFilename: draft.importJob.importedFile.filename,
      sourcePageNumber: content.detection.pageNumber,
      answerHintText: hint.text ?? undefined,
    });

    const { subjectId, topicId } = await matchSubjectAndTopic(
      result.suggestedSubjectText,
      result.suggestedTopicText,
    );

    content.aiExtraction = {
      status: "DONE",
      result,
      errorMessage: null,
      model: process.env.AI_MODEL || "claude-opus-5",
      extractedAt: new Date().toISOString(),
      attempts: priorAttempts + 1,
    };
    content.review = buildReviewFromExtraction(result);

    await saveContent(draftId, content, {
      suggestedSubjectId: subjectId,
      suggestedTopicId: topicId,
      suggestedDifficulty: result.difficulty ?? null,
    });

    return prisma.importQuestionDraft.findUniqueOrThrow({ where: { id: draftId } });
  } catch (error) {
    const message =
      error instanceof AIExtractionError ? error.message : "Lỗi không xác định khi phân tích AI.";
    console.error("[extractDraft]", draftId, error);

    content.aiExtraction = {
      status: "FAILED",
      result: content.aiExtraction?.result ?? null,
      errorMessage: message,
      model: null,
      extractedAt: null,
      attempts: priorAttempts + 1,
    };
    await saveContent(draftId, content);

    throw error instanceof AIExtractionError ? error : new AIExtractionError(message, error);
  }
}

interface ExtractAllResult {
  draftId: string;
  ok: boolean;
  error?: string;
}

/** Chạy 1 hàm cho từng item với tối đa `limit` tác vụ đồng thời — tránh rate limit/cost explosion khi job có hàng trăm draft. */
async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  async function next(): Promise<void> {
    const current = cursor;
    cursor += 1;
    if (current >= items.length) return;
    await worker(items[current]);
    return next();
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, next));
}

/** Phân tích AI cho tất cả draft CHƯA được approve trong một job — có giới hạn số request đồng thời. */
export async function extractAllDraftsForJob(importJobId: string): Promise<ExtractAllResult[]> {
  const job = await prisma.importJob.findUnique({ where: { id: importJobId }, select: { id: true } });
  if (!job) throw new ImportNotFoundError();

  const drafts = await prisma.importQuestionDraft.findMany({
    where: { importJobId, status: { not: "APPROVED" } },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  // Kiểm tra cấu hình 1 lần trước — tránh lặp lại cùng 1 lỗi "chưa cấu hình
  // AI" cho từng draft riêng lẻ, để lỗi hệ thống nổi rõ ngay từ đầu.
  getAIQuestionExtractor();

  const results: ExtractAllResult[] = [];
  await runWithConcurrency(drafts, AI_MAX_CONCURRENCY, async (draft) => {
    try {
      await extractDraft(draft.id);
      results.push({ draftId: draft.id, ok: true });
    } catch (error) {
      results.push({
        draftId: draft.id,
        ok: false,
        error: error instanceof Error ? error.message : "Lỗi không xác định.",
      });
    }
  });

  return results;
}
