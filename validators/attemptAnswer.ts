import { z } from "zod";
import type { QuestionType } from "@/lib/generated/prisma/enums";
import type { SnapshotQuestion } from "@/server/services/examSnapshotService";

const singleChoiceSchema = z
  .object({ selectedOptionId: z.string().uuid().nullable() })
  .strict();
const multipleChoiceSchema = z
  .object({ selectedOptionIds: z.array(z.string().uuid()) })
  .strict();
const shortAnswerSchema = z.object({ answerText: z.string().nullable() }).strict();

export interface NormalizedAnswer {
  selectedOptionIds: string[];
  answerText: string | null;
  answered: boolean;
}

export type AnswerValidationResult =
  | { success: true; data: NormalizedAnswer }
  | { success: false; error: string };

/**
 * Validate answer đúng theo QuestionType của CHÍNH câu hỏi này trong snapshot
 * (không tin type do client gửi lên) — SINGLE_CHOICE/TRUE_FALSE chỉ nhận 1
 * lựa chọn, MULTIPLE_CHOICE nhận mảng, SHORT_ANSWER nhận text. Option id gửi
 * lên phải thuộc đúng snapshot của câu hỏi này, không được là option của câu
 * khác (mục 18/19). Rỗng/null luôn hợp lệ — nghĩa là "chưa trả lời" (mục 20).
 */
export function validateAnswerPayload(
  questionType: QuestionType,
  snapshotQuestion: SnapshotQuestion,
  raw: unknown,
): AnswerValidationResult {
  const validOptionIds = new Set(snapshotQuestion.options.map((o) => o.id));

  if (questionType === "SINGLE_CHOICE" || questionType === "TRUE_FALSE") {
    const parsed = singleChoiceSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: "Dữ liệu câu trả lời không hợp lệ cho loại câu hỏi này." };
    }
    const { selectedOptionId } = parsed.data;
    if (selectedOptionId && !validOptionIds.has(selectedOptionId)) {
      return { success: false, error: "Đáp án được chọn không thuộc câu hỏi này." };
    }
    return {
      success: true,
      data: {
        selectedOptionIds: selectedOptionId ? [selectedOptionId] : [],
        answerText: null,
        answered: Boolean(selectedOptionId),
      },
    };
  }

  if (questionType === "MULTIPLE_CHOICE") {
    const parsed = multipleChoiceSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: "Dữ liệu câu trả lời không hợp lệ cho loại câu hỏi này." };
    }
    const ids = parsed.data.selectedOptionIds;
    if (new Set(ids).size !== ids.length) {
      return { success: false, error: "Danh sách đáp án chứa lựa chọn trùng lặp." };
    }
    if (ids.some((id) => !validOptionIds.has(id))) {
      return { success: false, error: "Một hoặc nhiều đáp án được chọn không thuộc câu hỏi này." };
    }
    return {
      success: true,
      data: { selectedOptionIds: ids, answerText: null, answered: ids.length > 0 },
    };
  }

  // SHORT_ANSWER
  const parsed = shortAnswerSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: "Dữ liệu câu trả lời không hợp lệ cho loại câu hỏi này." };
  }
  const text = parsed.data.answerText?.trim() || null;
  return { success: true, data: { selectedOptionIds: [], answerText: text, answered: Boolean(text) } };
}
