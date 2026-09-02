import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { EmptyState } from "@/components/ui/empty-state";
import { ImportUploader } from "@/components/admin/question-bank/import/import-uploader";
import { ImportStatusBadge } from "@/components/admin/question-bank/import/import-status-badge";
import { listImportJobs } from "@/server/services/questionImportService";
import { formatFileSize } from "@/lib/utils";

export default async function ImportQuestionsPage() {
  await requireRole("ADMIN");
  const jobs = await listImportJobs();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Nhập câu hỏi từ tệp</h1>
        <p className="text-muted-foreground text-sm">
          Tải lên đề thi PDF/DOCX để tự động tách thành các câu hỏi nháp — Admin xem xét và duyệt
          thành câu hỏi chính thức ở bước sau.
        </p>
      </div>

      <ImportUploader />

      <div>
        <h2 className="mb-3 text-base font-semibold">Lịch sử import</h2>
        {jobs.length === 0 ? (
          <EmptyState
            title="Chưa có lần import nào."
            description="Tải lên một tệp PDF/DOCX ở trên để bắt đầu."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {jobs.map((job) => (
              <Link
                key={job.id}
                href={`/admin/question-bank/import/${job.id}`}
                className="bg-card hover:bg-muted/40 flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{job.importedFile.filename}</p>
                  <p className="text-muted-foreground text-xs">
                    {new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(
                      job.createdAt,
                    )}{" "}
                    · {formatFileSize(job.importedFile.sizeBytes)}
                    {job.status === "DONE" ? ` · ${job.totalExtracted} câu hỏi` : ""}
                  </p>
                </div>
                <ImportStatusBadge status={job.status} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
