import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { getAvailableExams } from "@/server/services/studentDashboardService";

export async function AvailableExams({ studentId }: { studentId: string }) {
  let exams;
  try {
    exams = await getAvailableExams(studentId, 5);
  } catch {
    return (
      <div>
        <h2 className="mb-3 text-base font-bold">Đề thi dành cho bạn</h2>
        <ErrorState message="Không thể tải danh sách đề thi." />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold">Đề thi dành cho bạn</h2>
        {exams.length > 0 && (
          <Link href="/student/exams" className="text-primary text-xs font-semibold">
            Xem tất cả
          </Link>
        )}
      </div>

      {exams.length === 0 ? (
        <EmptyState className="bg-card rounded-3xl" title="Hiện chưa có đề thi." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {exams.map((exam) => (
            <div
              key={exam.id}
              className="bg-card border-border flex flex-col gap-2.5 rounded-3xl border p-4"
            >
              <Badge className="bg-primary/10 text-primary w-fit border-transparent">
                {exam.examType}
              </Badge>
              <p className="text-sm font-semibold">
                {exam.subjectName ? `${exam.subjectName} — ${exam.title}` : exam.title}
              </p>
              <p className="text-muted-foreground text-xs">
                {exam.questionCount} câu · {exam.durationMinutes} phút
                {exam.attemptsByStudent > 0 ? ` · Đã làm ${exam.attemptsByStudent} lần` : ""}
              </p>
              <div className="mt-1 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  className="flex-1 rounded-full"
                  render={<Link href="/student/exams/practice">Ôn tập</Link>}
                />
                <Button
                  size="sm"
                  nativeButton={false}
                  className="bg-accent2 text-accent2-foreground hover:bg-accent2/90 flex-1 rounded-full"
                  render={<Link href="/student/exams/mock">Thi thử</Link>}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
