import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getAccessibleSubjects } from "@/server/services/subjectAccessService";
import { getActivePracticeAttempt } from "@/server/services/practiceAttemptService";
import { PracticeConfigForm } from "@/components/student/practice/practice-config-form";

export default async function StudentPracticePage() {
  const user = await requireRole("STUDENT");

  const [subjects, active] = await Promise.all([
    getAccessibleSubjects(user.id),
    getActivePracticeAttempt(user.id),
  ]);

  if (active) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-lg font-bold">Ôn tập</h1>
          <p className="text-muted-foreground text-sm">Tự chọn điều kiện, luyện tập không giới hạn thời gian.</p>
        </div>
        <Alert className="bg-card">
          <AlertTitle>Bạn đang có một bài luyện tập dở dang</AlertTitle>
          <AlertDescription>
            {active.title} — Đã trả lời {active.answeredCount}/{active.totalQuestions} câu. Hoàn thành hoặc nộp bài
            này trước khi bắt đầu bài luyện tập mới.
          </AlertDescription>
        </Alert>
        <Button className="w-fit" render={<Link href={`/student/attempts/${active.id}`} />} nativeButton={false}>
          Tiếp tục luyện tập
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-bold">Ôn tập</h1>
        <p className="text-muted-foreground text-sm">Tự chọn điều kiện, luyện tập không giới hạn thời gian.</p>
      </div>
      <PracticeConfigForm subjects={subjects} />
    </div>
  );
}
