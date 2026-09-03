import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export interface FileStorageMetadata {
  sizeBytes: number;
}

/**
 * Abstraction cho nơi lưu file gốc đã upload — business logic (questionImportService)
 * chỉ biết tới interface này, không biết đang lưu ở local disk hay object storage.
 * Đổi sang S3/R2/Supabase Storage/... sau này chỉ cần viết thêm một implementation
 * mới của interface này, không phải sửa nơi gọi.
 */
export interface FileStorageService {
  save(params: { key: string; buffer: Buffer }): Promise<void>;
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  getMetadata(key: string): Promise<FileStorageMetadata | null>;
}

const STORAGE_ROOT = process.env.IMPORT_STORAGE_DIR
  ? path.resolve(process.env.IMPORT_STORAGE_DIR)
  : path.join(process.cwd(), "storage", "imports");

/**
 * `key` luôn do server tự sinh (xem generateImportStorageKey) nên không thực
 * sự nhận input từ client — kiểm tra lại ở đây chỉ để phòng lỗi lập trình
 * (không phải lớp chống path traversal chính, lớp chính là không bao giờ
 * dùng filename/path do client cung cấp để dựng storage key).
 */
function resolveSafePath(key: string): string {
  const resolved = path.resolve(STORAGE_ROOT, key);
  if (resolved !== STORAGE_ROOT && !resolved.startsWith(STORAGE_ROOT + path.sep)) {
    throw new Error("Đường dẫn lưu trữ không hợp lệ.");
  }
  return resolved;
}

class LocalFileStorageService implements FileStorageService {
  async save({ key, buffer }: { key: string; buffer: Buffer }): Promise<void> {
    const fullPath = resolveSafePath(key);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, buffer);
  }

  async read(key: string): Promise<Buffer> {
    return readFile(resolveSafePath(key));
  }

  async delete(key: string): Promise<void> {
    await rm(resolveSafePath(key), { force: true });
  }

  async getMetadata(key: string): Promise<FileStorageMetadata | null> {
    try {
      const info = await stat(resolveSafePath(key));
      return { sizeBytes: info.size };
    } catch {
      return null;
    }
  }
}

let instance: FileStorageService | null = null;

/** Factory duy nhất để lấy storage service hiện hành — nơi duy nhất cần sửa khi đổi provider. */
export function getFileStorageService(): FileStorageService {
  if (!instance) instance = new LocalFileStorageService();
  return instance;
}

/**
 * Sinh storage key duy nhất, không dựa vào tên file gốc — chặn path traversal
 * và trùng tên ngay từ thiết kế, đúng ví dụ "imports/{uuid}/original.pdf".
 * `extension` phải đã được validate/whitelist trước khi gọi (vd ".pdf", ".docx").
 */
export function generateImportStorageKey(extension: string): string {
  return `imports/${randomUUID()}/original${extension}`;
}
