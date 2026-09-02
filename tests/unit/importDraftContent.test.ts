import { describe, expect, it } from "vitest";
import { buildReviewFromExtraction, readDraftParsedContent } from "@/server/services/importDraftContent";
import { buildMockExtractionResult } from "@/server/services/ai/mockQuestionExtractor";

describe("readDraftParsedContent — tương thích ngược với draft Phase 7A cũ", () => {
  it("đọc đúng shape mới (bọc trong { detection })", () => {
    const value = { detection: { questionNumberLabel: "1", pageNumber: 2, detectionMethod: "cau-prefix", confidence: "high", warning: null, order: 0 } };
    const result = readDraftParsedContent(value);
    expect(result.detection.pageNumber).toBe(2);
  });

  it("đọc đúng shape cũ Phase 7A (field ở top-level, không bọc detection)", () => {
    const legacyValue = {
      questionNumberLabel: "3",
      pageNumber: 5,
      detectionMethod: "plain-number",
      confidence: "low",
      warning: "test warning",
      order: 2,
    };
    const result = readDraftParsedContent(legacyValue);
    expect(result.detection.pageNumber).toBe(5);
    expect(result.detection.warning).toBe("test warning");
  });

  it("giá trị null/undefined/không phải object → fallback an toàn, không throw", () => {
    expect(readDraftParsedContent(null).detection.confidence).toBe("low");
    expect(readDraftParsedContent(undefined).detection.confidence).toBe("low");
    expect(readDraftParsedContent("garbage").detection.confidence).toBe("low");
  });
});

describe("buildReviewFromExtraction", () => {
  it("map đúng từ QuestionExtractionResult sang DraftReviewData, savedAt = null (chưa Admin lưu)", () => {
    const extraction = buildMockExtractionResult({
      questionText: "Câu hỏi test",
      options: [
        { label: "A", text: "Sai", isCorrect: false },
        { label: "B", text: "Đúng", isCorrect: true },
      ],
    });
    const review = buildReviewFromExtraction(extraction);
    expect(review.questionText).toBe("Câu hỏi test");
    expect(review.options).toHaveLength(2);
    expect(review.options[1].isCorrect).toBe(true);
    expect(review.savedAt).toBeNull();
  });
});
