import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { DifficultyBadge, QuestionTypeBadge } from "./badges";
import type { Difficulty, QuestionType } from "@/lib/generated/prisma/enums";

export interface QuestionPreviewData {
  content: string;
  type: QuestionType;
  difficulty: Difficulty;
  subjectName: string | null;
  topicName: string | null;
  correctAnswerText: string | null;
  hint: string | null;
  explanation: string | null;
  options: { id: string; label: string; content: string; isCorrect: boolean }[];
}

/**
 * Preview mô phỏng cách Student sẽ nhìn thấy câu hỏi, nhưng Admin được thấy
 * thêm đáp án đúng (đánh dấu rõ) — dùng lại ở cả dialog xem nhanh từ danh
 * sách lẫn panel preview trong trang sửa câu hỏi.
 */
export function QuestionPreview({ question }: { question: QuestionPreviewData }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border p-5">
      <div className="flex flex-wrap items-center gap-1.5">
        <QuestionTypeBadge type={question.type} />
        <DifficultyBadge difficulty={question.difficulty} />
        {question.subjectName ? <span className="text-muted-foreground text-xs">{question.subjectName}</span> : null}
        {question.topicName ? (
          <span className="text-muted-foreground text-xs">· {question.topicName}</span>
        ) : null}
      </div>

      <p className="text-sm leading-relaxed whitespace-pre-wrap">{question.content}</p>

      {question.type === "SHORT_ANSWER" ? (
        <div className="bg-muted/50 rounded-lg border border-dashed p-3 text-sm">
          <span className="text-muted-foreground">Đáp án đúng: </span>
          <span className="font-medium">{question.correctAnswerText || "—"}</span>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {question.options.map((option) => (
            <li
              key={option.id}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                option.isCorrect && "border-primary bg-primary/10",
              )}
            >
              {option.isCorrect ? (
                <Check className="text-primary size-4 shrink-0" aria-hidden="true" />
              ) : (
                <Circle className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
              )}
              <span className="text-muted-foreground font-medium">{option.label}.</span>
              <span>{option.content}</span>
            </li>
          ))}
        </ul>
      )}

      {question.hint ? (
        <div className="text-sm">
          <span className="text-muted-foreground font-medium">Gợi ý: </span>
          {question.hint}
        </div>
      ) : null}

      {question.explanation ? (
        <div className="text-sm">
          <span className="text-muted-foreground font-medium">Giải thích: </span>
          {question.explanation}
        </div>
      ) : null}
    </div>
  );
}
