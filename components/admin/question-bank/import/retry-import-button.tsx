"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RetryImportButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRetry() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/question-imports/${jobId}/retry`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Không thể xử lý lại.");
        return;
      }
      router.refresh();
    } catch {
      setError("Có lỗi xảy ra. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={handleRetry} disabled={loading} variant="outline" size="sm">
        {loading ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
        Thử lại
      </Button>
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
