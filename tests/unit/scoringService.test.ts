import { describe, expect, it } from "vitest";
import { computeMaxScore, scoreAttempt, type AnswerLike } from "@/server/services/scoringService";
import type { ExamSnapshot, SnapshotQuestion } from "@/server/services/examSnapshotService";

const OPT_A = "11111111-1111-4111-8111-111111111111";
const OPT_B = "22222222-2222-4222-8222-222222222222";
const OPT_C = "33333333-3333-4333-8333-333333333333";

function sq(overrides: Partial<SnapshotQuestion> = {}): SnapshotQuestion {
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
    points: 1,
    ...overrides,
  };
}

function snapshot(questions: SnapshotQuestion[]): ExamSnapshot {
  return {
    examId: "exam-1",
    title: "Đề test",
    examType: "TEST",
    durationMinutes: 60,
    questionCount: questions.length,
    questions,
  };
}

function answer(questionId: string, overrides: Partial<AnswerLike> = {}): AnswerLike {
  return { questionId, selectedOptionIds: [], answerText: null, ...overrides };
}

describe("scoreAttempt — SINGLE_CHOICE", () => {
  const q = sq({ questionId: "q1", type: "SINGLE_CHOICE" });

  it("chọn đúng → correct, full score", () => {
    const result = scoreAttempt(snapshot([q]), [answer("q1", { selectedOptionIds: [OPT_B] })]);
    expect(result.questionResults[0]).toMatchObject({ isAnswered: true, isCorrect: true, score: 1, maxScore: 1 });
    expect(result.correctCount).toBe(1);
    expect(result.totalScore).toBe(1);
  });

  it("chọn sai → wrong, 0 điểm", () => {
    const result = scoreAttempt(snapshot([q]), [answer("q1", { selectedOptionIds: [OPT_A] })]);
    expect(result.questionResults[0]).toMatchObject({ isAnswered: true, isCorrect: false, score: 0 });
    expect(result.wrongCount).toBe(1);
  });

  it("không trả lời (không có AttemptAnswer) → unanswered, không tính là sai", () => {
    const result = scoreAttempt(snapshot([q]), []);
    expect(result.questionResults[0]).toMatchObject({ isAnswered: false, isCorrect: false, score: 0 });
    expect(result.unansweredCount).toBe(1);
    expect(result.wrongCount).toBe(0);
  });

  it("AttemptAnswer tồn tại nhưng selectedOptionIds rỗng → vẫn là unanswered", () => {
    const result = scoreAttempt(snapshot([q]), [answer("q1", { selectedOptionIds: [] })]);
    expect(result.questionResults[0].isAnswered).toBe(false);
    expect(result.unansweredCount).toBe(1);
  });
});

describe("scoreAttempt — MULTIPLE_CHOICE (exact set match, không có điểm từng phần)", () => {
  const q = sq({
    questionId: "q2",
    type: "MULTIPLE_CHOICE",
    options: [
      { id: OPT_A, label: "A", content: "A", isCorrect: true },
      { id: OPT_B, label: "B", content: "B", isCorrect: true },
      { id: OPT_C, label: "C", content: "C", isCorrect: false },
    ],
  });

  it("chọn đúng chính xác tập {A,B} → correct", () => {
    const result = scoreAttempt(snapshot([q]), [answer("q2", { selectedOptionIds: [OPT_A, OPT_B] })]);
    expect(result.questionResults[0].isCorrect).toBe(true);
  });

  it("chọn đúng chính xác tập nhưng khác thứ tự {B,A} → vẫn correct", () => {
    const result = scoreAttempt(snapshot([q]), [answer("q2", { selectedOptionIds: [OPT_B, OPT_A] })]);
    expect(result.questionResults[0].isCorrect).toBe(true);
  });

  it("chọn thiếu {A} (thiếu B) → sai toàn bộ, KHÔNG có điểm từng phần", () => {
    const result = scoreAttempt(snapshot([q]), [answer("q2", { selectedOptionIds: [OPT_A] })]);
    expect(result.questionResults[0]).toMatchObject({ isAnswered: true, isCorrect: false, score: 0 });
  });

  it("chọn thừa {A,B,C} → sai toàn bộ", () => {
    const result = scoreAttempt(snapshot([q]), [answer("q2", { selectedOptionIds: [OPT_A, OPT_B, OPT_C] })]);
    expect(result.questionResults[0].isCorrect).toBe(false);
  });

  it("chọn sai hoàn toàn {C} → sai", () => {
    const result = scoreAttempt(snapshot([q]), [answer("q2", { selectedOptionIds: [OPT_C] })]);
    expect(result.questionResults[0].isCorrect).toBe(false);
  });

  it("mảng rỗng → unanswered", () => {
    const result = scoreAttempt(snapshot([q]), [answer("q2", { selectedOptionIds: [] })]);
    expect(result.questionResults[0].isAnswered).toBe(false);
  });

  it("option trùng lặp trong dữ liệu hỏng {A,A} với đáp án đúng chỉ {A} → vẫn correct (dedupe trước khi so khớp)", () => {
    const single = sq({
      questionId: "q2b",
      type: "MULTIPLE_CHOICE",
      options: [
        { id: OPT_A, label: "A", content: "A", isCorrect: true },
        { id: OPT_B, label: "B", content: "B", isCorrect: false },
      ],
    });
    const result = scoreAttempt(snapshot([single]), [answer("q2b", { selectedOptionIds: [OPT_A, OPT_A] })]);
    expect(result.questionResults[0].isCorrect).toBe(true);
  });
});

