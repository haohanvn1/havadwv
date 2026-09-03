"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { KeyRound, Loader2, Lock, Pencil, Trash2, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { UserStatus } from "@/lib/generated/prisma/enums";

export function StudentRowActions({
  id,
  status,
  hasAttempts,
}: {
  id: string;
  status: UserStatus;
  hasAttempts: boolean;
}) {
  const router = useRouter();
  const [statusOpen, setStatusOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextStatus: UserStatus = status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

  async function handleToggleStatus() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/students/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error();
      setStatusOpen(false);
      router.refresh();
    } catch {
      setError("Không thể cập nhật trạng thái.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/students/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Không thể xoá học sinh.");
        return;
      }
      setDeleteOpen(false);
      router.refresh();
    } catch {
      setError("Có lỗi xảy ra.");
    } finally {
      setBusy(false);
    }
  }

  async function handleResetPassword() {
    setBusy(true);
    setResetError(null);
    try {
      const res = await fetch(`/api/admin/students/${id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResetError(body.error ?? "Không thể đặt lại mật khẩu.");
        return;
      }
      setResetOpen(false);
      setNewPassword("");
    } catch {
      setResetError("Có lỗi xảy ra.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {error ? <span className="text-destructive text-xs">{error}</span> : null}

      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Chỉnh sửa"
        nativeButton={false}
        render={<Link href={`/admin/students/${id}/edit`} />}
      >
        <Pencil className="size-4" />
      </Button>

      <Dialog
        open={resetOpen}
        onOpenChange={(open) => {
          setResetOpen(open);
          if (!open) {
            setNewPassword("");
            setResetError(null);
          }
        }}
      >
        <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Đặt lại mật khẩu" />}>
          <KeyRound className="size-4" />
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Đặt lại mật khẩu</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`reset-password-${id}`}>Mật khẩu mới</Label>
            <Input
              id={`reset-password-${id}`}
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Ít nhất 8 ký tự"
            />
            {resetError ? <p className="text-destructive text-xs">{resetError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResetOpen(false)} disabled={busy}>
              Huỷ
            </Button>
            <Button onClick={handleResetPassword} disabled={busy || newPassword.length < 8}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Đặt lại
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={statusOpen} onOpenChange={setStatusOpen}>
        <AlertDialogTrigger
          render={<Button variant="ghost" size="icon-sm" aria-label={status === "ACTIVE" ? "Khoá tài khoản" : "Mở khoá tài khoản"} />}
        >
          {status === "ACTIVE" ? <Lock className="size-4" /> : <Unlock className="size-4" />}
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{status === "ACTIVE" ? "Khoá tài khoản này?" : "Mở khoá tài khoản này?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {status === "ACTIVE"
                ? "Học sinh sẽ không thể đăng nhập cho đến khi được mở khoá lại."
                : "Học sinh sẽ có thể đăng nhập lại bình thường."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Huỷ</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleStatus} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {status === "ACTIVE" ? "Khoá" : "Mở khoá"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {!hasAttempts ? (
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Xoá" />}>
            <Trash2 className="text-destructive size-4" />
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Xoá tài khoản này?</AlertDialogTitle>
              <AlertDialogDescription>
                Học sinh chưa có bài làm nào nên có thể xoá vĩnh viễn. Hành động này không thể hoàn tác.
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
