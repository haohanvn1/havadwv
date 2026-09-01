"use client";

import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ErrorState({
  message = "Không thể tải dữ liệu.",
  className,
}: {
  message?: string;
  className?: string;
}) {
  const router = useRouter();

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center",
        className,
      )}
    >
      <AlertCircle className="text-destructive size-6" aria-hidden="true" />
      <p className="text-muted-foreground text-sm">{message}</p>
      <Button variant="outline" size="sm" onClick={() => router.refresh()}>
        Thử lại
      </Button>
    </div>
  );
}
