import type { QuestionExtractionResult } from "./ai";

/**
 * Toàn bộ shape của ImportQuestionDraft.parsedContent (Json) qua các phase:
 * - detection: Phase 7A (pattern-based candidate detection) — bất biến sau khi tạo.
 * - aiExtraction: Phase 7B — bản ghi gốc AI trả về lần chạy gần nhất, không bị Admin sửa trực tiếp.
 * - review: Phase 7B — bản làm việc Admin đang chỉnh sửa, khởi tạo từ aiExtraction.result,
 *   Admin có thể sửa tự do mà không ảnh hưởng rawText hay aiExtraction gốc.
 * - rejectReason: lý do Admin từ chối draft, nếu có.
 *
 * Subject/Topic/Difficulty được AI đề xuất KHÔNG lưu ở đây — dùng thẳng cột
 * quan hệ có sẵn suggestedSubjectId/suggestedTopicId/suggestedDifficulty của
 * ImportQuestionDraft (đã có FK thật, không như text tự do trong JSON).
 */
export interface DraftDetectionInfo {
  questionNumberLabel: string | null;
  pageNumber: number | null;
  detectionMethod: string;
  confidence: "high" | "low";
  warning: string | null;
  order: number;
}

export type AIExtractionStatus = "PENDING" | "PROCESSING" | "DONE" | "FAILED";

export interface DraftAIExtractionState {
  status: AIExtractionStatus;
  result: QuestionExtractionResult | null;
  errorMessage: string | null;
  model: string | null;
  extractedAt: string | null;
  attempts: number;
}

export interface DraftReviewOption {
  id?: string;
  label: string;
  text: string;
  isCorrect: boolean;
}

export interface DraftReviewData {
  questionText: string;
  questionType: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER" | null;
  options: DraftReviewOption[];
  correctAnswerText: string | null;
  explanation: string | null;
  cognitiveLevel: string | null;
  tags: string[];
  savedAt: string | null;
}

export interface DraftParsedContent {
  detection: DraftDetectionInfo;
  aiExtraction?: DraftAIExtractionState;
  review?: DraftReviewData;
  rejectReason?: string | null;
}

const EMPTY_DETECTION: DraftDetectionInfo = {
  questionNumberLabel: null,
  pageNumber: null,
  detectionMethod: "unknown",
  confidence: "low",
  warning: null,
  order: 0,
};

/** Đọc lại parsedContent (Json, kiểu unknown từ Prisma) thành shape đã biết — luôn có fallback an toàn. */
export function readDraftParsedContent(value: unknown): DraftParsedContent {
  if (value && typeof value === "object" && "detection" in value) {
    return value as DraftParsedContent;
  }
  // Draft cũ từ Phase 7A lưu trực tiếp shape detection ở top-level (không có key "detection" bọc ngoài).
  if (value && typeof value === "object") {
    return { detection: { ...EMPTY_DETECTION, ...(value as Partial<DraftDetectionInfo>) } };
  }
  return { detection: EMPTY_DETECTION };
}

export function buildReviewFromExtraction(result: QuestionExtractionResult): DraftReviewData {
  return {
    questionText: result.questionText,
    questionType: result.questionType,
    options: result.options.map((o, i) => ({
      label: o.label || String.fromCharCode(65 + i),
      text: o.text,
      isCorrect: o.isCorrect,
    })),
    correctAnswerText: result.correctAnswerText,
    explanation: result.explanation,
    cognitiveLevel: result.cognitiveLevel,
    tags: result.tags ?? [],
    savedAt: null,
  };
}
