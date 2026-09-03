"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { QuestionPreview, type QuestionPreviewData } from "./question-preview";

export function QuestionPreviewDialog({ questionId }: { questionId: string }) {
  const [data, setData] = useState<QuestionPreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function handleOpenChange(open: boolean) {
    if (!open || data || loading) return;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/admin/questions/${questionId}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      const q = json.question;
      setData({
        content: q.content,
        type: q.type,
        difficulty: q.difficulty,
        subjectName: q.subject?.name ?? null,
        topicName: q.topic?.name ?? null,
        correctAnswerText: q.correctAnswerText,
        hint: q.hint,
        explanation: q.explanation,
        options: q.options,
      });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Xem trước câu hỏi" />}>
        <Eye className="size-4" />
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Xem trước câu hỏi</DialogTitle>
        </DialogHeader>
        {loading ? <Skeleton className="h-40 w-full" /> : null}
        {error ? <p className="text-destructive text-sm">Không thể tải câu hỏi.</p> : null}
        {data ? <QuestionPreview question={data} /> : null}
      </DialogContent>
    </Dialog>
  );
}
