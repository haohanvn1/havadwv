export interface ParsedDocumentPage {
  pageNumber: number;
  text: string;
}

/**
 * Representation chuẩn hoá — các bước sau (candidate detection, v.v) chỉ làm
 * việc với shape này, không biết/không cần biết tài liệu gốc là PDF hay DOCX.
 * `pages` chỉ có ở PDF (DOCX không có khái niệm trang thật ở tầng text layer).
 */
export interface ParsedDocument {
  sourceType: "PDF" | "DOCX";
  text: string;
  pages?: ParsedDocumentPage[];
  metadata: {
    pageCount?: number;
    wordCount: number;
  };
}

export class DocumentParseError extends Error {
  constructor(
    message: string,
    readonly cause_?: unknown,
  ) {
    super(message);
    this.name = "DocumentParseError";
  }
}

export interface DocumentParser {
  parse(buffer: Buffer): Promise<ParsedDocument>;
}
