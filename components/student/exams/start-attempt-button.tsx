"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function StartAttemptButton({
  examId,
  hasActiveAttempt,
  activeAttemptId,
  canStart,
}: {
  examId: string;
  hasActiveAttempt: boolean;
  activeAttemptId: string | null;
  canStart: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (hasActiveAttempt && activeAttemptId) {
      router.push(`/student/attempts/${activeAttemptId}`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/student/exams/${examId}/attempts`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Không thể bắt đầu làm bài.");
        return;
      }
      router.push(`/student/attempts/${body.attemptId}`);
    } catch {
      setError("Có lỗi xảy ra, vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <Button
        onClick={handleClick}
        disabled={busy || (!canStart && !hasActiveAttempt)}
        className="rounded-full"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : null}
        {hasActiveAttempt ? "Tiếp tục làm bài" : "Bắt đầu làm bài"}
      </Button>
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
      {!canStart && !hasActiveAttempt ? (
        <p className="text-muted-foreground text-xs">Bạn đã dùng hết số lần làm bài cho phép.</p>
      ) : null}
    </div>
  );
}
