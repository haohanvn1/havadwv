"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Archive, CheckCircle2, Loader2, Pencil, Trash2 } from "lucide-react";
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
import type { BlueprintStatus } from "@/lib/generated/prisma/enums";

export function BlueprintActions({ id, status }: { id: string; status: BlueprintStatus }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"activate" | "archive" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function callAction(action: "activate" | "archive") {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/admin/exam-blueprints/${id}/${action}`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Không thể thực hiện thao tác.");
        return;
      }
      router.refresh();
    } catch {
      setError("Có lỗi xảy ra.");
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete() {
    setBusy("delete");
    setError(null);
    try {
      const res = await fetch(`/api/admin/exam-blueprints/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Không thể xoá Blueprint.");
        return;
      }
      router.push("/admin/exam-structures");
      router.refresh();
    } catch {
      setError("Có lỗi xảy ra.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {status !== "ARCHIVED" ? (
          <Button variant="outline" size="sm" render={<Link href={`/admin/exam-structures/${id}/edit`} />} nativeButton={false}>
            <Pencil className="size-3.5" />
            Sửa
          </Button>
        ) : null}
        {status === "DRAFT" ? (
          <Button variant="outline" size="sm" onClick={() => callAction("activate")} disabled={busy !== null}>
            {busy === "activate" ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
            Kích hoạt
          </Button>
        ) : null}
        {status !== "ARCHIVED" ? (
          <Button variant="outline" size="sm" onClick={() => callAction("archive")} disabled={busy !== null}>
            {busy === "archive" ? <Loader2 className="size-3.5 animate-spin" /> : <Archive className="size-3.5" />}
            Lưu trữ
          </Button>
        ) : null}
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="ghost" size="sm" disabled={busy !== null} />}>
            <Trash2 className="text-destructive size-3.5" />
            Xoá
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Xoá Blueprint này?</AlertDialogTitle>
              <AlertDialogDescription>
                Chỉ xoá được nếu Blueprint chưa từng dùng để sinh đề. Hành động không thể hoàn tác.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy !== null}>Huỷ</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={busy !== null}>
                {busy === "delete" ? <Loader2 className="size-4 animate-spin" /> : null}
                Xoá
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
