import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { AvailableExamForStudent } from "@/server/services/studentAttemptService";
import { StartAttemptButton } from "./start-attempt-button";

/** Card hiển thị 1 Exam cho Student — dùng chung ở "Đề thi" (danh sách phẳng) và "Bộ đề" (theo môn), Phase 10. */
export function ExamCard({ exam, showSubjectName = true }: { exam: AvailableExamForStudent; showSubjectName?: boolean }) {
  return (
    <div className="bg-card border-border flex flex-col gap-2.5 rounded-3xl border p-4">
      <Badge className="bg-primary/10 text-primary w-fit border-transparent">{exam.examType}</Badge>
      <Link href={`/student/exams/${exam.id}`} className="text-sm font-semibold hover:underline">
        {showSubjectName && exam.subjectName ? `${exam.subjectName} — ${exam.title}` : exam.title}
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
  );
}
