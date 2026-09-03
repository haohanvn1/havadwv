import type { QuestionAnswerState } from "./question-panel";

/**
 * Logic thuần tách khỏi AttemptRunner (component) để test được không cần
 * render React — dự án này chưa từng có hạ tầng test component (không
 * RTL/jsdom ở bất kỳ phase nào trước đó), nên phần "component tests" của
 * Phase 9C được đáp ứng bằng cách: tách hết logic có thể tách thành hàm
 * thuần và unit-test trực tiếp, còn hành vi render/tương tác thật được xác
 * nhận bằng Browser QA (đã là phương pháp chuẩn của dự án qua mọi phase).
 */

export function isAnswered(state: QuestionAnswerState | undefined): boolean {
  if (!state) return false;
  return state.selectedOptionIds.length > 0 || Boolean(state.answerText?.trim());
}

export function countAnswered(
  questionIds: string[],
  answers: Map<string, QuestionAnswerState>,
): number {
  return questionIds.filter((id) => isAnswered(answers.get(id))).length;
}

const WARNING_THRESHOLD_MS = 5 * 60 * 1000;

export function isTimerWarning(remainingMs: number | null): boolean {
  return remainingMs !== null && remainingMs > 0 && remainingMs <= WARNING_THRESHOLD_MS;
}

export function isTimerExpired(remainingMs: number | null): boolean {
  return remainingMs !== null && remainingMs <= 0;
}

export function formatRemaining(ms: number): string {
  const clamped = Math.max(0, ms);
  const totalSeconds = Math.floor(clamped / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Chống race condition khi Student đổi đáp án rất nhanh (mục 9 Phase 9C):
 * mỗi lần lưu cho MỘT câu được cấp một số thứ tự tăng dần; response của một
 * lần lưu chỉ được áp dụng vào UI nếu số thứ tự đó vẫn là mới nhất tại thời
 * điểm response về — response đến muộn của một lần lưu đã lỗi thời bị bỏ
 * qua, không ghi đè state của lần lưu mới hơn.
 */
export function createSaveSequencer() {
  const latest = new Map<string, number>();
  return {
    next(questionId: string): number {
      const seq = (latest.get(questionId) ?? 0) + 1;
      latest.set(questionId, seq);
      return seq;
    },
    isLatest(questionId: string, seq: number): boolean {
      return latest.get(questionId) === seq;
    },
  };
}

/**
 * Chọn câu "current" từ tập chỉ số đang giao với vùng quan sát của
 * IntersectionObserver khi Student cuộn trang (mục 20 Phase 9C redesign) —
 * tách thành hàm thuần để test được không cần DOM/observer thật. Quy ước:
 * lấy chỉ số NHỎ NHẤT đang giao (câu ở trên cùng trong vùng quan sát) — nếu
 * không có câu nào đang giao (vd đang ở khoảng trống giữa hai lần cuộn),
 * giữ nguyên currentIndex trước đó thay vì nhảy về 0.
 */
export function pickCurrentIndex(intersectingIndices: number[], previous: number): number {
  if (intersectingIndices.length === 0) return previous;
  return Math.min(...intersectingIndices);
}

/** Payload PATCH đúng shape theo QuestionType — dùng khi retry lưu lại giá trị hiện có (mục 17). */
export function buildAnswerPayload(
  questionType: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER",
  state: QuestionAnswerState,
): unknown {
  if (questionType === "SHORT_ANSWER") {
    return { answerText: state.answerText || null };
  }
  if (questionType === "MULTIPLE_CHOICE") {
    return { selectedOptionIds: state.selectedOptionIds };
  }
  return { selectedOptionId: state.selectedOptionIds[0] ?? null };
}
