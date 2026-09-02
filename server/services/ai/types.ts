import { z } from "zod";

export const extractedOptionSchema = z.object({
  label: z.string().describe("Nhãn đáp án đã chuẩn hoá, vd A/B/C/D — không cần trùng định dạng gốc."),
  text: z.string().describe("Nội dung đáp án, giữ nguyên ký hiệu toán học/tiếng Việt tối đa có thể."),
  isCorrect: z.boolean(),
});

/**
 * Structured output schema — dùng trực tiếp với `client.messages.parse()` +
 * `zodOutputFormat()` để AI luôn trả JSON đúng shape (không parse bằng regex
 * mong manh). Vẫn re-validate ở tầng service vì AI output luôn là untrusted
 * input dù provider có "đảm bảo" structured output đến đâu.
 */
export const questionExtractionResultSchema = z.object({
  questionText: z.string().describe("Nội dung câu hỏi, không bao gồm các lựa chọn đáp án."),
  questionType: z.enum(["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER"]),
  options: z
    .array(extractedOptionSchema)
    .describe("Rỗng nếu questionType là SHORT_ANSWER."),
  correctAnswerText: z
    .string()
    .nullable()
    .describe("Chỉ dùng khi questionType là SHORT_ANSWER — null nếu không xác định được."),
  explanation: z.string().nullable().describe("Lời giải/giải thích nếu có trong văn bản gốc."),
  suggestedSubjectText: z
    .string()
    .nullable()
    .describe("Tên môn học được đề xuất dưới dạng text tự do — KHÔNG phải ID, Admin sẽ map thủ công."),
  suggestedTopicText: z.string().nullable(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).nullable(),
  cognitiveLevel: z.string().nullable(),
  tags: z.array(z.string()).default([]),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("0 đến 1 — mức độ tự tin của việc trích xuất, chỉ là tín hiệu ưu tiên review."),
  warnings: z.array(z.string()).default([]),
});

export type QuestionExtractionResult = z.infer<typeof questionExtractionResultSchema>;

export interface QuestionExtractionInput {
  rawText: string;
  sourceFilename: string;
  sourcePageNumber: number | null;
  /** Ngữ cảnh phần/section nếu phát hiện được (vd "PHẦN I — Trắc nghiệm nhiều phương án"). */
  documentContext?: string;
  /** Gợi ý đáp án phát hiện được bằng regex xác định (dấu *, "Đáp án:") — coi là bằng chứng mạnh, không phải để AI tự đoán lại. */
  answerHintText?: string;
  /** Đoạn trích từ file đáp án riêng nếu import job có 2 file (Phase 7B: chỉ thiết kế chỗ cắm, chưa triển khai upload 2 file). */
  answerKeyText?: string;
}

export class AIExtractionError extends Error {
  constructor(
    message: string,
    readonly cause_?: unknown,
    readonly retryable: boolean = true,
  ) {
    super(message);
    this.name = "AIExtractionError";
  }
}

export class AIProviderNotConfiguredError extends AIExtractionError {
  constructor(message: string) {
    super(message, undefined, false);
    this.name = "AIProviderNotConfiguredError";
  }
}

export interface AIQuestionExtractor {
  extract(input: QuestionExtractionInput): Promise<QuestionExtractionResult>;
}
