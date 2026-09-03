import { requireRole } from "@/lib/auth/guards";
import { QuestionForm } from "@/components/admin/question-bank/question-form";
import { listSubjectsForForm } from "@/server/services/questionService";

export default async function NewQuestionPage() {
  await requireRole("ADMIN");
  const subjects = await listSubjectsForForm();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Thêm câu hỏi</h1>
        <p className="text-muted-foreground text-sm">Tạo một câu hỏi mới cho ngân hàng câu hỏi.</p>
      </div>
      <QuestionForm mode="create" subjects={subjects} />
    </div>
  );
}
