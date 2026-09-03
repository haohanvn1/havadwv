import { readDraftParsedContent } from "@/server/services/importDraftContent";
import type { ReviewDraftItem } from "./review-draft-editor";

export function ReviewSourcePanel({
  draft,
  sourceFilename,
}: {
  draft: ReviewDraftItem;
  sourceFilename: string;
}) {
  const { detection } = readDraftParsedContent(draft.parsedContent);

  return (
    <div className="flex flex-col gap-3">
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span>
          Nguồn: <span className="text-foreground font-medium">{sourceFilename}</span>
        </span>
        <span>{detection.pageNumber ? `Trang ${detection.pageNumber}` : "Không xác định trang"}</span>
        {detection.questionNumberLabel ? <span>Câu số gốc: {detection.questionNumberLabel}</span> : null}
      </div>
      {detection.warning ? (
        <p className="bg-muted/50 text-muted-foreground rounded-lg border border-dashed p-2 text-xs">
          {detection.warning}
        </p>
      ) : null}
      <pre className="bg-muted/40 max-h-[60vh] overflow-y-auto rounded-xl border p-3 text-sm whitespace-pre-wrap">
        {draft.rawText}
      </pre>
    </div>
  );
}
