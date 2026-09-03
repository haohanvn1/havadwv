import { describe, expect, it } from "vitest";
import { validateQuestionInput, parseQuestionListParams } from "@/validators/question";

const SUBJECT_ID = "11111111-1111-1111-8111-111111111111";
const TOPIC_ID = "22222222-2222-2222-8222-222222222222";

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    content: "Câu hỏi mẫu",
    type: "SINGLE_CHOICE",
    subjectId: SUBJECT_ID,
    topicId: TOPIC_ID,
    difficulty: "EASY",
    status: "DRAFT",
    options: [
      { content: "A", isCorrect: true },
      { content: "B", isCorrect: false },
    ],
    ...overrides,
  };
}

describe("validateQuestionInput — lỗi chung, không lộ thông báo kỹ thuật", () => {
  it("content rỗng → thông báo thân thiện", () => {
    const result = validateQuestionInput(baseInput({ content: "" }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.content).toBe("Nội dung câu hỏi không được để trống.");
    }
  });

  it("thiếu subjectId → thông báo thân thiện, không phải lỗi Zod thô", () => {
    const result = validateQuestionInput(baseInput({ subjectId: undefined }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.subjectId).toBe("Vui lòng chọn môn học.");
      expect(result.errors.subjectId).not.toMatch(/received|expected|undefined/i);
    }
  });

  it("thiếu topicId → thông báo thân thiện, không phải lỗi Zod thô", () => {
    const result = validateQuestionInput(baseInput({ topicId: undefined }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.topicId).toBe("Vui lòng chọn chủ đề.");
      expect(result.errors.topicId).not.toMatch(/received|expected|undefined/i);
    }
  });

  it("subjectId không phải uuid hợp lệ → lỗi rõ ràng", () => {
    const result = validateQuestionInput(baseInput({ subjectId: "khong-phai-uuid" }));
    expect(result.success).toBe(false);
  });
});

describe("validateQuestionInput — SINGLE_CHOICE", () => {
  it("hợp lệ với đúng 1 đáp án đúng", () => {
    const result = validateQuestionInput(baseInput());
    expect(result.success).toBe(true);
  });

  it("từ chối khi có 0 đáp án đúng", () => {
    const result = validateQuestionInput(
      baseInput({
        options: [
          { content: "A", isCorrect: false },
          { content: "B", isCorrect: false },
        ],
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.options).toBeDefined();
  });

  it("từ chối khi có nhiều hơn 1 đáp án đúng", () => {
    const result = validateQuestionInput(
      baseInput({
        options: [
          { content: "A", isCorrect: true },
          { content: "B", isCorrect: true },
        ],
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.options).toBeDefined();
  });

  it("từ chối khi ít hơn 2 đáp án", () => {
    const result = validateQuestionInput(
      baseInput({ options: [{ content: "A", isCorrect: true }] }),
    );
    expect(result.success).toBe(false);
  });
});

describe("validateQuestionInput — MULTIPLE_CHOICE", () => {
  it("hợp lệ với nhiều đáp án đúng", () => {
    const result = validateQuestionInput(
      baseInput({
        type: "MULTIPLE_CHOICE",
        options: [
          { content: "A", isCorrect: true },
          { content: "B", isCorrect: true },
          { content: "C", isCorrect: false },
        ],
      }),
    );
    expect(result.success).toBe(true);
  });

  it("từ chối khi không có đáp án đúng nào", () => {
    const result = validateQuestionInput(
      baseInput({
        type: "MULTIPLE_CHOICE",
        options: [
          { content: "A", isCorrect: false },
          { content: "B", isCorrect: false },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });
});

describe("validateQuestionInput — TRUE_FALSE", () => {
  it("hợp lệ khi có chọn đáp án đúng", () => {
    const result = validateQuestionInput(
      baseInput({ type: "TRUE_FALSE", options: [], trueFalseAnswer: "TRUE" }),
    );
    expect(result.success).toBe(true);
  });

  it("từ chối khi chưa chọn Đúng/Sai", () => {
    const result = validateQuestionInput(baseInput({ type: "TRUE_FALSE", options: [] }));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.trueFalseAnswer).toBeDefined();
  });
});

describe("validateQuestionInput — SHORT_ANSWER", () => {
  it("hợp lệ khi có đáp án đúng", () => {
    const result = validateQuestionInput(
      baseInput({ type: "SHORT_ANSWER", options: [], correctAnswerText: "42" }),
    );
    expect(result.success).toBe(true);
  });

  it("từ chối khi thiếu đáp án đúng", () => {
    const result = validateQuestionInput(baseInput({ type: "SHORT_ANSWER", options: [] }));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.correctAnswerText).toBeDefined();
  });
});

describe("parseQuestionListParams — whitelist, không tin giá trị tuỳ ý từ client", () => {
  it("bỏ qua sort không nằm trong danh sách cho phép, dùng mặc định", () => {
    const params = parseQuestionListParams(new URLSearchParams("sort=content;DROP TABLE"));
    expect(params.sort).toBe("createdAt_desc");
  });

  it("bỏ qua pageSize không hợp lệ, dùng mặc định 20", () => {
    const params = parseQuestionListParams(new URLSearchParams("pageSize=999"));
    expect(params.pageSize).toBe(20);
  });

  it("bỏ qua subjectId không phải uuid", () => {
    const params = parseQuestionListParams(new URLSearchParams("subjectId=abc"));
    expect(params.subjectId).toBeUndefined();
  });

  it("chấp nhận filter hợp lệ", () => {
    const params = parseQuestionListParams(
      new URLSearchParams(`subjectId=${SUBJECT_ID}&difficulty=HARD&page=2`),
    );
    expect(params.subjectId).toBe(SUBJECT_ID);
    expect(params.difficulty).toBe("HARD");
    expect(params.page).toBe(2);
  });
});
