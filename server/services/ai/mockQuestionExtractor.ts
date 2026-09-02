import { AIExtractionError, type AIQuestionExtractor, type QuestionExtractionInput, type QuestionExtractionResult } from "./types";

export type MockResponder =
  | QuestionExtractionResult
  | AIExtractionError
  | ((input: QuestionExtractionInput, callIndex: number) => QuestionExtractionResult | AIExtractionError);

/**
 * Test double cho AIQuestionExtractor — unit/HTTP test KHÔNG BAO GIỜ gọi AI
 * thật. Nhận một responder tĩnh, hoặc một hàm để trả kết quả khác nhau theo
 * từng lần gọi (mô phỏng: lần 1 fail, lần 2 (retry) thành công).
 */
export class MockAIQuestionExtractor implements AIQuestionExtractor {
  private callCount = 0;
  readonly calls: QuestionExtractionInput[] = [];

  constructor(private readonly responder: MockResponder) {}

  async extract(input: QuestionExtractionInput): Promise<QuestionExtractionResult> {
    this.calls.push(input);
    const result =
      typeof this.responder === "function" ? this.responder(input, this.callCount) : this.responder;
    this.callCount += 1;

    if (result instanceof AIExtractionError) throw result;
    return result;
  }
}

export function buildMockExtractionResult(
  overrides: Partial<QuestionExtractionResult> = {},
): QuestionExtractionResult {
  return {
    questionText: "Câu hỏi mẫu",
    questionType: "SINGLE_CHOICE",
    options: [
      { label: "A", text: "Đáp án A", isCorrect: false },
      { label: "B", text: "Đáp án B", isCorrect: true },
    ],
    correctAnswerText: null,
    explanation: null,
    suggestedSubjectText: null,
    suggestedTopicText: null,
    difficulty: "MEDIUM",
    cognitiveLevel: null,
    tags: [],
    confidence: 0.9,
    warnings: [],
    ...overrides,
  };
}
