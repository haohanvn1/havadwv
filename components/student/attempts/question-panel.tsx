"use client";

import { AlertTriangle, Loader2, Send } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ClientSnapshotQuestion } from "@/server/services/examSnapshotService";

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
}) {
  const groupName = `question-${question.questionId}`;

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
        <SaveIndicator state={saveState} error={saveError} />
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
          {question.options.map((opt) => (
            <label
              key={opt.id}
              className="border-border has-[[data-checked]]:border-primary has-[[data-checked]]:bg-primary/5 flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors"
            >
              <RadioGroupItem value={opt.id} disabled={disabled} />
              <span>
                <span className="font-medium">{opt.label}.</span> {opt.content}
              </span>
            </label>
          ))}
        </RadioGroup>
      )}

      {question.type === "MULTIPLE_CHOICE" && (
        <div className="flex flex-col gap-2.5" role="group" aria-labelledby={`${groupName}-label`}>
          {question.options.map((opt) => (
            <label
              key={opt.id}
              className="border-border has-[[data-checked]]:border-primary has-[[data-checked]]:bg-primary/5 flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors"
            >
              <Checkbox
                checked={answer.selectedOptionIds.includes(opt.id)}
                onCheckedChange={() => onMultipleChoiceToggle(opt.id)}
                disabled={disabled}
              />
              <span>
                <span className="font-medium">{opt.label}.</span> {opt.content}
              </span>
            </label>
          ))}
        </div>
      )}

      {question.type === "SHORT_ANSWER" && (
        <Textarea
          value={answer.answerText ?? ""}
          onChange={(e) => onShortAnswerChange(e.target.value)}
          rows={3}
          placeholder="Nhập câu trả lời..."
          disabled={disabled}
          aria-labelledby={`${groupName}-label`}
        />
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
