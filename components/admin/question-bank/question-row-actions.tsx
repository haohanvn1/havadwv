"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Archive, Loader2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { QuestionPreviewDialog } from "./question-preview-dialog";

export function QuestionRowActions({
  id,
  status,
  usedInExamCount,
}: {
  id: string;
  status: string;
  usedInExamCount: number;
}) {
  const router = useRouter();
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleArchive() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/questions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ARCHIVED" }),
      });
      if (!res.ok) throw new Error();
      setArchiveOpen(false);
      router.refresh();
    } catch {
      setError("Không thể lưu trữ câu hỏi.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/questions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setDeleteOpen(false);
      router.refresh();
    } catch {
      setError("Không thể xoá câu hỏi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {error ? <span className="text-destructive text-xs">{error}</span> : null}

      <QuestionPreviewDialog questionId={id} />

      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Chỉnh sửa"
        nativeButton={false}
        render={<Link href={`/admin/question-bank/${id}/edit`} />}
      >
        <Pencil className="size-4" />
      </Button>

      {status !== "ARCHIVED" ? (
        <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
          <AlertDialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Lưu trữ" />}>
            <Archive className="size-4" />
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Lưu trữ câu hỏi này?</AlertDialogTitle>
              <AlertDialogDescription>
                Câu hỏi đã lưu trữ sẽ không thể được chọn để tạo đề mới, nhưng vẫn giữ nguyên trong các
                đề đã dùng trước đó.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Huỷ</AlertDialogCancel>
              <AlertDialogAction onClick={handleArchive} disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                Lưu trữ
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}

      {usedInExamCount === 0 ? (
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Xoá" />}>
            <Trash2 className="text-destructive size-4" />
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Xoá câu hỏi này?</AlertDialogTitle>
              <AlertDialogDescription>
                Câu hỏi chưa được dùng trong đề nào nên có thể xoá vĩnh viễn. Hành động này không thể
                hoàn tác.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Huỷ</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                Xoá vĩnh viễn
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </div>
  );
}
