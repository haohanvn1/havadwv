import "server-only";
import { prisma } from "@/lib/prisma";
import {
  ALLOWED_IMPORT_EXTENSIONS,
  ALLOWED_IMPORT_MIME_TYPES,
  DOCX_MIME_TYPE,
  MAX_IMPORT_FILE_SIZE_BYTES,
  PDF_MIME_TYPE,
} from "@/lib/constants/import";
import { generateImportStorageKey, getFileStorageService } from "./fileStorageService";
import { DocumentParseError, parseDocument } from "./documentParser";
import { detectQuestionCandidates } from "./questionCandidateDetector";

export class ImportValidationError extends Error {}
export class ImportNotFoundError extends Error {
  constructor() {
    super("Không tìm thấy tiến trình import.");
    this.name = "ImportNotFoundError";
  }
}
/** Chặn re-process khi job đã có câu hỏi được duyệt (Phase 7B) — parse lại sẽ xoá draft, làm mất liên kết approvedQuestionId/traceability, dù Question đã tạo vẫn an toàn. */
export class ImportRetryBlockedError extends Error {
  constructor() {
    super(
      "Không thể phân tích lại vì import này đã có câu hỏi được duyệt — việc phân tích lại sẽ xoá dữ liệu draft đã liên kết.",
    );
    this.name = "ImportRetryBlockedError";
  }
}

/** Magic-byte check trên nội dung thật của buffer — không tin extension/MIME client khai báo. */
const MAGIC_BYTE_CHECKS: Record<string, (buf: Buffer) => boolean> = {
  [PDF_MIME_TYPE]: (buf) => buf.subarray(0, 5).toString("latin1") === "%PDF-",
  [DOCX_MIME_TYPE]: (buf) =>
    buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04,
};

const EXTENSION_TO_MIME: Record<string, string> = {
  ".pdf": PDF_MIME_TYPE,
  ".docx": DOCX_MIME_TYPE,
};

/** Chỉ lấy phần tên file (bỏ mọi path client có thể gửi kèm) + loại ký tự lạ — không dùng để định danh lưu trữ, chỉ để hiển thị. */
function sanitizeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "file";
  const cleaned = base.replace(/[^\p{L}\p{N}._\- ]/gu, "_").trim();
  return cleaned.slice(0, 200) || "file";
}

function getExtension(filename: string): string | null {
  const match = filename.toLowerCase().match(/\.(pdf|docx)$/);
  return match ? match[0] : null;
}

export interface CreateImportJobParams {
  originalFilename: string;
  mimeType: string;
  buffer: Buffer;
  uploadedById: string;
}

/**
 * Validate + lưu file + tạo ImportedFile/ImportJob rồi xử lý ngay (đồng bộ,
 * xem processImportJob) — tài liệu Phase 7A (text layer PDF/DOCX) xử lý đủ
 * nhanh để không cần hàng đợi job riêng; UI vì vậy phản ánh đúng trạng thái
 * thật (không có progress giả) thay vì bịa các bước trung gian không quan
 * sát được từ một request đồng bộ.
 */
export async function createImportJob(params: CreateImportJobParams) {
  const { originalFilename, mimeType, buffer, uploadedById } = params;

  const extension = getExtension(originalFilename);
  if (!extension || !(ALLOWED_IMPORT_EXTENSIONS as readonly string[]).includes(extension)) {
    throw new ImportValidationError("Chỉ hỗ trợ tệp PDF hoặc DOCX.");
  }
  if (!(ALLOWED_IMPORT_MIME_TYPES as readonly string[]).includes(mimeType)) {
    throw new ImportValidationError("Chỉ hỗ trợ tệp PDF hoặc DOCX.");
  }
  if (EXTENSION_TO_MIME[extension] !== mimeType) {
    throw new ImportValidationError("Đuôi tệp và định dạng khai báo không khớp nhau.");
  }
  if (buffer.length === 0) {
    throw new ImportValidationError("Tệp trống.");
  }
  if (buffer.length > MAX_IMPORT_FILE_SIZE_BYTES) {
    throw new ImportValidationError("File vượt quá dung lượng cho phép (tối đa 20MB).");
  }
  if (!MAGIC_BYTE_CHECKS[mimeType]?.(buffer)) {
    throw new ImportValidationError(
      "Nội dung tệp không khớp định dạng đã khai báo. Tệp có thể bị hỏng hoặc đổi đuôi giả.",
    );
  }

  const storageKey = generateImportStorageKey(extension);
  await getFileStorageService().save({ key: storageKey, buffer });

  const importedFile = await prisma.importedFile.create({
    data: {
      filename: sanitizeFilename(originalFilename),
      storagePath: storageKey,
      mimeType,
      sizeBytes: buffer.length,
      uploadedById,
    },
  });

  const importJob = await prisma.importJob.create({
    data: { importedFileId: importedFile.id, status: "PENDING" },
  });

  await processImportJob(importJob.id);

  return getImportJobDetail(importJob.id);
}

