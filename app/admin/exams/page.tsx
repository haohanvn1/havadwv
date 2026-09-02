import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExamStatusBadge } from "@/components/admin/exams/badges";
import { listExams } from "@/server/services/examService";

export default async function ExamsPage() {
  await requireRole("ADMIN");
  const exams = await listExams();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Đề thi</h1>
        <p className="text-muted-foreground text-sm">
          Đề được sinh tự động từ Blueprint (Cấu trúc đề) — xem lại và publish tại đây.
        </p>
      </div>

      {exams.length === 0 ? (
        <EmptyState
          title="Chưa có đề thi nào."
          description="Sinh đề từ một Blueprint ở mục Sinh đề tự động."
        />
      ) : (
        <>
          <div className="hidden rounded-xl border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tên đề</TableHead>
                  <TableHead>Mã đề</TableHead>
                  <TableHead>Môn học</TableHead>
                  <TableHead>Số câu</TableHead>
                  <TableHead>Sinh từ Blueprint</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Ngày tạo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exams.map((exam) => (
                  <TableRow key={exam.id}>
                    <TableCell>
                      <Link href={`/admin/exams/${exam.id}`} className="font-medium hover:underline">
                        {exam.title}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{exam.code}</TableCell>
                    <TableCell className="text-sm">{exam.subject?.name ?? "—"}</TableCell>
                    <TableCell className="text-sm">{exam.questionCount}</TableCell>
                    <TableCell className="text-sm">{exam.generatedFromBlueprint?.name ?? "—"}</TableCell>
                    <TableCell>
                      <ExamStatusBadge status={exam.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {new Intl.DateTimeFormat("vi-VN").format(exam.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 md:hidden">
            {exams.map((exam) => (
              <Link
                key={exam.id}
                href={`/admin/exams/${exam.id}`}
                className="bg-card flex flex-col gap-2 rounded-xl border p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{exam.title}</p>
                  <ExamStatusBadge status={exam.status} />
                </div>
                <p className="text-muted-foreground text-xs">
                  {exam.code} · {exam.questionCount} câu · {exam.generatedFromBlueprint?.name ?? "Tạo thủ công"}
                </p>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
