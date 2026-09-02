import "server-only";
import mammoth from "mammoth";
import { DocumentParseError, type DocumentParser, type ParsedDocument } from "./types";

export class DocxDocumentParser implements DocumentParser {
  async parse(buffer: Buffer): Promise<ParsedDocument> {
    let result;
    try {
      result = await mammoth.extractRawText({ buffer });
    } catch (error) {
      throw new DocumentParseError("Không thể đọc nội dung tệp DOCX.", error);
    }

    const text = result.value.replace(/\r\n/g, "\n").trim();
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    if (wordCount === 0) {
      throw new DocumentParseError("Tệp DOCX không có nội dung văn bản.");
    }

    return {
      sourceType: "DOCX",
      text,
      metadata: { wordCount },
    };
  }
}
