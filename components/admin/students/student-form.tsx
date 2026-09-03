"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export interface StudentFormInitialData {
  fullName: string;
  email: string | null;
  phone: string | null;
  class: string | null;
  school: string | null;
  targetExamType: string | null;
}

export function StudentForm({
  mode,
  studentId,
  initialData,
}: {
  mode: "create" | "edit";
  studentId?: string;
  initialData?: StudentFormInitialData;
}) {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState(initialData?.fullName ?? "");
  const [email, setEmail] = useState(initialData?.email ?? "");
  const [phone, setPhone] = useState(initialData?.phone ?? "");
  const [studentClass, setStudentClass] = useState(initialData?.class ?? "");
  const [school, setSchool] = useState(initialData?.school ?? "");
  const [targetExamType, setTargetExamType] = useState(initialData?.targetExamType ?? "");

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    const payload =
      mode === "create"
        ? {
            username,
            password,
            fullName,
            email: email || undefined,
            phone: phone || undefined,
            class: studentClass || undefined,
            school: school || undefined,
            targetExamType: targetExamType || undefined,
          }
        : {
            fullName,
            email: email || undefined,
            phone: phone || undefined,
            class: studentClass || undefined,
            school: school || undefined,
            targetExamType: targetExamType || undefined,
          };

    try {
      const url = mode === "create" ? "/api/admin/students" : `/api/admin/students/${studentId}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (json.fieldErrors) setFieldErrors(json.fieldErrors);
        setFormError(json.error ?? "Không thể lưu học sinh.");
        return;
      }

      router.push("/admin/students");
      router.refresh();
    } catch {
      setFormError("Có lỗi xảy ra, vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 pb-16">
      {formError ? (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:max-w-2xl">
        {mode === "create" ? (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="username">Tên đăng nhập</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="hs.nguyenvana"
                aria-invalid={Boolean(fieldErrors.username)}
              />
              {fieldErrors.username ? <p className="text-destructive text-xs">{fieldErrors.username}</p> : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Mật khẩu</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ít nhất 8 ký tự"
                aria-invalid={Boolean(fieldErrors.password)}
              />
              {fieldErrors.password ? <p className="text-destructive text-xs">{fieldErrors.password}</p> : null}
            </div>
          </>
        ) : null}

        <div className="flex flex-col gap-2">
          <Label htmlFor="fullName">Họ và tên</Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Nguyễn Văn A"
            aria-invalid={Boolean(fieldErrors.fullName)}
          />
          {fieldErrors.fullName ? <p className="text-destructive text-xs">{fieldErrors.fullName}</p> : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="hocsinh@email.com"
            aria-invalid={Boolean(fieldErrors.email)}
          />
          {fieldErrors.email ? <p className="text-destructive text-xs">{fieldErrors.email}</p> : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="phone">Số điện thoại</Label>
          <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09xxxxxxxx" />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="class">Lớp</Label>
          <Input id="class" value={studentClass} onChange={(e) => setStudentClass(e.target.value)} placeholder="12A1" />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="school">Trường</Label>
          <Input id="school" value={school} onChange={(e) => setSchool(e.target.value)} placeholder="THPT ..." />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="targetExamType">Kỳ thi mục tiêu</Label>
          <Input
            id="targetExamType"
            value={targetExamType}
            onChange={(e) => setTargetExamType(e.target.value)}
            placeholder="ĐGNL, THPTQG..."
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" onClick={() => router.push("/admin/students")}>
          Huỷ
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
          {mode === "create" ? "Tạo tài khoản" : "Lưu thay đổi"}
        </Button>
      </div>
    </form>
  );
}
