import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ImportStatusBadge } from "@/components/admin/question-bank/import/import-status-badge";
import { RetryImportButton } from "@/components/admin/question-bank/import/retry-import-button";
import { DraftRow } from "@/components/admin/question-bank/import/draft-row";
import { getImportJobDetail, listDraftsForJob } from "@/server/services/questionImportService";
import { readDraftParsedContent } from "@/server/services/importDraftContent";
import { formatFileSize } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ClipboardCheck } from "lucide-react";

export default async function ImportJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("ADMIN");
  const { id } = await params;

  const job = await getImportJobDetail(id);
  if (!job) notFound();

  const drafts = job.status === "DONE" ? await listDraftsForJob(id) : [];

  const detections = drafts.map((d) => readDraftParsedContent(d.parsedContent).detection);
  const highConfidenceCount = detections.filter((d) => d.confidence === "high").length;
  const lowConfidenceCount = detections.filter((d) => d.confidence === "low").length;
  const pageNumbers = new Set(
    detections.map((d) => d.pageNumber).filter((p): p is number => typeof p === "number"),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/question-bank/import"
          className="text-muted-foreground hover:text-foreground mb-2 inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-3.5" />
          Quay lại danh sách import
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">{job.importedFile.filename}</h1>
            <p className="text-muted-foreground text-sm">
              {job.importedFile.mimeType === "application/pdf" ? "PDF" : "DOCX"} ·{" "}
              {formatFileSize(job.importedFile.sizeBytes)} ·{" "}
              {new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(
                job.importedFile.createdAt,
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ImportStatusBadge status={job.status} />
            {job.status === "FAILED" ? <RetryImportButton jobId={job.id} /> : null}
          </div>
        </div>
      </div>

      {job.status === "FAILED" ? (
        <Alert variant="destructive">
          <AlertDescription>{job.errorMessage ?? "Không thể xử lý tài liệu."}</AlertDescription>
        </Alert>
      ) : null}

      {job.status === "PENDING" || job.status === "PROCESSING" ? (
        <Alert>
          <AlertDescription>Tài liệu đang được xử lý, vui lòng tải lại trang sau ít phút.</AlertDescription>
        </Alert>
      ) : null}

      {job.status === "DONE" ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Tổng số draft" value={drafts.length} />
            <StatCard label="Phát hiện rõ ràng" value={highConfidenceCount} />
            <StatCard label="Cần xem lại" value={lowConfidenceCount} />
            <StatCard label="Trang có nội dung" value={pageNumbers.size > 0 ? pageNumbers.size : "—"} />
          </div>

          {drafts.length > 0 ? (
            <Button
              render={<Link href={`/admin/question-bank/import/${job.id}/review`} />}
              nativeButton={false}
              className="w-fit"
            >
              <ClipboardCheck className="size-4" />
              Xem xét & phân tích bằng AI
            </Button>
          ) : null}

          {drafts.length === 0 ? (
            <EmptyState
              title="Không có draft nào được tạo."
              description="Tài liệu có thể không có nội dung văn bản đọc được."
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Nội dung</TableHead>
                    <TableHead>Trang</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="text-right">Xem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drafts.map((draft, index) => (
                    <DraftRow key={draft.id} draft={draft} order={index + 1} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-card rounded-xl border p-4">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-muted-foreground text-xs">{label}</p>
    </div>
  );
}
