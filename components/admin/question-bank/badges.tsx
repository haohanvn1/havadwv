import { Badge } from "@/components/ui/badge";
import {
  DIFFICULTY_LABELS,
  QUESTION_STATUS_LABELS,
  QUESTION_TYPE_LABELS,
} from "@/lib/constants/question-bank";
import type { Difficulty, QuestionStatus, QuestionType } from "@/lib/generated/prisma/enums";

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const variant = difficulty === "HARD" ? "destructive" : difficulty === "MEDIUM" ? "secondary" : "outline";
  return <Badge variant={variant}>{DIFFICULTY_LABELS[difficulty]}</Badge>;
}

export function QuestionStatusBadge({ status }: { status: QuestionStatus }) {
  const variant = status === "ACTIVE" ? "default" : status === "ARCHIVED" ? "outline" : "secondary";
  return <Badge variant={variant}>{QUESTION_STATUS_LABELS[status]}</Badge>;
}

export function QuestionTypeBadge({ type }: { type: QuestionType }) {
  return <Badge variant="outline">{QUESTION_TYPE_LABELS[type]}</Badge>;
}
