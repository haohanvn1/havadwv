import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { requireRole } from "@/lib/auth/guards";
import { listAvailableExamsForStudent } from "@/server/services/studentAttemptService";
import { StartAttemptButton } from "@/components/student/exams/start-attempt-button";

export default async function StudentExamsPage() {
  const user = await requireRole("STUDENT");
  const exams = await listAvailableExamsForStudent(user.id);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-bold">Đề thi</h1>
        <p className="text-muted-foreground text-sm">Danh sách đề thi đã được publish, sẵn sàng để làm bài.</p>
      </div>

      {exams.length === 0 ? (
        <EmptyState className="bg-card rounded-3xl" title="Hiện chưa có đề thi nào." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {exams.map((exam) => (
            <div key={exam.id} className="bg-card border-border flex flex-col gap-2.5 rounded-3xl border p-4">
              <Badge className="bg-primary/10 text-primary w-fit border-transparent">{exam.examType}</Badge>
              <Link href={`/student/exams/${exam.id}`} className="text-sm font-semibold hover:underline">
                {exam.subjectName ? `${exam.subjectName} — ${exam.title}` : exam.title}
              </Link>
              <p className="text-muted-foreground text-xs">
                {exam.questionCount} câu · {exam.durationMinutes} phút ·{" "}
                {exam.maxAttempts != null
                  ? `Đã làm ${exam.attemptsUsed}/${exam.maxAttempts} lần`
                  : `Đã làm ${exam.attemptsUsed} lần · không giới hạn`}
              </p>
              <div className="mt-1">
                <StartAttemptButton
                  examId={exam.id}
                  hasActiveAttempt={Boolean(exam.activeAttemptId)}
                  activeAttemptId={exam.activeAttemptId}
                  canStart={exam.canStart}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