describe("scoreAttempt — TRUE_FALSE", () => {
  const q = sq({
    questionId: "q3",
    type: "TRUE_FALSE",
    options: [
      { id: OPT_A, label: "A", content: "Đúng", isCorrect: true },
      { id: OPT_B, label: "B", content: "Sai", isCorrect: false },
    ],
  });

  it("chọn đúng → correct", () => {
    const result = scoreAttempt(snapshot([q]), [answer("q3", { selectedOptionIds: [OPT_A] })]);
    expect(result.questionResults[0].isCorrect).toBe(true);
  });

  it("chọn sai → wrong", () => {
    const result = scoreAttempt(snapshot([q]), [answer("q3", { selectedOptionIds: [OPT_B] })]);
    expect(result.questionResults[0].isCorrect).toBe(false);
  });

  it("không trả lời → unanswered", () => {
    const result = scoreAttempt(snapshot([q]), []);
    expect(result.questionResults[0].isAnswered).toBe(false);
  });
});

describe("scoreAttempt — SHORT_ANSWER (trim + lowercase + gộp khoảng trắng, theo xác nhận của người dùng)", () => {
  const q = sq({ questionId: "q4", type: "SHORT_ANSWER", options: [], correctAnswerText: "Hà Nội" });

  it("khớp chính xác → correct", () => {
    const result = scoreAttempt(snapshot([q]), [answer("q4", { answerText: "Hà Nội" })]);
    expect(result.questionResults[0].isCorrect).toBe(true);
  });

  it("khác hoa/thường → vẫn correct", () => {
    const result = scoreAttempt(snapshot([q]), [answer("q4", { answerText: "hà nội" })]);
    expect(result.questionResults[0].isCorrect).toBe(true);
  });

  it("thừa khoảng trắng đầu/cuối/giữa → vẫn correct", () => {
    const result = scoreAttempt(snapshot([q]), [answer("q4", { answerText: "  Hà   Nội  " })]);
    expect(result.questionResults[0].isCorrect).toBe(true);
  });

  it("sai dấu tiếng Việt (không chuẩn hoá dấu theo xác nhận) → wrong", () => {
    const result = scoreAttempt(snapshot([q]), [answer("q4", { answerText: "Ha Noi" })]);
    expect(result.questionResults[0].isCorrect).toBe(false);
  });

  it("nội dung khác hoàn toàn → wrong", () => {
    const result = scoreAttempt(snapshot([q]), [answer("q4", { answerText: "Sài Gòn" })]);
    expect(result.questionResults[0].isCorrect).toBe(false);
  });

  it("rỗng/null → unanswered, không phải wrong", () => {
    const r1 = scoreAttempt(snapshot([q]), [answer("q4", { answerText: null })]);
    expect(r1.questionResults[0].isAnswered).toBe(false);
    const r2 = scoreAttempt(snapshot([q]), [answer("q4", { answerText: "   " })]);
    expect(r2.questionResults[0].isAnswered).toBe(false);
  });

  it("câu hỏi thiếu correctAnswerText trong snapshot (dữ liệu bất thường) → không bao giờ chấm đúng, không crash", () => {
    const broken = sq({ questionId: "q4b", type: "SHORT_ANSWER", options: [], correctAnswerText: null });
    const result = scoreAttempt(snapshot([broken]), [answer("q4b", { answerText: "bất kỳ" })]);
    expect(result.questionResults[0].isCorrect).toBe(false);
    expect(result.questionResults[0].isAnswered).toBe(true);
  });
});

