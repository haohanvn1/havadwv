"use client";

import { AlertTriangle, Check, Loader2, Send, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ClientSnapshotQuestion } from "@/server/services/examSnapshotService";
import type { QuestionReviewItem } from "@/server/services/studentAttemptService";

export type SaveState = "idle" | "saving" | "saved" | "error";

export interface QuestionAnswerState {
  selectedOptionIds: string[];
  answerText: string | null;
}

const QUESTION_TYPE_LABELS: Record<ClientSnapshotQuestion["type"], string> = {
  SINGLE_CHOICE: "Một đáp án đúng",
  MULTIPLE_CHOICE: "Nhiều đáp án đúng",
  TRUE_FALSE: "Đúng / Sai",
  SHORT_ANSWER: "Tự luận ngắn",
};

/**
 * Một câu hỏi trong danh sách liên tục (mục 5/6 Phase 9C redesign) — không
 * còn phân trang từng câu, tất cả câu nằm trong cùng một cột cuộn dọc. Nội
 * dung luôn lấy từ snapshot (question prop), không bao giờ query lại
 * Question hiện tại, không có isCorrect/correctAnswerText (đã bị
 * sanitizeSnapshotForStudent lọc — mục 8/32).
 *
 * Nút "Gửi câu trả lời" (mục 10) gọi CHÍNH XÁC cùng hàm lưu với autosave —
 * không có logic lưu riêng thứ hai — chỉ là một cách khác để Student chủ
 * động kích hoạt lại việc lưu giá trị hiện tại, đặc biệt hữu ích cho
 * SHORT_ANSWER khi Student muốn lưu ngay mà chưa rời khỏi ô nhập.
 */
