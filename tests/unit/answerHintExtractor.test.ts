import { describe, expect, it } from "vitest";
import { extractAnswerHint } from "@/server/services/answerHintExtractor";

describe("extractAnswerHint", () => {
  it("phát hiện đáp án đánh dấu bằng dấu * trước một option", () => {
    const hint = extractAnswerHint("Câu 1. 2+2=? *A. 3 B. 4 C. 5 D. 6");
    expect(hint.markedOptionLabels).toEqual(["A"]);
    expect(hint.text).toContain("A");
  });

  it("phát hiện nhiều option được đánh dấu * (câu nhiều đáp án đúng hoặc đúng/sai nhiều ý)", () => {
    const hint = extractAnswerHint("*a) Đúng. b) Sai. *c) Đúng. d) Sai.");
    expect(hint.markedOptionLabels.sort()).toEqual(["A", "C"]);
  });

  it("phát hiện dòng 'Đáp án: X'", () => {
    const hint = extractAnswerHint("Câu 1. Tính x. Hướng dẫn giải: ... Đáp án: 6,67");
    expect(hint.answerKeyValue).toBe("6,67");
  });

  it("phát hiện dòng 'Đ/án: X' (viết tắt)", () => {
    const hint = extractAnswerHint("Lời giải: ... Đ/án: 24");
    expect(hint.answerKeyValue).toBe("24");
  });

  it("không có dấu hiệu nào → text null", () => {
    const hint = extractAnswerHint("Đây là một đoạn văn bản không có đáp án nào được đánh dấu.");
    expect(hint.text).toBeNull();
    expect(hint.markedOptionLabels).toEqual([]);
    expect(hint.answerKeyValue).toBeNull();
  });
});