/**
 * Xử lý (hoặc xử lý lại) một job: đọc file từ storage → parse → detect →
 * ghi draft. Idempotent theo thiết kế — luôn xoá sạch draft cũ của job này
 * trước khi tạo lại, nên gọi lại (retry) không bao giờ tạo trùng lặp.
 */
export async function processImportJob(importJobId: string) {
  const job = await prisma.importJob.findUnique({
    where: { id: importJobId },
    include: { importedFile: true },
  });
  if (!job) throw new ImportNotFoundError();

  const approvedCount = await prisma.importQuestionDraft.count({
    where: { importJobId, status: "APPROVED" },
  });
  if (approvedCount > 0) {
    throw new ImportRetryBlockedError();
  }

  await prisma.importJob.update({
    where: { id: importJobId },
    data: { status: "PROCESSING", startedAt: new Date(), errorMessage: null },
  });

  await prisma.importQuestionDraft.deleteMany({ where: { importJobId } });

  try {
    const buffer = await getFileStorageService().read(job.importedFile.storagePath);
    const parsed = await parseDocument(buffer, job.importedFile.mimeType);
    const candidates = detectQuestionCandidates(parsed);

    if (candidates.length > 0) {
      await prisma.importQuestionDraft.createMany({
        data: candidates.map((candidate) => ({
          importJobId,
          rawText: candidate.rawText,
          parsedContent: {
            detection: {
              questionNumberLabel: candidate.questionNumberLabel,
              pageNumber: candidate.pageNumber,
              detectionMethod: candidate.detectionMethod,
              confidence: candidate.confidence,
              warning: candidate.warning,
              order: candidate.order,
            },
          },
        })),
      });
    }

    await prisma.importJob.update({
      where: { id: importJobId },
      data: { status: "DONE", completedAt: new Date(), totalExtracted: candidates.length },
    });
  } catch (error) {
    const message =
      error instanceof DocumentParseError
        ? error.message
        : "Không thể xử lý tài liệu. Vui lòng thử lại.";
    console.error("[processImportJob]", importJobId, error);
    await prisma.importJob.update({
      where: { id: importJobId },
      data: { status: "FAILED", completedAt: new Date(), errorMessage: message, totalExtracted: 0 },
    });
  }
}

export async function retryImportJob(importJobId: string) {
  const job = await prisma.importJob.findUnique({ where: { id: importJobId } });
  if (!job) throw new ImportNotFoundError();
  await processImportJob(importJobId);
  return getImportJobDetail(importJobId);
}

export async function listImportJobs() {
  return prisma.importJob.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      errorMessage: true,
      totalExtracted: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
      importedFile: {
        select: { filename: true, mimeType: true, sizeBytes: true, createdAt: true },
      },
    },
  });
}

export async function getImportJobDetail(importJobId: string) {
  return prisma.importJob.findUnique({
    where: { id: importJobId },
    include: {
      importedFile: {
        select: {
          filename: true,
          mimeType: true,
          sizeBytes: true,
          createdAt: true,
          uploadedBy: { select: { fullName: true } },
        },
      },
    },
  });
}

export async function listDraftsForJob(importJobId: string) {
  const job = await prisma.importJob.findUnique({ where: { id: importJobId }, select: { id: true } });
  if (!job) throw new ImportNotFoundError();

  return prisma.importQuestionDraft.findMany({
    where: { importJobId },
    orderBy: { createdAt: "asc" },
  });
}
