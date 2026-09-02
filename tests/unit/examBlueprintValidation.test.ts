import { describe, expect, it } from "vitest";
import { validateBlueprintInput } from "@/validators/examBlueprint";

function baseRule(overrides: Record<string, unknown> = {}) {
  return { quantity: 5, ...overrides };
}

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    name: "ĐGTD Toán — Cấu trúc 2026",
    examType: "ĐGNL",
    durationMinutes: 90,
    sections: [{ name: "Trắc nghiệm", rules: [baseRule()] }],
    ...overrides,
  };
}

describe("validateBlueprintInput", () => {
  it("input hợp lệ → success", () => {
    const result = validateBlueprintInput(baseInput());
    expect(result.success).toBe(true);
  });

  it("không có Section → invalid", () => {
    const result = validateBlueprintInput(baseInput({ sections: [] }));
    expect(result.success).toBe(false);
  });

  it("Section không có Rule → invalid", () => {
    const result = validateBlueprintInput(baseInput({ sections: [{ name: "A", rules: [] }] }));
    expect(result.success).toBe(false);
  });

  it("quantity <= 0 → invalid", () => {
    const result = validateBlueprintInput(
      baseInput({ sections: [{ name: "A", rules: [baseRule({ quantity: 0 })] }] }),
    );
    expect(result.success).toBe(false);
  });

  it("quantity âm → invalid", () => {
    const result = validateBlueprintInput(
      baseInput({ sections: [{ name: "A", rules: [baseRule({ quantity: -3 })] }] }),
    );
    expect(result.success).toBe(false);
  });

  it("QuestionType không hợp lệ → invalid", () => {
    const result = validateBlueprintInput(
      baseInput({ sections: [{ name: "A", rules: [baseRule({ questionType: "NOT_A_TYPE" })] }] }),
    );
    expect(result.success).toBe(false);
  });

  it("Difficulty không hợp lệ → invalid", () => {
    const result = validateBlueprintInput(
      baseInput({ sections: [{ name: "A", rules: [baseRule({ difficulty: "IMPOSSIBLE" })] }] }),
    );
    expect(result.success).toBe(false);
  });

  it("Cognitive level không hợp lệ → invalid", () => {
    const result = validateBlueprintInput(
      baseInput({ sections: [{ name: "A", rules: [baseRule({ cognitiveLevel: "MADE_UP" })] }] }),
    );
    expect(result.success).toBe(false);
  });

  it("tên Blueprint rỗng → invalid", () => {
    const result = validateBlueprintInput(baseInput({ name: "" }));
    expect(result.success).toBe(false);
  });

  it("thời lượng không hợp lệ (0 hoặc âm) → invalid", () => {
    expect(validateBlueprintInput(baseInput({ durationMinutes: 0 })).success).toBe(false);
    expect(validateBlueprintInput(baseInput({ durationMinutes: -10 })).success).toBe(false);
  });

  it("nhiều section, nhiều rule hợp lệ → success, sections rỗng ở giữa vẫn bị chặn", () => {
    const result = validateBlueprintInput(
      baseInput({
        sections: [
          { name: "A", rules: [baseRule({ quantity: 4 })] },
          { name: "B", rules: [] },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });
});
