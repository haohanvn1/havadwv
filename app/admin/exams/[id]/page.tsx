import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { getExamDetail } from "@/server/services/examService";
import { ExamStatusBadge } from "@/components/admin/exams/badges";
import { PublishButton } from "@/components/admin/exams/publish-button";
import {
  DifficultyBadge,
  QuestionStatusBadge,
  QuestionTypeBadge,
} from "@/components/admin/question-bank/badges";

export default async function ExamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("ADMIN");
  const { id } = await params;

  const exam = await getExamDetail(id);
  if (!exam) notFound();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          href="/admin/exams"
          className="text-muted-foreground hover:text-foreground mb-2 inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-3.5" />
          Quay lại danh sách đề thi
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">{exam.title}</h1>
              <ExamStatusBadge status={exam.status} />
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              {exam.code} · {exam.examType} · {exam.subject?.name ?? "Nhiều môn"} · {exam.durationMinutes} phút ·{" "}
              {exam.questionCount} câu
              {exam.generatedFromBlueprint ? (
                <>
                  {" "}
                  · Sinh từ Blueprint:{" "}
                  <Link
                    href={`/admin/exam-structures/${exam.generatedFromBlueprint.id}`}
                    className="underline"
                  >
                    {exam.generatedFromBlueprint.name}
                  </Link>
                </>
              ) : null}
            </p>
          </div>
          {exam.status === "DRAFT" ? <PublishButton examId={exam.id} /> : null}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Danh sách câu hỏi ({exam.examQuestions.length})</h2>
        {exam.examQuestions.map((eq) => (
          <div key={eq.id} className="bg-card flex flex-col gap-2 rounded-xl border p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium">
                {eq.order}. {eq.question.content}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <QuestionTypeBadge type={eq.question.type} />
              <DifficultyBadge difficulty={eq.question.difficulty} />
              <QuestionStatusBadge status={eq.question.status} />
            </div>
            <p className="text-muted-foreground text-xs">
              {eq.question.subject.name} · {eq.question.topic.name}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
