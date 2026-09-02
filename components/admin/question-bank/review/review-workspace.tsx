"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { readDraftParsedContent } from "@/server/services/importDraftContent";
import { ReviewDraftList } from "./review-draft-list";
import { ReviewSourcePanel } from "./review-source-panel";
import { ReviewDraftEditor, type ReviewDraftItem } from "./review-draft-editor";

type FilterKey = "all" | "unreviewed" | "low-confidence" | "warning" | "approved" | "rejected";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "unreviewed", label: "Chưa review" },
  { key: "low-confidence", label: "AI tin cậy thấp" },
  { key: "warning", label: "Có cảnh báo" },
  { key: "approved", label: "Đã duyệt" },
  { key: "rejected", label: "Đã từ chối" },
];

function matchesFilter(draft: ReviewDraftItem, filter: FilterKey): boolean {
  if (filter === "all") return true;
  if (filter === "approved") return draft.status === "APPROVED";
  if (filter === "rejected") return draft.status === "REJECTED";
  if (filter === "unreviewed") return draft.status === "PENDING";

  const { detection, aiExtraction } = readDraftParsedContent(draft.parsedContent);
  if (filter === "low-confidence") {
    if (detection.confidence === "low") return true;
    return Boolean(aiExtraction?.result && aiExtraction.result.confidence < 0.5);
  }
  if (filter === "warning") {
    const hasDetectionWarning = Boolean(detection.warning);
    const hasAiWarnings = Boolean(aiExtraction?.result?.warnings?.length);
    return hasDetectionWarning || hasAiWarnings;
  }
  return true;
}

export function ReviewWorkspace({
  jobId,
  drafts,
  subjects,
  sourceFilename,
}: {
  jobId: string;
  drafts: ReviewDraftItem[];
  subjects: { id: string; name: string }[];
  sourceFilename: string;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selectedId, setSelectedId] = useState<string | null>(drafts[0]?.id ?? null);
  const [extractingAll, setExtractingAll] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  const filteredDrafts = useMemo(
    () => drafts.filter((d) => matchesFilter(d, filter)),
    [drafts, filter],
  );

  const selectedDraft = drafts.find((d) => d.id === selectedId) ?? filteredDrafts[0] ?? null;
  const selectedIndex = selectedDraft ? drafts.findIndex((d) => d.id === selectedDraft.id) : -1;

  function handleChanged() {
    router.refresh();
  }

  async function handleExtractAll() {
    setExtractingAll(true);
    setExtractError(null);
    try {
      const res = await fetch(`/api/admin/question-imports/${jobId}/extract`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setExtractError(body.error ?? "Không thể phân tích bằng AI.");
        return;
      }
      router.refresh();
    } catch {
      setExtractError("Có lỗi xảy ra khi gọi AI.");
    } finally {
      setExtractingAll(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={filter}
          onValueChange={(v) => v && setFilter(v as FilterKey)}
          orientation="horizontal"
          className="w-fit"
        >
          <TabsList>
            {FILTERS.map((f) => (
              <TabsTrigger key={f.key} value={f.key}>
                {f.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <Button onClick={handleExtractAll} disabled={extractingAll} variant="outline" size="sm">
          {extractingAll ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          Phân tích tất cả bằng AI
        </Button>
      </div>

      {extractError ? <p className="text-destructive text-sm">{extractError}</p> : null}

      {drafts.length === 0 ? (
        <EmptyState title="Chưa có draft nào." description="Import chưa tạo ra câu hỏi nháp nào." />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
          <div className="bg-card max-h-[75vh] overflow-y-auto rounded-xl border lg:sticky lg:top-4">
            <ReviewDraftList drafts={filteredDrafts} selectedId={selectedDraft?.id ?? null} onSelect={setSelectedId} />
          </div>

          {selectedDraft ? (
            <div className="flex flex-col gap-4">
              {/* Desktop: nguồn + editor cạnh nhau. Mobile/tablet: chuyển sang Tabs. */}
              <div className="hidden gap-4 lg:grid lg:grid-cols-2">
                <div className="bg-card rounded-xl border p-4">
                  <h2 className="mb-3 text-sm font-semibold">Nguồn gốc</h2>
                  <ReviewSourcePanel draft={selectedDraft} sourceFilename={sourceFilename} />
                </div>
                <div className="bg-card rounded-xl border p-4">
                  <h2 className="mb-3 text-sm font-semibold">Chỉnh sửa câu hỏi</h2>
                  <ReviewDraftEditor
                    key={`${selectedDraft.id}-${String(selectedDraft.updatedAt)}`}
                    jobId={jobId}
                    draft={selectedDraft}
                    order={selectedIndex + 1}
                    subjects={subjects}
                    onChanged={handleChanged}
                  />
                </div>
              </div>

              <div className="lg:hidden">
                <Tabs defaultValue="editor">
                  <TabsList>
                    <TabsTrigger value="source">Nguồn gốc</TabsTrigger>
                    <TabsTrigger value="editor">Chỉnh sửa</TabsTrigger>
                  </TabsList>
                  <TabsContent value="source">
                    <div className="bg-card rounded-xl border p-4">
                      <ReviewSourcePanel draft={selectedDraft} sourceFilename={sourceFilename} />
                    </div>
                  </TabsContent>
                  <TabsContent value="editor">
                    <div className="bg-card rounded-xl border p-4">
                      <ReviewDraftEditor
                        key={`${selectedDraft.id}-${String(selectedDraft.updatedAt)}`}
                        jobId={jobId}
                        draft={selectedDraft}
                        order={selectedIndex + 1}
                        subjects={subjects}
                        onChanged={handleChanged}
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          ) : (
            <EmptyState title="Không có draft nào khớp bộ lọc." />
          )}
        </div>
      )}
    </div>
  );
}
