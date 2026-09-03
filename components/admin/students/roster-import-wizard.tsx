"use client";

import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface RosterRowPreview {
  rowNumber: number;
  fullName: string;
  phone: string;
  email: string | null;
  className: string | null;
  subjectIds: string[];
  status: "valid" | "error";
  errors: string[];
}

interface RosterParsePreview {
  unmappedColumns: string[];
  rows: RosterRowPreview[];
  readyToCommit: boolean;
}

interface RosterCommitRowResult {
  rowNumber: number;
  fullName: string;
  status: "created" | "skipped" | "failed";
  username?: string;
  password?: string;
  reason?: string;
}

interface RosterCommitResult {
  created: number;
  skipped: number;
  failed: number;
  rows: RosterCommitRowResult[];
}

export function RosterImportWizard({ subjects }: { subjects: { id: string; name: string }[] }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<RosterParsePreview | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commitResult, setCommitResult] = useState<RosterCommitResult | null>(null);

  async function runPreview(selectedFile: File, mapping: Record<string, string>) {
    setBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("columnMappingOverrides", JSON.stringify(mapping));
      const res = await fetch("/api/admin/students/import/preview", { method: "POST", body: formData });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Không thể đọc file.");
        setPreview(null);
        return;
      }
      setPreview(body.preview);
    } catch {
      setError("Có lỗi xảy ra, vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setCommitResult(null);
    setColumnMapping({});
    void runPreview(selected, {});
  }

  function handleMappingChange(headerText: string, subjectId: string) {
    const next = { ...columnMapping, [headerText]: subjectId };
    setColumnMapping(next);
    if (file) void runPreview(file, next);
  }

  async function handleCommit() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("columnMappingOverrides", JSON.stringify(columnMapping));
      const res = await fetch("/api/admin/students/import/commit", { method: "POST", body: formData });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Không thể tạo tài khoản.");
        return;
      }
      setCommitResult(body.result);
    } catch {
      setError("Có lỗi xảy ra, vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  function downloadCsv() {
    if (!commitResult) return;
    const created = commitResult.rows.filter((r) => r.status === "created");
    const header = "Họ và tên,Tên đăng nhập,Mật khẩu\n";
    const body = created
      .map((r) => `"${r.fullName}","${r.username}","${r.password}"`)
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tai-khoan-hoc-sinh.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (commitResult) {
    return (
      <div className="flex flex-col gap-4">
        <Alert>
          <AlertDescription>
            Đã tạo {commitResult.created} tài khoản, bỏ qua {commitResult.skipped} dòng lỗi, {commitResult.failed}{" "}
            dòng thất bại khi tạo.
          </AlertDescription>
        </Alert>

        {commitResult.rows.some((r) => r.status === "created") ? (
          <Button onClick={downloadCsv} className="w-fit">
            Tải CSV danh sách tài khoản
          </Button>
        ) : null}

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Họ tên</th>
                <th className="px-3 py-2 font-medium">Trạng thái</th>
                <th className="px-3 py-2 font-medium">Tên đăng nhập</th>
                <th className="px-3 py-2 font-medium">Mật khẩu</th>
                <th className="px-3 py-2 font-medium">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {commitResult.rows.map((r) => (
                <tr key={r.rowNumber} className="border-t">
                  <td className="px-3 py-2">{r.fullName}</td>
                  <td className="px-3 py-2">
                    <Badge variant={r.status === "created" ? "default" : "secondary"}>
                      {r.status === "created" ? "Đã tạo" : r.status === "skipped" ? "Bỏ qua" : "Thất bại"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{r.username ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.password ?? "—"}</td>
                  <td className="text-muted-foreground px-3 py-2 text-xs">{r.reason ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="border-border bg-card flex flex-col items-center gap-3 rounded-3xl border border-dashed p-8 text-center">
        <Upload className="text-muted-foreground size-8" />
        <p className="text-sm">Chọn file Excel (.xlsx) danh sách học sinh theo lớp.</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx"
          onChange={handleFileChange}
          className="hidden"
        />
        <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          {file ? file.name : "Chọn file"}
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {preview ? (
        <>
          {preview.unmappedColumns.length > 0 ? (
            <div className="bg-card border-border flex flex-col gap-3 rounded-3xl border p-4">
              <p className="text-sm font-medium">Cột chưa nhận diện — chọn môn tương ứng:</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {preview.unmappedColumns.map((headerText) => (
                  <div key={headerText} className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium">{headerText}</span>
                    <Select
                      value={columnMapping[headerText] ?? ""}
                      onValueChange={(v) => v && handleMappingChange(headerText, v as string)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(v: string) => subjects.find((s) => s.id === v)?.name ?? "Chọn môn"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {subjects.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex items-center gap-3 text-sm">
            <Badge>{preview.rows.filter((r) => r.status === "valid").length} hợp lệ</Badge>
            <Badge variant="secondary">{preview.rows.filter((r) => r.status === "error").length} lỗi</Badge>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Dòng</th>
                  <th className="px-3 py-2 font-medium">Họ tên</th>
                  <th className="px-3 py-2 font-medium">SĐT</th>
                  <th className="px-3 py-2 font-medium">Lớp</th>
                  <th className="px-3 py-2 font-medium">Số môn đăng ký</th>
                  <th className="px-3 py-2 font-medium">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.rowNumber} className="border-t">
                    <td className="px-3 py-2">{row.rowNumber}</td>
                    <td className="px-3 py-2">{row.fullName}</td>
                    <td className="px-3 py-2">{row.phone}</td>
                    <td className="px-3 py-2">{row.className ?? "—"}</td>
                    <td className="px-3 py-2">{row.subjectIds.length}</td>
                    <td className="px-3 py-2">
                      {row.status === "valid" ? (
                        <Badge>Hợp lệ</Badge>
                      ) : (
                        <span className="text-destructive text-xs">{row.errors.join(" ")}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button
            onClick={handleCommit}
            disabled={busy || !preview.readyToCommit || preview.rows.filter((r) => r.status === "valid").length === 0}
            className="w-fit"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Tạo {preview.rows.filter((r) => r.status === "valid").length} tài khoản hợp lệ
          </Button>
        </>
      ) : null}
    </div>
  );
}
