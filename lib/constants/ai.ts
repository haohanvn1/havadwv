/** Số draft xử lý AI đồng thời tối đa — tránh rate limit/cost explosion khi 1 job có hàng trăm câu. */
export const AI_MAX_CONCURRENCY = Number(process.env.AI_MAX_CONCURRENCY) || 3;

/** Số lần cho phép AI extraction tự động retry khi lỗi tạm thời (không phải Admin bấm "Phân tích lại"). */
export const AI_MAX_AUTO_RETRIES = 2;

/** Giới hạn độ dài raw text gửi cho AI — tránh gửi cả tài liệu khổng lồ cho một draft (không nên xảy ra vì mỗi draft là 1 câu, nhưng phòng trường hợp fallback-whole-document). */
export const AI_MAX_INPUT_CHARS = 8000;

export const AI_CONFIDENCE_THRESHOLDS = {
  high: 0.8,
  medium: 0.5,
} as const;

export function confidenceLevel(confidence: number): "high" | "medium" | "low" {
  if (confidence >= AI_CONFIDENCE_THRESHOLDS.high) return "high";
  if (confidence >= AI_CONFIDENCE_THRESHOLDS.medium) return "medium";
  return "low";
}

export const AI_EXTRACTION_STATUS_LABELS: Record<string, string> = {
  PENDING: "Chưa phân tích",
  PROCESSING: "Đang phân tích",
  DONE: "Đã phân tích",
  FAILED: "Phân tích thất bại",
};
