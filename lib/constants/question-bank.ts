import { Difficulty, QuestionStatus, QuestionType } from "@/lib/generated/prisma/enums";

/**
 * Nguồn nhãn tiếng Việt duy nhất cho các enum của Question — filter và form
 * đều import từ đây để không lệch nhau. Không tạo enum DB mới cho các field
 * này, chỉ ánh xạ nhãn hiển thị cho enum đã có sẵn trong schema.
 */
export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  SINGLE_CHOICE: "Một đáp án đúng",
  MULTIPLE_CHOICE: "Nhiều đáp án đúng",
  TRUE_FALSE: "Đúng / Sai",
  SHORT_ANSWER: "Tự luận ngắn",
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  EASY: "Dễ",
  MEDIUM: "Trung bình",
  HARD: "Khó",
};

export const QUESTION_STATUS_LABELS: Record<QuestionStatus, string> = {
  DRAFT: "Nháp",
  ACTIVE: "Đang dùng",
  ARCHIVED: "Đã lưu trữ",
};

export const QUESTION_TYPE_OPTIONS = Object.values(QuestionType);
export const DIFFICULTY_OPTIONS = Object.values(Difficulty);
export const QUESTION_STATUS_OPTIONS = Object.values(QuestionStatus);

/**
 * cognitiveLevel trong schema là String? tự do (không phải enum DB) — nhóm
 * mức độ tư duy chuẩn của đề thi ĐGNL/ĐGTD/THPT được cố định thành một danh
 * sách hằng số ở tầng ứng dụng để filter và form dùng chung một nguồn, mà
 * không cần thêm enum/migration mới.
 */
export const COGNITIVE_LEVELS = [
  { value: "NHAN_BIET", label: "Nhận biết" },
  { value: "THONG_HIEU", label: "Thông hiểu" },
  { value: "VAN_DUNG", label: "Vận dụng" },
  { value: "VAN_DUNG_CAO", label: "Vận dụng cao" },
] as const;

export type CognitiveLevelValue = (typeof COGNITIVE_LEVELS)[number]["value"];

export const COGNITIVE_LEVEL_LABELS: Record<string, string> = Object.fromEntries(
  COGNITIVE_LEVELS.map((level) => [level.value, level.label]),
);

export const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 20;

export const SORT_OPTIONS = [
  { value: "createdAt_desc", label: "Mới tạo trước" },
  { value: "createdAt_asc", label: "Tạo lâu nhất trước" },
  { value: "updatedAt_desc", label: "Cập nhật gần đây" },
  { value: "difficulty_asc", label: "Độ khó: Dễ → Khó" },
  { value: "difficulty_desc", label: "Độ khó: Khó → Dễ" },
  { value: "year_desc", label: "Năm: mới → cũ" },
  { value: "year_asc", label: "Năm: cũ → mới" },
] as const;

export type SortOption = (typeof SORT_OPTIONS)[number]["value"];
export const DEFAULT_SORT: SortOption = "createdAt_desc";
export const SORT_VALUES = SORT_OPTIONS.map((option) => option.value);

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];
export function optionLabelForIndex(index: number): string {
  return OPTION_LETTERS[index] ?? String(index + 1);
}
