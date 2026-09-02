import { describe, expect, it } from "vitest";
import { validateAnswerPayload } from "@/validators/attemptAnswer";
import type { SnapshotQuestion } from "@/server/services/examSnapshotService";

const OPT_A = "11111111-1111-4111-8111-111111111111";
const OPT_B = "22222222-2222-4222-8222-222222222222";
const OPT_C = "33333333-3333-4333-8333-333333333333";
const OTHER_QUESTION_OPT = "99999999-9999-4999-8999-999999999999";

function makeSnapshotQuestion(overrides: Partial<SnapshotQuestion> = {}): SnapshotQuestion {
  return {
    questionId: "q1",
    order: 1,
    type: "SINGLE_CHOICE",
    content: "2 + 2 = ?",
    options: [
      { id: OPT_A, label: "A", content: "3", isCorrect: false },
      { id: OPT_B, label: "B", content: "4", isCorrect: true },
    ],
    correctAnswerText: null,
    ...overrides,
  };
}

describe("validateAnswerPayload — SINGLE_CHOICE", () => {
  const q = makeSnapshotQuestion({ type: "SINGLE_CHOICE" });

  it("option hợp lệ → success", () => {
    const result = validateAnswerPayload("SINGLE_CHOICE", q, { selectedOptionId: OPT_B });
    expect(result).toEqual({
      success: true,
      data: { selectedOptionIds: [OPT_B], answerText: null, answered: true },
    });
  });

  it("null → chưa trả lời, vẫn success", () => {
    const result = validateAnswerPayload("SINGLE_CHOICE", q, { selectedOptionId: null });
    expect(result).toEqual({
      success: true,
      data: { selectedOptionIds: [], answerText: null, answered: false },
    });
  });

  it("option không thuộc câu hỏi này → lỗi", () => {
    const result = validateAnswerPayload("SINGLE_CHOICE", q, { selectedOptionId: OTHER_QUESTION_OPT });
    expect(result.success).toBe(false);
  });

  it("gửi sai shape (selectedOptionIds thay vì selectedOptionId) → lỗi", () => {
    const result = validateAnswerPayload("SINGLE_CHOICE", q, { selectedOptionIds: [OPT_A, OPT_B] });
    expect(result.success).toBe(false);
  });
});

describe("validateAnswerPayload — MULTIPLE_CHOICE", () => {
  const q = makeSnapshotQuestion({
    type: "MULTIPLE_CHOICE",
    options: [
      { id: OPT_A, label: "A", content: "A", isCorrect: true },
      { id: OPT_B, label: "B", content: "B", isCorrect: true },
      { id: OPT_C, label: "C", content: "C", isCorrect: false },
    ],
  });

  it("nhiều option hợp lệ → success", () => {
    const result = validateAnswerPayload("MULTIPLE_CHOICE", q, { selectedOptionIds: [OPT_A, OPT_C] });
    expect(result.success).toBe(true);
  });

  it("mảng rỗng → chưa trả lời, vẫn success", () => {
    const result = validateAnswerPayload("MULTIPLE_CHOICE", q, { selectedOptionIds: [] });
    expect(result).toEqual({
      success: true,
      data: { selectedOptionIds: [], answerText: null, answered: false },
    });
  });

  it("option trùng lặp trong mảng → lỗi", () => {
    const result = validateAnswerPayload("MULTIPLE_CHOICE", q, { selectedOptionIds: [OPT_A, OPT_A] });
    expect(result.success).toBe(false);
  });

  it("có 1 option thuộc câu khác → lỗi toàn bộ", () => {
    const result = validateAnswerPayload("MULTIPLE_CHOICE", q, {
      selectedOptionIds: [OPT_A, OTHER_QUESTION_OPT],
    });
    expect(result.success).toBe(false);
  });
});

describe("validateAnswerPayload — TRUE_FALSE", () => {
  const q = makeSnapshotQuestion({
    type: "TRUE_FALSE",
    options: [
      { id: OPT_A, label: "A", content: "Đúng", isCorrect: true },
      { id: OPT_B, label: "B", content: "Sai", isCorrect: false },
    ],
  });

  it("chọn 1 trong 2 → success", () => {
    const result = validateAnswerPayload("TRUE_FALSE", q, { selectedOptionId: OPT_B });
    expect(result.success).toBe(true);
  });

  it("option không thuộc snapshot Đúng/Sai này → lỗi", () => {
    const result = validateAnswerPayload("TRUE_FALSE", q, { selectedOptionId: OTHER_QUESTION_OPT });
    expect(result.success).toBe(false);
  });
});

describe("validateAnswerPayload — SHORT_ANSWER", () => {
  const q = makeSnapshotQuestion({ type: "SHORT_ANSWER", options: [] });

  it("text hợp lệ → success, tự trim", () => {
    const result = validateAnswerPayload("SHORT_ANSWER", q, { answerText: "  42  " });
    expect(result).toEqual({
      success: true,
      data: { selectedOptionIds: [], answerText: "42", answered: true },
    });
  });

  it("text rỗng/null → chưa trả lời", () => {
    expect(validateAnswerPayload("SHORT_ANSWER", q, { answerText: null }).success).toBe(true);
    const result = validateAnswerPayload("SHORT_ANSWER", q, { answerText: "   " });
    expect(result).toEqual({
      success: true,
      data: { selectedOptionIds: [], answerText: null, answered: false },
    });
  });

  it("gửi sai shape (selectedOptionId cho SHORT_ANSWER) → lỗi", () => {
    const result = validateAnswerPayload("SHORT_ANSWER", q, { selectedOptionId: OPT_A });
    expect(result.success).toBe(false);
  });
});
