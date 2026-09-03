"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function PublishButton({ examId }: { examId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePublish() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/exams/${examId}/publish`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Không thể publish đề thi.");
        return;
      }
      router.refresh();
    } catch {
      setError("Có lỗi xảy ra.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <AlertDialog>
        <AlertDialogTrigger render={<Button disabled={busy} />}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
          Publish
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish đề thi này?</AlertDialogTitle>
            <AlertDialogDescription>
              Sau khi publish, đề thi sẽ ở trạng thái sẵn sàng sử dụng. Hệ thống sẽ kiểm tra lại toàn bộ câu hỏi
              trong đề trước khi publish.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Huỷ</AlertDialogCancel>
            <AlertDialogAction onClick={handlePublish} disabled={busy}>
              Publish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