describe("scoreAttempt — toàn bài (whole exam aggregate)", () => {
  it("4 câu: 2 đúng, 1 sai, 1 bỏ trống → đúng correctCount/wrongCount/unansweredCount/totalScore/maxScore", () => {
    const q1 = sq({ questionId: "q1", type: "SINGLE_CHOICE" });
    const q2 = sq({
      questionId: "q2",
      order: 2,
      type: "MULTIPLE_CHOICE",
      options: [
        { id: OPT_A, label: "A", content: "A", isCorrect: true },
        { id: OPT_B, label: "B", content: "B", isCorrect: false },
      ],
    });
    const q3 = sq({ questionId: "q3", order: 3, type: "TRUE_FALSE" });
    const q4 = sq({ questionId: "q4", order: 4, type: "SHORT_ANSWER", options: [], correctAnswerText: "6" });

    const answers = [
      answer("q1", { selectedOptionIds: [OPT_B] }), // đúng (OPT_B isCorrect trong q1 mặc định)
      answer("q2", { selectedOptionIds: [OPT_B] }), // sai (đáp án đúng là A)
      // q3 bỏ trống
      answer("q4", { answerText: "6" }), // đúng
    ];

    const result = scoreAttempt(snapshot([q1, q2, q3, q4]), answers);
    expect(result.correctCount).toBe(2);
    expect(result.wrongCount).toBe(1);
    expect(result.unansweredCount).toBe(1);
    expect(result.totalScore).toBe(2);
    expect(result.maxScore).toBe(4);
  });

  it("computeMaxScore độc lập khớp với scoreAttempt().maxScore và tôn trọng points khác 1", () => {
    const q1 = sq({ questionId: "q1", points: 2 });
    const q2 = sq({ questionId: "q2", order: 2, points: 3 });
    const snap = snapshot([q1, q2]);
    expect(computeMaxScore(snap)).toBe(5);
    expect(scoreAttempt(snap, []).maxScore).toBe(5);
  });

  it("points thiếu trong snapshot cũ (Phase 9A, trước khi field points tồn tại) → mặc định 1", () => {
    const legacy = sq({ questionId: "q1", points: undefined });
    const snap = snapshot([legacy]);
    expect(computeMaxScore(snap)).toBe(1);
  });
});

describe("scoreAttempt — dữ liệu hỏng không được làm crash (mục 15)", () => {
  it("AttemptAnswer tham chiếu question không có trong snapshot → bị bỏ qua, không throw", () => {
    const q = sq({ questionId: "q1" });
    expect(() =>
      scoreAttempt(snapshot([q]), [answer("question-does-not-exist", { selectedOptionIds: [OPT_A] })]),
    ).not.toThrow();
    const result = scoreAttempt(snapshot([q]), [answer("question-does-not-exist", { selectedOptionIds: [OPT_A] })]);
    expect(result.questionResults).toHaveLength(1);
    expect(result.questionResults[0].isAnswered).toBe(false);
  });

  it("selectedOptionIds không phải mảng (dữ liệu hỏng) → coi như rỗng, không throw", () => {
    const q = sq({ questionId: "q1" });
    const badAnswer = answer("q1", { selectedOptionIds: "not-an-array" as unknown as string[] });
    expect(() => scoreAttempt(snapshot([q]), [badAnswer])).not.toThrow();
    expect(scoreAttempt(snapshot([q]), [badAnswer]).questionResults[0].isAnswered).toBe(false);
  });

  it("option id không thuộc câu hỏi (dữ liệu bất thường) → tính là sai, không throw, không match nhầm", () => {
    const q = sq({ questionId: "q1" });
    const result = scoreAttempt(snapshot([q]), [answer("q1", { selectedOptionIds: ["unknown-option-id"] })]);
    expect(result.questionResults[0]).toMatchObject({ isAnswered: true, isCorrect: false });
  });

  it("snapshot không có câu hỏi nào → trả kết quả rỗng hợp lệ, không throw", () => {
    const result = scoreAttempt(snapshot([]), []);
    expect(result).toEqual({
      totalScore: 0,
      maxScore: 0,
      correctCount: 0,
      wrongCount: 0,
      unansweredCount: 0,
      questionResults: [],
    });
  });
});

describe("scoreAttempt — idempotency của bản thân pure function", () => {
  it("gọi nhiều lần với cùng input → luôn ra cùng kết quả", () => {
    const q = sq({ questionId: "q1" });
    const answers = [answer("q1", { selectedOptionIds: [OPT_B] })];
    const r1 = scoreAttempt(snapshot([q]), answers);
    const r2 = scoreAttempt(snapshot([q]), answers);
    expect(r1).toEqual(r2);
  });
});
