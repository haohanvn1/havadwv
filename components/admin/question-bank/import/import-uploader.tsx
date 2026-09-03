"use client";

import { useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn, formatFileSize } from "@/lib/utils";

const ALLOWED_EXTENSIONS = [".pdf", ".docx"];
const MAX_SIZE_BYTES = 20 * 1024 * 1024;
const MAX_SIZE_LABEL = "20MB";

/**
 * Validate phía client chỉ để phản hồi nhanh/thân thiện — server luôn validate
 * lại toàn bộ (extension, MIME, magic byte, kích thước) trong questionImportService,
 * không tin bất kỳ giá trị nào từ đây.
 */
function validateClientSide(file: File): string | null {
  const dotIndex = file.name.lastIndexOf(".");
  const ext = dotIndex >= 0 ? file.name.slice(dotIndex).toLowerCase() : "";
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return "Chỉ hỗ trợ tệp PDF hoặc DOCX.";
  }
  if (file.size === 0) {
    return "Tệp trống.";
  }
  if (file.size > MAX_SIZE_BYTES) {
    return `File vượt quá dung lượng cho phép (tối đa ${MAX_SIZE_LABEL}).`;
  }
  return null;
}

export function ImportUploader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleFiles(files: FileList | null) {
    const next = files?.[0];
    if (!next) return;
    const validationError = validateClientSide(next);
    if (validationError) {
      setError(validationError);
      setFile(null);
      return;
    }
    setError(null);
    setFile(next);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    handleFiles(event.dataTransfer.files);
  }

  async function handleSubmit() {
    if (!file) return;
    setSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/question-imports", { method: "POST", body: formData });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(body.error ?? "Không thể tải lên tệp.");
        return;
      }

      router.push(`/admin/question-bank/import/${body.job.id}`);
      router.refresh();
    } catch {
      setError("Có lỗi xảy ra khi tải lên. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-10 text-center transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
        )}
      >
        <UploadCloud className="text-muted-foreground size-8" aria-hidden="true" />
        <p className="text-sm font-medium">Kéo thả tệp vào đây hoặc bấm để chọn</p>
        <p className="text-muted-foreground text-xs">Hỗ trợ PDF, DOCX — tối đa {MAX_SIZE_LABEL}</p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          className="hidden"
          onChange={(event) => handleFiles(event.target.files)}
        />
      </div>

      {file ? (
        <div className="bg-card flex items-center gap-3 rounded-xl border p-3">
          <FileText className="text-muted-foreground size-5 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-muted-foreground text-xs">{formatFileSize(file.size)}</p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setFile(null)}
            aria-label="Bỏ chọn tệp"
            disabled={submitting}
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Button onClick={handleSubmit} disabled={!file || submitting} className="w-fit">
        {submitting ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <UploadCloud className="size-4" />
        )}
        {submitting ? "Đang tải lên và xử lý..." : "Tải lên & xử lý"}
      </Button>
    </div>
  );
}
