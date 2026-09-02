import { requireRole } from "@/lib/auth/guards";
import { BlueprintForm } from "@/components/admin/exam-blueprints/blueprint-form";
import { listSubjectsForForm } from "@/server/services/questionService";

export default async function NewBlueprintPage() {
  await requireRole("ADMIN");
  const subjects = await listSubjectsForForm();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Tạo Blueprint</h1>
        <p className="text-muted-foreground text-sm">Định nghĩa Section và Rule để sinh đề tự động.</p>
      </div>
      <BlueprintForm mode="create" subjects={subjects} />
    </div>
  );
}
