import { EmptyState } from "@/components/ui/empty-state";
import { requireRole } from "@/lib/auth/guards";
import { listAvailableExamsForStudent } from "@/server/services/studentAttemptService";
import { ExamCard } from "@/components/student/exams/exam-card";

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
            <ExamCard key={exam.id} exam={exam} />
          ))}
        </div>
      )}
    </div>
  );
}
