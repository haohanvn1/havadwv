import { describe, expect, it } from "vitest";
import { detectQuestionCandidates } from "@/server/services/questionCandidateDetector";
import type { ParsedDocument } from "@/server/services/documentParser";

function docFromText(text: string, pages?: { pageNumber: number; text: string }[]): ParsedDocument {
  return {
    sourceType: "DOCX",
    text,
    pages,
    metadata: { wordCount: text.split(/\s+/).filter(Boolean).length },
  };
}

describe("detectQuestionCandidates — pattern 'Câu N.'", () => {
  it("tách đúng số câu theo pattern 'Câu N.'", () => {
    const text = "Câu 1. Nội dung câu 1.\nA. x B. y\nCâu 2. Nội dung câu 2.\nA. x B. y\nCâu 3. Nội dung câu 3.";
    const candidates = detectQuestionCandidates(docFromText(text));

    expect(candidates).toHaveLength(3);
    expect(candidates[0].questionNumberLabel).toBe("1");
    expect(candidates[0].confidence).toBe("high");
    expect(candidates[0].detectionMethod).toBe("cau-prefix");
    expect(candidates[0].rawText).toContain("Nội dung câu 1");
    expect(candidates[0].rawText).not.toContain("Câu 2");
    expect(candidates[2].questionNumberLabel).toBe("3");
  });
});

describe("detectQuestionCandidates — pattern 'N.' (đánh số thuần)", () => {
  it("tách đúng khi không có prefix Câu/Question", () => {
    const text = "1. Nội dung câu 1.\n2. Nội dung câu 2.\n3. Nội dung câu 3.";
    const candidates = detectQuestionCandidates(docFromText(text));

    expect(candidates).toHaveLength(3);
    expect(candidates[0].detectionMethod).toBe("plain-number");
    expect(candidates[1].questionNumberLabel).toBe("2");
  });
});

describe("detectQuestionCandidates — pattern 'Question N'", () => {
  it("tách đúng số câu theo pattern tiếng Anh", () => {
    const text = "Question 1. What is X?\nQuestion 2. What is Y?";
    const candidates = detectQuestionCandidates(docFromText(text));

    expect(candidates).toHaveLength(2);
    expect(candidates[0].detectionMethod).toBe("question-prefix");
    expect(candidates[1].questionNumberLabel).toBe("2");
  });

  it("ưu tiên 'Câu N.' hơn 'Question N' và 'plain-number' khi văn bản có cả nhóm khớp 'Câu'", () => {
    const text = "Câu 1. A?\nCâu 2. B?\n1. option a\n2. option b";
    const candidates = detectQuestionCandidates(docFromText(text));
    expect(candidates.every((c) => c.detectionMethod === "cau-prefix")).toBe(true);
  });
});

describe("detectQuestionCandidates — không detect được", () => {
  it("fallback giữ nguyên toàn bộ text, đánh dấu cảnh báo, không mất dữ liệu", () => {
    const text = "Đây là một đoạn văn bản tự do, không có cấu trúc câu hỏi rõ ràng nào cả.";
    const candidates = detectQuestionCandidates(docFromText(text));

    expect(candidates).toHaveLength(1);
    expect(candidates[0].detectionMethod).toBe("fallback-whole-document");
    expect(candidates[0].confidence).toBe("low");
    expect(candidates[0].warning).toBeTruthy();
    expect(candidates[0].rawText).toBe(text);
  });

  it("chỉ có 1 câu khớp pattern (không đủ tin cậy) → vẫn fallback", () => {
    const text = "Câu 1. Chỉ có một câu duy nhất trong tài liệu này.";
    const candidates = detectQuestionCandidates(docFromText(text));
    expect(candidates[0].detectionMethod).toBe("fallback-whole-document");
  });
});

describe("detectQuestionCandidates — page tracing (PDF nhiều trang)", () => {
  it("gán đúng pageNumber cho từng candidate dựa theo trang chứa nó", () => {
    const page1 = "Câu 1. Nội dung ở trang 1.";
    const page2 = "Câu 2. Nội dung ở trang 2.";
    const text = `${page1}\n${page2}`;
    const document: ParsedDocument = {
      sourceType: "PDF",
      text,
      pages: [
        { pageNumber: 1, text: page1 },
        { pageNumber: 2, text: page2 },
      ],
      metadata: { pageCount: 2, wordCount: text.split(/\s+/).length },
    };

    const candidates = detectQuestionCandidates(document);
    expect(candidates[0].pageNumber).toBe(1);
    expect(candidates[1].pageNumber).toBe(2);
  });
});
