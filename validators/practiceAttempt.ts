import { z } from "zod";
import { Difficulty, QuestionType } from "@/lib/generated/prisma/enums";

/**
 * Whitelist server-quyết-định cho số câu Practice — client không được tự do
 * chọn số bất kỳ (mục 9 Phase 11). Cũng dùng làm nguồn duy nhất cho dropdown
 * phía client (import từ đây, không định nghĩa lại).
 */
export const PRACTICE_QUESTION_COUNTS = [10, 20, 30, 50] as const;
export type PracticeQuestionCount = (typeof PRACTICE_QUESTION_COUNTS)[number];

const uuidSchema = z.string().uuid("Giá trị không hợp lệ.");

/**
 * Dùng chung cho cả preview lẫn start — start có thêm questionCount bắt
 * buộc. `.strict()`: reject thẳng nếu client cố gửi thêm field lạ
 * (studentId, mode, examId, questionIds, snapshot, ...) thay vì âm thầm bỏ
 * qua — server tự quyết định mọi thứ ngoài 5 field này (mục 15/29).
 */
export const practiceFilterSchema = z
  .object({
    subjectId: uuidSchema,
    topicId: z.preprocess((v) => (v === "" || v === null ? undefined : v), uuidSchema.optional()),
    difficulty: z.preprocess(
      (v) => (v === "" || v === null ? undefined : v),
      z.enum(Object.values(Difficulty) as [Difficulty, ...Difficulty[]]).optional(),
    ),
    questionType: z.preprocess(
      (v) => (v === "" || v === null ? undefined : v),
      z.enum(Object.values(QuestionType) as [QuestionType, ...QuestionType[]]).optional(),
    ),
  })
  .strict();

export const practiceStartSchema = practiceFilterSchema
  .extend({
    questionCount: z.number().refine((v) => (PRACTICE_QUESTION_COUNTS as readonly number[]).includes(v), {
      message: "Số câu không hợp lệ.",
    }),
  })
  .strict();

export type PracticeFilterInput = z.infer<typeof practiceFilterSchema>;
export type PracticeStartInput = z.infer<typeof practiceStartSchema>;

export function validatePracticeFilter(
  raw: unknown,
): { success: true; data: PracticeFilterInput } | { success: false; error: string } {
  const parsed = practiceFilterSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  return { success: true, data: parsed.data };
}

export function validatePracticeStart(
  raw: unknown,
): { success: true; data: PracticeStartInput } | { success: false; error: string } {
  const parsed = practiceStartSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  return { success: true, data: parsed.data };
}
