import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { EmptyState } from "@/components/ui/empty-state";
import { ExamNotAvailableError, listExamsForSubject } from "@/server/services/studentAttemptService";
import { ExamCard } from "@/components/student/exams/exam-card";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

export default async function ExamSetsBySubjectPage({
  params,
}: {
  params: Promise<{ subjectId: string }>;
}) {
  const user = await requireRole("STUDENT");
  const { subjectId } = await params;

  let exams;
  try {
    exams = await listExamsForSubject(user.id, subjectId);
  } catch (error) {
    if (error instanceof ExamNotAvailableError) notFound();
    throw error;
  }

  const subject = await prisma.subject.findUnique({ where: { id: subjectId }, select: { name: true } });
  if (!subject) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/student/exam-sets" className="text-muted-foreground text-xs hover:underline">
          ← Quay lại danh sách Bộ đề
        </Link>
        <h1 className="text-lg font-bold">Bộ đề {subject.name}</h1>
      </div>

      {exams.length === 0 ? (
        <EmptyState className="bg-card rounded-3xl" title="Bộ đề này chưa có đề thi nào." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {exams.map((exam) => (
            <ExamCard key={exam.id} exam={exam} showSubjectName={false} />
          ))}
        </div>
      )}
    </div>
  );
}
