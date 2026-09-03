export const PDF_MIME_TYPE = "application/pdf";
export const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const ALLOWED_IMPORT_MIME_TYPES = [PDF_MIME_TYPE, DOCX_MIME_TYPE] as const;
export const ALLOWED_IMPORT_EXTENSIONS = [".pdf", ".docx"] as const;

/** 20MB — đủ cho hầu hết đề thi dạng PDF/DOCX có text layer, không cần OCR ảnh nặng ở Phase 7A. */
export const MAX_IMPORT_FILE_SIZE_BYTES = 20 * 1024 * 1024;

export const IMPORT_JOB_STATUS_LABELS: Record<string, string> = {
  PENDING: "Đang chờ xử lý",
  PROCESSING: "Đang xử lý",
  DONE: "Hoàn thành",
  FAILED: "Thất bại",
};
