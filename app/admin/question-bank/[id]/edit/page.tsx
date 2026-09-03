import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { QuestionForm } from "@/components/admin/question-bank/question-form";
import { getQuestionDetail, listSubjectsForForm } from "@/server/services/questionService";

export default async function EditQuestionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("ADMIN");
  const { id } = await params;

  const [question, subjects] = await Promise.all([getQuestionDetail(id), listSubjectsForForm()]);
  if (!question) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Chỉnh sửa câu hỏi</h1>
        <p className="text-muted-foreground text-sm">
          {question.usedInExamCount > 0
            ? `Câu hỏi này đã được dùng trong ${question.usedInExamCount} đề thi — các đề đã tạo trước đó không bị ảnh hưởng khi sửa.`
            : "Câu hỏi này chưa được dùng trong đề nào."}
        </p>
      </div>
      <QuestionForm
        mode="edit"
        questionId={question.id}
        subjects={subjects}
        initialData={{
          content: question.content,
          type: question.type,
          subjectId: question.subjectId,
          topicId: question.topicId,
          difficulty: question.difficulty,
          cognitiveLevel: question.cognitiveLevel,
          hint: question.hint,
          explanation: question.explanation,
          source: question.source,
          year: question.year,
          tags: question.tags,
          status: question.status,
          correctAnswerText: question.correctAnswerText,
          options: question.options.map((o) => ({
            id: o.id,
            content: o.content,
            isCorrect: o.isCorrect,
          })),
        }}
      />
    </div>
  );
}
