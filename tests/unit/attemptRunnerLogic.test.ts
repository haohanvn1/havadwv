import { describe, expect, it } from "vitest";
import {
  buildAnswerPayload,
  countAnswered,
  createSaveSequencer,
  formatRemaining,
  isAnswered,
  isTimerExpired,
  isTimerWarning,
  pickCurrentIndex,
} from "@/components/student/attempts/attempt-runner-logic";
import type { QuestionAnswerState } from "@/components/student/attempts/question-panel";

// Phase 9C không có hạ tầng test component (không RTL/jsdom ở bất kỳ phase
// nào trước đó trong dự án) — phần logic có thể tách khỏi JSX được tách ra
// đây và unit test trực tiếp; hành vi render/tương tác thật được xác nhận
// bằng Browser QA (xem completion report mục 17).

describe("isAnswered", () => {
  it("có selectedOptionIds → answered", () => {
    expect(isAnswered({ selectedOptionIds: ["a"], answerText: null })).toBe(true);
  });
  it("có answerText không rỗng → answered", () => {
    expect(isAnswered({ selectedOptionIds: [], answerText: "42" })).toBe(true);
  });
  it("answerText chỉ có khoảng trắng → KHÔNG answered", () => {
    expect(isAnswered({ selectedOptionIds: [], answerText: "   " })).toBe(false);
  });
  it("mảng rỗng + text null → unanswered", () => {
    expect(isAnswered({ selectedOptionIds: [], answerText: null })).toBe(false);
  });
  it("undefined (chưa có state) → unanswered, không throw", () => {
    expect(isAnswered(undefined)).toBe(false);
  });
});

describe("countAnswered", () => {
  it("đếm đúng số câu đã trả lời trong danh sách", () => {
    const answers = new Map<string, QuestionAnswerState>([
      ["q1", { selectedOptionIds: ["a"], answerText: null }],
      ["q2", { selectedOptionIds: [], answerText: null }],
      ["q3", { selectedOptionIds: [], answerText: "hi" }],
    ]);
    expect(countAnswered(["q1", "q2", "q3"], answers)).toBe(2);
  });

  it("câu không có trong map → tính là chưa trả lời, không throw", () => {
    const answers = new Map<string, QuestionAnswerState>();
    expect(countAnswered(["q1", "q2"], answers)).toBe(0);
  });
});

describe("formatRemaining", () => {
  it("dưới 1 phút → mm:ss", () => {
    expect(formatRemaining(45_000)).toBe("00:45");
  });
  it("đúng 1 phút", () => {
    expect(formatRemaining(60_000)).toBe("01:00");
  });
  it("trên 1 giờ → h:mm:ss", () => {
    expect(formatRemaining(2 * 3600_000 + 5 * 60_000 + 9_000)).toBe("2:05:09");
  });
  it("âm (đã quá hạn) → không âm, hiển thị 00:00", () => {
    expect(formatRemaining(-5000)).toBe("00:00");
  });
  it("bằng 0 → 00:00", () => {
    expect(formatRemaining(0)).toBe("00:00");
  });
});

describe("isTimerWarning / isTimerExpired", () => {
  it("null (không giới hạn) → không warning, không expired", () => {
    expect(isTimerWarning(null)).toBe(false);
    expect(isTimerExpired(null)).toBe(false);
  });
  it("còn nhiều thời gian (>5 phút) → không warning", () => {
    expect(isTimerWarning(10 * 60_000)).toBe(false);
  });
  it("còn đúng 5 phút → warning", () => {
    expect(isTimerWarning(5 * 60_000)).toBe(true);
  });
  it("còn 1 giây → warning, chưa expired", () => {
    expect(isTimerWarning(1000)).toBe(true);
    expect(isTimerExpired(1000)).toBe(false);
  });
  it("<= 0 → expired, không còn warning riêng (đã hết hạn)", () => {
    expect(isTimerExpired(0)).toBe(true);
    expect(isTimerExpired(-100)).toBe(true);
    expect(isTimerWarning(0)).toBe(false);
  });
});

describe("createSaveSequencer — chống race condition (mục 9)", () => {
  it("response của lần lưu cũ hơn phải bị coi là không còn mới nhất sau khi có lần lưu mới", () => {
    const seq = createSaveSequencer();
    const first = seq.next("q1"); // Student chọn A
    const second = seq.next("q1"); // Student đổi ngay sang B trước khi A trả lời
    expect(seq.isLatest("q1", second)).toBe(true);
    expect(seq.isLatest("q1", first)).toBe(false); // response của A về muộn — không còn là mới nhất
  });

  it("mỗi câu hỏi có sequence độc lập, không ảnh hưởng lẫn nhau", () => {
    const seq = createSaveSequencer();
    const q1First = seq.next("q1");
    seq.next("q2");
    expect(seq.isLatest("q1", q1First)).toBe(true);
  });

  it("chỉ gọi 1 lần cho 1 câu → vẫn là mới nhất", () => {
    const seq = createSaveSequencer();
    const only = seq.next("q1");
    expect(seq.isLatest("q1", only)).toBe(true);
  });
});

describe("buildAnswerPayload", () => {
  it("SINGLE_CHOICE → selectedOptionId", () => {
    const state: QuestionAnswerState = { selectedOptionIds: ["opt-a"], answerText: null };
    expect(buildAnswerPayload("SINGLE_CHOICE", state)).toEqual({ selectedOptionId: "opt-a" });
  });
  it("SINGLE_CHOICE không có lựa chọn → selectedOptionId null", () => {
    const state: QuestionAnswerState = { selectedOptionIds: [], answerText: null };
    expect(buildAnswerPayload("SINGLE_CHOICE", state)).toEqual({ selectedOptionId: null });
  });
  it("TRUE_FALSE dùng cùng shape với SINGLE_CHOICE", () => {
    const state: QuestionAnswerState = { selectedOptionIds: ["opt-b"], answerText: null };
    expect(buildAnswerPayload("TRUE_FALSE", state)).toEqual({ selectedOptionId: "opt-b" });
  });
  it("MULTIPLE_CHOICE → selectedOptionIds", () => {
    const state: QuestionAnswerState = { selectedOptionIds: ["opt-a", "opt-c"], answerText: null };
    expect(buildAnswerPayload("MULTIPLE_CHOICE", state)).toEqual({ selectedOptionIds: ["opt-a", "opt-c"] });
  });
  it("SHORT_ANSWER → answerText, rỗng thành null", () => {
    expect(buildAnswerPayload("SHORT_ANSWER", { selectedOptionIds: [], answerText: "6" })).toEqual({
      answerText: "6",
    });
    expect(buildAnswerPayload("SHORT_ANSWER", { selectedOptionIds: [], answerText: "" })).toEqual({
      answerText: null,
    });
  });
});

describe("pickCurrentIndex — scroll-spy (mục 20 Phase 9C redesign)", () => {
  it("nhiều câu đang giao với vùng quan sát → chọn câu có chỉ số nhỏ nhất (ở trên cùng)", () => {
    expect(pickCurrentIndex([3, 4, 5], 0)).toBe(3);
  });

  it("không có câu nào đang giao → giữ nguyên currentIndex trước đó, không nhảy về 0", () => {
    expect(pickCurrentIndex([], 7)).toBe(7);
  });

  it("chỉ 1 câu đang giao → chọn đúng câu đó", () => {
    expect(pickCurrentIndex([2], 0)).toBe(2);
  });

  it("thứ tự phần tử trong mảng không ảnh hưởng kết quả", () => {
    expect(pickCurrentIndex([9, 1, 5], 0)).toBe(1);
  });
});
