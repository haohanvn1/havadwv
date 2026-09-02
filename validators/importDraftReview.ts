import { z } from "zod";
import { Difficulty, QuestionType } from "@/lib/generated/prisma/enums";

const questionTypeValues = Object.values(QuestionType) as [QuestionType, ...QuestionType[]];
const difficultyValues = Object.values(Difficulty) as [Difficulty, ...Difficulty[]];

const emptyToUndefined = (val: unknown) => (val === "" || val === null ? undefined : val);
const emptyToNull = (val: unknown) => (val === "" || val === undefined ? null : val);

const reviewOptionSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().min(1),
  text: z.string().trim().min(1, "Nội dung đáp án không được để trống."),
  isCorrect: z.boolean(),
});

/** Payload PATCH /api/admin/question-imports/:id/drafts/:draftId — lưu bản Admin đang chỉnh sửa, KHÔNG tạo Question. */
export const saveDraftReviewSchema = z.object({
  questionText: z.string().trim().min(1, "Nội dung câu hỏi không được để trống."),
  questionType: z.enum(questionTypeValues, { error: "Loại câu hỏi không hợp lệ." }),
  options: z.array(reviewOptionSchema).default([]),
  correctAnswerText: z.preprocess(emptyToNull, z.string().trim().nullable()),
  explanation: z.preprocess(emptyToNull, z.string().trim().nullable()),
  cognitiveLevel: z.preprocess(emptyToNull, z.string().trim().nullable()),
  tags: z.array(z.string().trim().min(1)).default([]),
  subjectId: z.preprocess(emptyToUndefined, z.string().uuid().nullable().default(null)),
  topicId: z.preprocess(emptyToUndefined, z.string().uuid().nullable().default(null)),
  difficulty: z.preprocess(emptyToUndefined, z.enum(difficultyValues).nullable().default(null)),
});

export type SaveDraftReviewPayload = z.infer<typeof saveDraftReviewSchema>;
