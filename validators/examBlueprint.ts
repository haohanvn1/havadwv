import { z } from "zod";
import { Difficulty, QuestionType } from "@/lib/generated/prisma/enums";
import { COGNITIVE_LEVELS } from "@/lib/constants/question-bank";

const questionTypeValues = Object.values(QuestionType) as [QuestionType, ...QuestionType[]];
const difficultyValues = Object.values(Difficulty) as [Difficulty, ...Difficulty[]];
const cognitiveLevelValues = COGNITIVE_LEVELS.map((level) => level.value) as [string, ...string[]];

const emptyToUndefined = (val: unknown) => (val === "" || val === null ? undefined : val);

export const blueprintRuleInputSchema = z.object({
  subjectId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  topicId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  questionType: z.preprocess(emptyToUndefined, z.enum(questionTypeValues).optional()),
  difficulty: z.preprocess(emptyToUndefined, z.enum(difficultyValues).optional()),
  cognitiveLevel: z.preprocess(emptyToUndefined, z.enum(cognitiveLevelValues).optional()),
  year: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1990).max(2100).optional()),
  source: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  requiredTags: z.array(z.string().trim().min(1)).default([]),
  quantity: z.coerce
    .number({ error: "Số lượng câu phải là số." })
    .int("Số lượng câu phải là số nguyên.")
    .positive("Số lượng câu phải lớn hơn 0."),
});

export const blueprintSectionInputSchema = z.object({
  name: z.string().trim().min(1, "Tên Section không được để trống."),
  rules: z.array(blueprintRuleInputSchema).min(1, "Section phải có ít nhất 1 Rule."),
});

export const blueprintInputSchema = z.object({
  name: z.string().trim().min(1, "Tên Blueprint không được để trống."),
  examType: z.string().trim().min(1, "Vui lòng nhập loại đề (vd: ĐGNL, THPT)."),
  subjectId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  durationMinutes: z.coerce
    .number({ error: "Thời lượng phải là số." })
    .int("Thời lượng phải là số nguyên.")
    .positive("Thời lượng phải lớn hơn 0."),
  sections: z.array(blueprintSectionInputSchema).min(1, "Blueprint phải có ít nhất 1 Section."),
});

export type BlueprintRuleInput = z.infer<typeof blueprintRuleInputSchema>;
export type BlueprintSectionInput = z.infer<typeof blueprintSectionInputSchema>;
export type BlueprintInput = z.infer<typeof blueprintInputSchema>;

export type BlueprintFieldErrors = Record<string, string>;
export type BlueprintInputResult =
  | { success: true; data: BlueprintInput }
  | { success: false; errors: BlueprintFieldErrors };

/**
 * Validate cấu trúc + shape của payload Blueprint bằng Zod (mục 29 — không
 * trust quantity/subjectId/topicId/... từ client). Các ràng buộc cần tra DB
 * (subject/topic tồn tại, topic thuộc đúng subject) nằm ở
 * blueprintService.assertBlueprintReferentialIntegrity vì cần async/Prisma —
 * tách khỏi hàm thuần này để giữ validate cấu trúc dễ test, nhanh, không cần DB.
 */
export function validateBlueprintInput(raw: unknown): BlueprintInputResult {
  const parsed = blueprintInputSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: BlueprintFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "form";
      if (!errors[key]) errors[key] = issue.message;
    }
    return { success: false, errors };
  }

  const totalQuestions = parsed.data.sections.reduce(
    (sum, section) => sum + section.rules.reduce((s, r) => s + r.quantity, 0),
    0,
  );
  if (totalQuestions === 0) {
    return { success: false, errors: { sections: "Tổng số câu hỏi trong Blueprint phải lớn hơn 0." } };
  }

  return { success: true, data: parsed.data };
}
