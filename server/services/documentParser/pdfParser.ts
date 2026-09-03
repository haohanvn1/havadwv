import "server-only";
// Dùng build "legacy" — build mặc định của pdfjs-dist giả định môi trường
// browser/worker và lỗi runtime khi chạy thẳng trong Node (Next.js Route
// Handler chạy Node runtime).
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
// pdf.js không chạy trong Worker thật ở Node nên tự "giả lập worker cùng
// luồng" bằng một `import(this.workerSrc)` động — nhưng Turbopack không nhận
// diện được magic comment `webpackIgnore`/`vite-ignore` mà pdf.js dùng để nhờ
// bundler bỏ qua import đó, nên vẫn cố phân tích tĩnh và resolve sai đường
// dẫn (luôn ra `.next/.../chunks/pdf.worker.mjs`, bỏ qua giá trị workerSrc
// thật truyền vào lúc runtime). Cách né đúng theo tài liệu pdf.js: import
// tĩnh sẵn module worker rồi gán vào `globalThis.pdfjsWorker` — pdf.js kiểm
// tra biến này TRƯỚC khi thử import động, nên không bao giờ chạm nhánh lỗi.
import * as pdfjsWorker from "pdfjs-dist/legacy/build/pdf.worker.mjs";
import { DocumentParseError, type DocumentParser, type ParsedDocument, type ParsedDocumentPage } from "./types";

(globalThis as unknown as { pdfjsWorker?: unknown }).pdfjsWorker = pdfjsWorker;

export class PdfDocumentParser implements DocumentParser {
  async parse(buffer: Buffer): Promise<ParsedDocument> {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useWorkerFetch: false,
      verbosity: 0,
    });

    let doc;
    try {
      doc = await loadingTask.promise;
    } catch (error) {
      throw new DocumentParseError("Không thể đọc nội dung tệp PDF.", error);
    }

    const pages: ParsedDocumentPage[] = [];
    try {
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const text = content.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ")
          .replace(/[ \t]+/g, " ")
          .trim();
        pages.push({ pageNumber: i, text });
      }
    } catch (error) {
      throw new DocumentParseError("Không thể trích xuất nội dung từ tệp PDF.", error);
    } finally {
      await loadingTask.destroy();
    }

    const text = pages.map((p) => p.text).join("\n");
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    if (wordCount === 0) {
      throw new DocumentParseError(
        "Tệp PDF không có nội dung văn bản (có thể là bản scan/hình ảnh — chưa hỗ trợ OCR ở phiên bản này).",
      );
    }

    return {
      sourceType: "PDF",
      text,
      pages,
      metadata: { pageCount: pages.length, wordCount },
    };
  }
}
