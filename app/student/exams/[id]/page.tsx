import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CircleCheck, Clock, FileText, ListChecks, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { requireRole } from "@/lib/auth/guards";
import { getExamAvailabilityForStudent } from "@/server/services/studentAttemptService";
import { StartAttemptButton } from "@/components/student/exams/start-attempt-button";

export default async function StudentExamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("STUDENT");
  const { id } = await params;

  const exam = await getExamAvailabilityForStudent(user.id, id);
  if (!exam) notFound();

  const hasActiveAttempt = Boolean(exam.activeAttemptId);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <Link
        href="/student/exams"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-3.5" />
        Quay lại danh sách đề thi
      </Link>

      <div className="bg-card border-border flex flex-col gap-4 rounded-3xl border p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-primary/10 text-primary border-transparent">{exam.examType}</Badge>
          <Badge variant="outline" className="gap-1">
            <CircleCheck className="size-3" />
            Đã publish
          </Badge>
        </div>

        <h1 className="text-xl font-bold">{exam.subjectName ? `${exam.subjectName} — ${exam.title}` : exam.title}</h1>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <InfoStat icon={FileText} label="Số câu" value={`${exam.questionCount} câu`} />
          <InfoStat icon={Clock} label="Thời gian" value={`${exam.durationMinutes} phút`} />
          <InfoStat
            icon={RotateCcw}
            label="Số lần làm bài"
            value={exam.maxAttempts != null ? `${exam.attemptsUsed}/${exam.maxAttempts}` : `${exam.attemptsUsed} (không giới hạn)`}
          />
        </div>

        <Separator />

        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <ListChecks className="size-4" />
            Lưu ý trước khi làm bài
          </p>
          <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
            <li>Thời gian làm bài được tính từ lúc bạn bấm &quot;Bắt đầu làm bài&quot;, không phụ thuộc đồng hồ máy của bạn.</li>
            <li>Câu trả lời được tự động lưu khi bạn chọn/nhập — bạn có thể rời trang và quay lại làm tiếp.</li>
            <li>Sau khi nộp bài, bạn sẽ không thể sửa lại câu trả lời.</li>
            <li>Nếu hết thời gian, bài làm sẽ tự động được nộp.</li>
          </ul>
        </div>

        <div className="pt-1">
          <StartAttemptButton
            examId={exam.id}
            hasActiveAttempt={hasActiveAttempt}
            activeAttemptId={exam.activeAttemptId}
            canStart={exam.canStart}
          />
        </div>
      </div>
    </div>
  );
}

function InfoStat({ icon: Icon, label, value }: { icon: typeof FileText; label: string; value: string }) {
  return (
    <div className="border-border bg-background flex items-center gap-2.5 rounded-2xl border p-3">
      <div className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-xl">
        <Icon className="size-4" />
      </div>
      <div>
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}
