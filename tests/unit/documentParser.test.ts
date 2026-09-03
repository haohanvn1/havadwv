import path from "node:path";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PdfDocumentParser } from "@/server/services/documentParser/pdfParser";
import { DocxDocumentParser } from "@/server/services/documentParser/docxParser";
import { DocumentParseError, parseDocument } from "@/server/services/documentParser";
import { PDF_MIME_TYPE, DOCX_MIME_TYPE } from "@/lib/constants/import";

const FIXTURES_DIR = path.join(process.cwd(), "tests", "fixtures");

describe("PdfDocumentParser", () => {
  const parser = new PdfDocumentParser();

  it("trích xuất đúng text theo từng trang từ PDF thật (2 trang)", async () => {
    const buffer = readFileSync(path.join(FIXTURES_DIR, "sample.pdf"));
    const result = await parser.parse(buffer);

    expect(result.sourceType).toBe("PDF");
    expect(result.pages).toHaveLength(2);
    expect(result.pages?.[0].pageNumber).toBe(1);
    expect(result.pages?.[0].text).toContain("Cau 1");
    expect(result.pages?.[1].pageNumber).toBe(2);
    expect(result.pages?.[1].text).toContain("Cau 2");
    expect(result.text).toBe(`${result.pages?.[0].text}\n${result.pages?.[1].text}`);
    expect(result.metadata.pageCount).toBe(2);
    expect(result.metadata.wordCount).toBeGreaterThan(0);
  });

  it("PDF hỏng/không phải PDF thật (kể cả buffer rỗng) → DocumentParseError, không crash", async () => {
    await expect(parser.parse(Buffer.from("khong phai pdf that"))).rejects.toBeInstanceOf(
      DocumentParseError,
    );
    await expect(parser.parse(Buffer.alloc(0))).rejects.toBeInstanceOf(DocumentParseError);
  });
});

describe("DocxDocumentParser", () => {
  const parser = new DocxDocumentParser();

  it("trích xuất đúng text từ DOCX thật", async () => {
    const buffer = readFileSync(path.join(FIXTURES_DIR, "sample.docx"));
    const result = await parser.parse(buffer);

    expect(result.sourceType).toBe("DOCX");
    expect(result.pages).toBeUndefined();
    expect(result.text).toContain("Question 1");
    expect(result.text).toContain("Question 2");
    expect(result.metadata.wordCount).toBeGreaterThan(0);
  });

  it("DOCX hỏng/không phải zip hợp lệ (kể cả buffer rỗng) → DocumentParseError, không crash", async () => {
    await expect(parser.parse(Buffer.from("khong phai docx that"))).rejects.toBeInstanceOf(
      DocumentParseError,
    );
    await expect(parser.parse(Buffer.alloc(0))).rejects.toBeInstanceOf(DocumentParseError);
  });
});

describe("parseDocument registry", () => {
  it("chọn đúng parser theo mimeType", async () => {
    const pdfBuffer = readFileSync(path.join(FIXTURES_DIR, "sample.pdf"));
    const result = await parseDocument(pdfBuffer, PDF_MIME_TYPE);
    expect(result.sourceType).toBe("PDF");

    const docxBuffer = readFileSync(path.join(FIXTURES_DIR, "sample.docx"));
    const docxResult = await parseDocument(docxBuffer, DOCX_MIME_TYPE);
    expect(docxResult.sourceType).toBe("DOCX");
  });

  it("mimeType không được hỗ trợ → DocumentParseError thân thiện", async () => {
    await expect(parseDocument(Buffer.from("x"), "image/png")).rejects.toBeInstanceOf(
      DocumentParseError,
    );
  });
});
