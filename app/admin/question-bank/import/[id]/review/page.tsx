import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { getReviewData } from "@/server/services/questionImportReviewService";
import { listSubjectsForForm } from "@/server/services/questionService";
import { ReviewWorkspace } from "@/components/admin/question-bank/review/review-workspace";

export default async function ImportReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("ADMIN");
  const { id } = await params;

  let data;
  try {
    data = await getReviewData(id);
  } catch {
    notFound();
  }

  const { job, drafts, summary } = data;

  if (job.status !== "DONE") {
    notFound();
  }

  const subjects = await listSubjectsForForm();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          href={`/admin/question-bank/import/${job.id}`}
          className="text-muted-foreground hover:text-foreground mb-2 inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-3.5" />
          Quay lại kết quả import
        </Link>
        <h1 className="text-xl font-semibold">Xem xét câu hỏi — {job.importedFile.filename}</h1>
        <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span>Tổng: {summary.total}</span>
          <span>Đã phân tích AI: {summary.aiProcessed}</span>
          <span>Cần review: {summary.needsReview}</span>
          <span>Đã duyệt: {summary.approved}</span>
          <span>Đã từ chối: {summary.rejected}</span>
        </div>
      </div>

      <ReviewWorkspace
        jobId={job.id}
        drafts={drafts}
        subjects={subjects}
        sourceFilename={job.importedFile.filename}
      />
    </div>
  );
}
