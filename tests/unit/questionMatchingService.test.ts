import { describe, expect, it } from "vitest";
import {
  deterministicShuffle,
  questionMatchesRule,
  type MatchableQuestion,
  type MatchableRule,
} from "@/server/services/questionMatchingService";

function makeQuestion(overrides: Partial<MatchableQuestion> = {}): MatchableQuestion {
  return {
    id: "q1",
    status: "ACTIVE",
    subjectId: "subj-toan",
    topicId: "topic-dai-so",
    type: "SINGLE_CHOICE",
    difficulty: "MEDIUM",
    cognitiveLevel: null,
    year: null,
    source: null,
    tags: [],
    ...overrides,
  };
}

function makeRule(overrides: Partial<MatchableRule> = {}): MatchableRule {
  return {
    subjectId: null,
    topicId: null,
    questionType: null,
    difficulty: null,
    cognitiveLevel: null,
    year: null,
    source: null,
    requiredTags: [],
    ...overrides,
  };
}

describe("questionMatchesRule", () => {
  it("field không chỉ định trên Rule → không lọc theo field đó", () => {
    const question = makeQuestion();
    expect(questionMatchesRule(question, makeRule())).toBe(true);
  });

  it("subject match", () => {
    const question = makeQuestion({ subjectId: "subj-toan" });
    expect(questionMatchesRule(question, makeRule({ subjectId: "subj-toan" }))).toBe(true);
  });

  it("subject mismatch", () => {
    const question = makeQuestion({ subjectId: "subj-toan" });
    expect(questionMatchesRule(question, makeRule({ subjectId: "subj-anh" }))).toBe(false);
  });

  it("topic match", () => {
    const question = makeQuestion({ topicId: "topic-dai-so" });
    expect(questionMatchesRule(question, makeRule({ topicId: "topic-dai-so" }))).toBe(true);
  });

  it("topic mismatch", () => {
    const question = makeQuestion({ topicId: "topic-dai-so" });
    expect(questionMatchesRule(question, makeRule({ topicId: "topic-hinh-hoc" }))).toBe(false);
  });

  it("difficulty match", () => {
    const question = makeQuestion({ difficulty: "EASY" });
    expect(questionMatchesRule(question, makeRule({ difficulty: "EASY" }))).toBe(true);
  });

  it("difficulty mismatch", () => {
    const question = makeQuestion({ difficulty: "EASY" });
    expect(questionMatchesRule(question, makeRule({ difficulty: "HARD" }))).toBe(false);
  });

  it("question type match/mismatch", () => {
    const question = makeQuestion({ type: "TRUE_FALSE" });
    expect(questionMatchesRule(question, makeRule({ questionType: "TRUE_FALSE" }))).toBe(true);
    expect(questionMatchesRule(question, makeRule({ questionType: "SHORT_ANSWER" }))).toBe(false);
  });

  it("cognitive level: rule yêu cầu nhưng Question không có → không match", () => {
    const question = makeQuestion({ cognitiveLevel: null });
    expect(questionMatchesRule(question, makeRule({ cognitiveLevel: "VAN_DUNG" }))).toBe(false);
  });

  it("cognitive level: Question có và khớp Rule → match", () => {
    const question = makeQuestion({ cognitiveLevel: "VAN_DUNG" });
    expect(questionMatchesRule(question, makeRule({ cognitiveLevel: "VAN_DUNG" }))).toBe(true);
  });

  it("cognitive level: Question có nhưng khác Rule → không match", () => {
    const question = makeQuestion({ cognitiveLevel: "NHAN_BIET" });
    expect(questionMatchesRule(question, makeRule({ cognitiveLevel: "VAN_DUNG" }))).toBe(false);
  });

  it("requiredTags: Question phải có đủ mọi tag yêu cầu", () => {
    const question = makeQuestion({ tags: ["hard", "vip"] });
    expect(questionMatchesRule(question, makeRule({ requiredTags: ["hard"] }))).toBe(true);
    expect(questionMatchesRule(question, makeRule({ requiredTags: ["hard", "vip"] }))).toBe(true);
    expect(questionMatchesRule(question, makeRule({ requiredTags: ["hard", "missing"] }))).toBe(false);
  });

  it("nhiều filter kết hợp — phải khớp tất cả", () => {
    const question = makeQuestion({ subjectId: "s1", topicId: "t1", difficulty: "HARD", type: "MULTIPLE_CHOICE" });
    expect(
      questionMatchesRule(
        question,
        makeRule({ subjectId: "s1", topicId: "t1", difficulty: "HARD", questionType: "MULTIPLE_CHOICE" }),
      ),
    ).toBe(true);
    expect(
      questionMatchesRule(
        question,
        makeRule({ subjectId: "s1", topicId: "t1", difficulty: "EASY", questionType: "MULTIPLE_CHOICE" }),
      ),
    ).toBe(false);
  });

  it("Question ARCHIVED không bao giờ match, bất kể rule gì", () => {
    const question = makeQuestion({ status: "ARCHIVED" });
    expect(questionMatchesRule(question, makeRule())).toBe(false);
  });

  it("Question DRAFT không bao giờ match", () => {
    const question = makeQuestion({ status: "DRAFT" });
    expect(questionMatchesRule(question, makeRule())).toBe(false);
  });
});

describe("deterministicShuffle", () => {
  const items = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];

  it("cùng seed → luôn ra cùng thứ tự", () => {
    const first = deterministicShuffle(items, "job-1:1:rule-1");
    const second = deterministicShuffle(items, "job-1:1:rule-1");
    expect(first).toEqual(second);
  });

  it("seed khác → ra thứ tự khác", () => {
    const first = deterministicShuffle(items, "job-1:1:rule-1");
    const second = deterministicShuffle(items, "job-2:1:rule-1");
    expect(first).not.toEqual(second);
  });

  it("không làm mất hoặc thêm phần tử — chỉ hoán vị", () => {
    const shuffled = deterministicShuffle(items, "seed-x");
    expect([...shuffled].sort()).toEqual([...items].sort());
  });
});
