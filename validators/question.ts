import { z } from "zod";
import { Difficulty, QuestionStatus, QuestionType } from "@/lib/generated/prisma/enums";
import {
  COGNITIVE_LEVELS,
  DEFAULT_PAGE_SIZE,
  DEFAULT_SORT,
  PAGE_SIZE_OPTIONS,
  SORT_VALUES,
  type SortOption,
} from "@/lib/constants/question-bank";

const questionTypeValues = Object.values(QuestionType) as [QuestionType, ...QuestionType[]];
const difficultyValues = Object.values(Difficulty) as [Difficulty, ...Difficulty[]];
const questionStatusValues = Object.values(QuestionStatus) as [QuestionStatus, ...QuestionStatus[]];
const cognitiveLevelValues = COGNITIVE_LEVELS.map((level) => level.value) as [
  string,
  ...string[],
];

const emptyToUndefined = (val: unknown) => (val === "" || val === null ? undefined : val);

const optionInputSchema = z.object({
  id: z.string().uuid().optional(),
  content: z.string().trim().min(1, "Nội dung đáp án không được để trống."),
  isCorrect: z.boolean(),
});

export const questionInputSchema = z.object({
  content: z
    .string({ error: "Nội dung câu hỏi không được để trống." })
    .trim()
    .min(1, "Nội dung câu hỏi không được để trống."),
  type: z.enum(questionTypeValues, { error: "Loại câu hỏi không hợp lệ." }),
  subjectId: z.string({ error: "Vui lòng chọn môn học." }).uuid("Vui lòng chọn môn học."),
  topicId: z.string({ error: "Vui lòng chọn chủ đề." }).uuid("Vui lòng chọn chủ đề."),
  difficulty: z.enum(difficultyValues, { error: "Độ khó không hợp lệ." }),
  cognitiveLevel: z.preprocess(emptyToUndefined, z.enum(cognitiveLevelValues).optional()),
  hint: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  explanation: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  source: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  year: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1990).max(2100).optional()),
  tags: z.array(z.string().trim().min(1)).default([]),
  status: z.enum(questionStatusValues).default("DRAFT"),
  correctAnswerText: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  trueFalseAnswer: z.preprocess(emptyToUndefined, z.enum(["TRUE", "FALSE"]).optional()),
  options: z.array(optionInputSchema).default([]),
});

export type QuestionInput = z.infer<typeof questionInputSchema>;
export type QuestionFieldErrors = Record<string, string>;

export type QuestionInputResult =
  | { success: true; data: QuestionInput }
  | { success: false; errors: QuestionFieldErrors };

/**
 * Validate toàn bộ payload tạo/sửa Question, gồm cả rule phụ thuộc loại câu
 * hỏi (section 27) mà zod schema đơn thuần không diễn tả được (vd số lượng
 * đáp án đúng khác nhau theo từng QuestionType).
 */
export function validateQuestionInput(raw: unknown): QuestionInputResult {
  const parsed = questionInputSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: QuestionFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "form";
      if (!errors[key]) errors[key] = issue.message;
    }
    return { success: false, errors };
  }

  const data = parsed.data;
  const errors: QuestionFieldErrors = {};

  switch (data.type) {
    case "SINGLE_CHOICE": {
      if (data.options.length < 2) {
        errors.options = "Câu một đáp án đúng cần ít nhất 2 lựa chọn.";
      } else if (data.options.filter((o) => o.isCorrect).length !== 1) {
        errors.options = "Câu một đáp án đúng phải có đúng 1 đáp án đúng.";
      }
      break;
    }
    case "MULTIPLE_CHOICE": {
      if (data.options.length < 2) {
        errors.options = "Câu nhiều đáp án đúng cần ít nhất 2 lựa chọn.";
      } else if (data.options.filter((o) => o.isCorrect).length < 1) {
        errors.options = "Cần ít nhất 1 đáp án đúng.";
      }
      break;
    }
    case "TRUE_FALSE": {
      if (!data.trueFalseAnswer) {
        errors.trueFalseAnswer = "Vui lòng chọn đáp án Đúng hoặc Sai.";
      }
      break;
    }
    case "SHORT_ANSWER": {
      if (!data.correctAnswerText) {
        errors.correctAnswerText = "Vui lòng nhập đáp án đúng.";
      }
      break;
    }
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return { success: true, data };
}

// ---------- List query (search/filter/sort/pagination) ----------

export interface QuestionListParams {
  page: number;
  pageSize: number;
  search?: string;
  subjectId?: string;
  topicId?: string;
  type?: string;
  difficulty?: string;
  cognitiveLevel?: string;
  status?: string;
  year?: number;
  sort: SortOption;
}

const uuidSchema = z.string().uuid();

function readEnum<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  if (!value) return undefined;
  return (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

function readUuid(value: string | null): string | undefined {
  if (!value) return undefined;
  return uuidSchema.safeParse(value).success ? value : undefined;
}

/**
 * Parse query string thành filter đã được validate/whitelist đầy đủ — không
 * bao giờ truyền thẳng giá trị từ client vào Prisma orderBy/where mà chưa
 * qua allow-list, tránh client tự ý truyền field/order tuỳ ý.
 */
export function parseQuestionListParams(searchParams: URLSearchParams): QuestionListParams {
  const pageRaw = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  const pageSizeRaw = Number.parseInt(searchParams.get("pageSize") ?? "", 10);
  const pageSize = (PAGE_SIZE_OPTIONS as readonly number[]).includes(pageSizeRaw)
    ? pageSizeRaw
    : DEFAULT_PAGE_SIZE;

  const yearRaw = Number.parseInt(searchParams.get("year") ?? "", 10);
  const year = Number.isFinite(yearRaw) && yearRaw >= 1990 && yearRaw <= 2100 ? yearRaw : undefined;

  const search = searchParams.get("search")?.trim() || undefined;

  return {
    page,
    pageSize,
    search,
    subjectId: readUuid(searchParams.get("subjectId")),
    topicId: readUuid(searchParams.get("topicId")),
    type: readEnum(searchParams.get("type"), questionTypeValues),
    difficulty: readEnum(searchParams.get("difficulty"), difficultyValues),
    cognitiveLevel: readEnum(searchParams.get("cognitiveLevel"), cognitiveLevelValues),
    status: readEnum(searchParams.get("status"), questionStatusValues),
    year,
    sort: readEnum(searchParams.get("sort"), SORT_VALUES) ?? DEFAULT_SORT,
  };
}
