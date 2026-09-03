import {
  BlueprintStatus,
  GenerationItemStatus,
  GenerationJobStatus,
} from "@/lib/generated/prisma/enums";

/**
 * Nhãn tiếng Việt cho các enum Blueprint/Generation đã có sẵn trong schema —
 * không tạo enum DB mới, chỉ ánh xạ nhãn hiển thị (giống cách
 * lib/constants/question-bank.ts làm với QuestionStatus/Difficulty).
 */
export const BLUEPRINT_STATUS_LABELS: Record<BlueprintStatus, string> = {
  DRAFT: "Nháp",
  APPROVED: "Đã kích hoạt",
  ARCHIVED: "Đã lưu trữ",
};

export const GENERATION_JOB_STATUS_LABELS: Record<GenerationJobStatus, string> = {
  DRAFT: "Đang khởi tạo",
  PREVIEW: "Đã xem trước",
  CONFIRMED: "Hoàn tất",
  FAILED: "Thất bại",
};

export const GENERATION_ITEM_STATUS_LABELS: Record<GenerationItemStatus, string> = {
  PENDING: "Đang xử lý",
  READY: "Đủ câu hỏi",
  INSUFFICIENT: "Thiếu câu hỏi",
  CONFIRMED: "Đã tạo đề",
};

export const BLUEPRINT_STATUS_OPTIONS = Object.values(BlueprintStatus);
