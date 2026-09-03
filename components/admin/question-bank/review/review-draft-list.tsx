"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { readDraftParsedContent } from "@/server/services/importDraftContent";
import type { ReviewDraftItem } from "./review-draft-editor";

function truncate(text: string, max = 70) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

export function ReviewDraftList({
  drafts,
  selectedId,
  onSelect,
}: {
  drafts: ReviewDraftItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (drafts.length === 0) {
    return (
      <p className="text-muted-foreground p-4 text-center text-sm">
        Không có draft nào khớp bộ lọc hiện tại.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-1.5">
      {drafts.map((draft, index) => {
        const { detection, aiExtraction } = readDraftParsedContent(draft.parsedContent);
        const active = draft.id === selectedId;
        return (
          <button
            key={draft.id}
            type="button"
            onClick={() => onSelect(draft.id)}
            className={cn(
              "flex flex-col gap-1 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
              active ? "bg-primary/10 text-primary" : "hover:bg-muted",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground text-xs font-medium">
                {detection.questionNumberLabel ? `Câu ${detection.questionNumberLabel}` : `#${index + 1}`}
                {detection.pageNumber ? ` · Tr.${detection.pageNumber}` : ""}
              </span>
              {draft.status === "APPROVED" ? (
                <CheckCircle2 className="text-primary size-3.5 shrink-0" aria-label="Đã duyệt" />
              ) : draft.status === "REJECTED" ? (
                <XCircle className="text-destructive size-3.5 shrink-0" aria-label="Đã từ chối" />
              ) : aiExtraction?.status === "DONE" && aiExtraction.result && aiExtraction.result.confidence < 0.5 ? (
                <span aria-label="Độ tin cậy thấp">🔴</span>
              ) : aiExtraction?.status === "DONE" ? (
                <span aria-label="Đã phân tích">🟢</span>
              ) : null}
            </div>
            <p className="line-clamp-2">{truncate(draft.rawText)}</p>
          </button>
        );
      })}
    </div>
  );
}
