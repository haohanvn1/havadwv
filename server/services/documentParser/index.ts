import "server-only";
import { PDF_MIME_TYPE, DOCX_MIME_TYPE } from "@/lib/constants/import";
import { PdfDocumentParser } from "./pdfParser";
import { DocxDocumentParser } from "./docxParser";
import { DocumentParseError, type DocumentParser } from "./types";

export type { ParsedDocument, ParsedDocumentPage, DocumentParser } from "./types";
export { DocumentParseError };

const parsers: Record<string, DocumentParser> = {
  [PDF_MIME_TYPE]: new PdfDocumentParser(),
  [DOCX_MIME_TYPE]: new DocxDocumentParser(),
};

/** Registry chọn parser theo mimeType — thêm định dạng mới chỉ cần đăng ký thêm ở đây. */
export async function parseDocument(buffer: Buffer, mimeType: string) {
  const parser = parsers[mimeType];
  if (!parser) {
    throw new DocumentParseError("Định dạng tệp không được hỗ trợ.");
  }
  return parser.parse(buffer);
}