export function QuestionPanel({
  question,
  index,
  total,
  answer,
  saveState,
  saveError,
  disabled,
  isCurrent,
  registerRef,
  onSingleChoiceChange,
  onMultipleChoiceToggle,
  onShortAnswerChange,
  onExplicitSave,
  review,
}: {
  question: ClientSnapshotQuestion;
  index: number;
  total: number;
  answer: QuestionAnswerState;
  saveState: SaveState;
  saveError: string | null;
  disabled: boolean;
  isCurrent: boolean;
  registerRef: (el: HTMLDivElement | null) => void;
  onSingleChoiceChange: (optionId: string) => void;
  onMultipleChoiceToggle: (optionId: string) => void;
  onShortAnswerChange: (text: string) => void;
  onExplicitSave: () => void;
  /** Chỉ có sau khi Attempt đã nộp (Phase 9D) — hiện đúng/sai từng câu, KHÔNG có trong lúc làm bài. */
  review?: QuestionReviewItem;
}) {
  const groupName = `question-${question.questionId}`;
  const correctOptionIds = new Set(review?.options.filter((o) => o.isCorrect).map((o) => o.id));

  return (
    <div
      ref={registerRef}
      id={groupName}
      data-question-index={index}
      className={cn(
        "bg-card border-border scroll-mt-28 rounded-xl border p-4 transition-colors sm:p-5",
        isCurrent && "border-primary/50 ring-primary/10 ring-2",
      )}
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold sm:text-base">
            Câu hỏi #{index + 1}/{total}
          </h2>
          <p className="text-muted-foreground text-xs">
            {question.points} điểm · {QUESTION_TYPE_LABELS[question.type]}
          </p>
        </div>
        {review ? <ReviewBadge review={review} /> : <SaveIndicator state={saveState} error={saveError} />}
      </div>

      <p id={`${groupName}-label`} className="mb-4 text-sm leading-relaxed font-medium sm:text-base">
        {question.content}
      </p>

      {(question.type === "SINGLE_CHOICE" || question.type === "TRUE_FALSE") && (
        <RadioGroup
          value={answer.selectedOptionIds[0] ?? ""}
          onValueChange={(v) => v && onSingleChoiceChange(v)}
          className="gap-2.5"
          aria-labelledby={`${groupName}-label`}
        >
          {question.options.map((opt) => {
            const selected = answer.selectedOptionIds.includes(opt.id);
            return (
              <label
                key={opt.id}
                className={cn(
                  "border-border has-[[data-checked]]:border-primary has-[[data-checked]]:bg-primary/5 flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors",
                  review && optionReviewClass(opt.id, selected, correctOptionIds),
                )}
              >
                <RadioGroupItem value={opt.id} disabled={disabled} />
                <span className="flex-1">
                  <span className="font-medium">{opt.label}.</span> {opt.content}
                </span>
                {review ? <ReviewOptionIcon isCorrectOption={correctOptionIds.has(opt.id)} selected={selected} /> : null}
              </label>
            );
          })}
        </RadioGroup>
      )}

      {question.type === "MULTIPLE_CHOICE" && (
        <div className="flex flex-col gap-2.5" role="group" aria-labelledby={`${groupName}-label`}>
          {question.options.map((opt) => {
            const selected = answer.selectedOptionIds.includes(opt.id);
            return (
              <label
                key={opt.id}
                className={cn(
                  "border-border has-[[data-checked]]:border-primary has-[[data-checked]]:bg-primary/5 flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors",
                  review && optionReviewClass(opt.id, selected, correctOptionIds),
                )}
              >
                <Checkbox
                  checked={selected}
                  onCheckedChange={() => onMultipleChoiceToggle(opt.id)}
                  disabled={disabled}
                />
                <span className="flex-1">
                  <span className="font-medium">{opt.label}.</span> {opt.content}
                </span>
                {review ? <ReviewOptionIcon isCorrectOption={correctOptionIds.has(opt.id)} selected={selected} /> : null}
              </label>
            );
          })}
        </div>
      )}

      {question.type === "SHORT_ANSWER" && (
        <div className="flex flex-col gap-2">
          <Textarea
            value={answer.answerText ?? ""}
            onChange={(e) => onShortAnswerChange(e.target.value)}
            rows={3}
            placeholder="Nhập câu trả lời..."
            disabled={disabled}
            aria-labelledby={`${groupName}-label`}
          />
          {review ? (
            <p className="text-xs">
              <span className="text-muted-foreground">Đáp án đúng: </span>
              <span className="font-medium">{review.correctAnswerText ?? "—"}</span>
            </p>
          ) : null}
        </div>
      )}

      {!disabled ? (
        <div className="mt-4 flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onExplicitSave} disabled={saveState === "saving"}>
            <Send className="size-3.5" />
            Gửi câu trả lời
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function SaveIndicator({ state, error }: { state: SaveState; error: string | null }) {
  if (state === "saving") {
    return (
      <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs" role="status" aria-live="polite">
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        Đang lưu...
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span
        className="flex shrink-0 items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400"
        role="status"
        aria-live="polite"
      >
        Đã lưu
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="text-destructive flex shrink-0 items-center gap-1 text-xs" role="alert" aria-live="assertive">
        <AlertTriangle className="size-3.5" aria-hidden="true" />
        {error ?? "Chưa lưu — thử lại"}
      </span>
    );
  }
  return null;
}

/** Phase 9D — màu viền/nền của một option khi review, không chỉ dựa vào màu (còn có icon riêng — mục accessibility đã áp dụng từ 9C). */
function optionReviewClass(optionId: string, selected: boolean, correctOptionIds: Set<string>): string {
  if (correctOptionIds.has(optionId)) {
    return "border-emerald-500 bg-emerald-50 dark:border-emerald-500/60 dark:bg-emerald-950/30";
  }
  if (selected) {
    return "border-destructive bg-destructive/5";
  }
  return "";
}

function ReviewOptionIcon({ isCorrectOption, selected }: { isCorrectOption: boolean; selected: boolean }) {
  if (isCorrectOption) {
    return <Check className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="Đáp án đúng" />;
  }
  if (selected) {
    return <X className="text-destructive size-4 shrink-0" aria-label="Bạn đã chọn — không đúng" />;
  }
  return null;
}

function ReviewBadge({ review }: { review: QuestionReviewItem }) {
  if (!review.isAnswered) {
    return <Badge variant="secondary">Bỏ trống</Badge>;
  }
  return review.isCorrect ? (
    <Badge className="border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
      Đúng · {review.score}/{review.maxScore} điểm
    </Badge>
  ) : (
    <Badge variant="destructive">Sai · 0/{review.maxScore} điểm</Badge>
  );
}
