import Link from "next/link";
import { Plus } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { QuestionFilters } from "@/components/admin/question-bank/question-filters";
import { QuestionTable } from "@/components/admin/question-bank/question-table";
import { PaginationControls } from "@/components/admin/question-bank/pagination-controls";
import { listQuestions, listSubjectsForForm } from "@/server/services/questionService";
import { parseQuestionListParams } from "@/validators/question";

export default async function QuestionBankPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("ADMIN");

  const resolvedParams = await searchParams;
  const urlSearchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(resolvedParams)) {
    if (typeof value === "string") urlSearchParams.set(key, value);
  }
  const params = parseQuestionListParams(urlSearchParams);

  const [subjects, listResult] = await Promise.all([
    listSubjectsForForm(),
    listQuestions(params).catch(() => null),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Ngân hàng câu hỏi</h1>
          <p className="text-muted-foreground text-sm">
            Quản lý câu hỏi dùng để tạo đề thi và bài ôn tập.
          </p>
        </div>
        <Button render={<Link href="/admin/question-bank/new" />} nativeButton={false}>
          <Plus className="size-4" />
          Thêm câu hỏi
        </Button>
      </div>

      <QuestionFilters subjects={subjects} />

      {listResult === null ? (
        <ErrorState message="Không thể tải danh sách câu hỏi." />
      ) : listResult.total === 0 ? (
        <EmptyState
          title="Chưa có câu hỏi nào."
          description="Bắt đầu xây dựng ngân hàng câu hỏi cho hệ thống."
          action={
            <Button render={<Link href="/admin/question-bank/new" />} nativeButton={false} size="sm">
              <Plus className="size-4" />
              Thêm câu hỏi
            </Button>
          }
        />
      ) : (
        <>
          <QuestionTable questions={listResult.questions} />
          <PaginationControls
            page={listResult.page}
            totalPages={listResult.totalPages}
            total={listResult.total}
            pageSize={listResult.pageSize}
          />
        </>
      )}
    </div>
  );
}
