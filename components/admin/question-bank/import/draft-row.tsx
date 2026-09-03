"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TableCell, TableRow } from "@/components/ui/table";
import { readDraftParsedContent } from "@/server/services/importDraftContent";

export interface DraftListItem {
  id: string;
  rawText: string;
  parsedContent: unknown;
  createdAt: string | Date;
}

function truncate(text: string, max = 120) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

export function DraftRow({ draft, order }: { draft: DraftListItem; order: number }) {
  const [open, setOpen] = useState(false);
  const { detection } = readDraftParsedContent(draft.parsedContent);
  const isLowConfidence = detection.confidence === "low";

  return (
    <>
      <TableRow className="cursor-pointer" onClick={() => setOpen(true)}>
        <TableCell className="text-muted-foreground">{order}</TableCell>
        <TableCell className="max-w-96 whitespace-normal">
          <p className="line-clamp-2 text-sm">{truncate(draft.rawText)}</p>
        </TableCell>
        <TableCell className="text-muted-foreground text-sm">{detection.pageNumber ?? "—"}</TableCell>
        <TableCell>
          {isLowConfidence ? (
            <Badge variant="secondary">
              <AlertTriangle className="size-3" aria-hidden="true" />
              Cần xem lại
            </Badge>
          ) : (
            <Badge variant="default">
              <CheckCircle2 className="size-3" aria-hidden="true" />
              Đã phát hiện
            </Badge>
          )}
        </TableCell>
        <TableCell className="text-right">
          <Button variant="ghost" size="icon-sm" aria-label="Xem raw text" onClick={() => setOpen(true)}>
            <Eye className="size-4" />
          </Button>
        </TableCell>
      </TableRow>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {detection.questionNumberLabel ? `Câu ${detection.questionNumberLabel}` : `Draft #${order}`}
            </DialogTitle>
            <DialogDescription>
              {detection.pageNumber ? `Trang ${detection.pageNumber} · ` : ""}
              {detection.warning ?? "Nội dung trích xuất thô, chưa qua chỉnh sửa."}
            </DialogDescription>
          </DialogHeader>
          <pre className="bg-muted/50 max-h-96 overflow-y-auto rounded-lg border p-3 text-sm whitespace-pre-wrap">
            {draft.rawText}
          </pre>
        </DialogContent>
      </Dialog>
    </>
  );
}
