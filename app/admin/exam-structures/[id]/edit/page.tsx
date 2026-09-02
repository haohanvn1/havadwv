import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { BlueprintForm } from "@/components/admin/exam-blueprints/blueprint-form";
import { getBlueprintDetail } from "@/server/services/blueprintService";
import { listSubjectsForForm } from "@/server/services/questionService";

export default async function EditBlueprintPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("ADMIN");
  const { id } = await params;

  const [blueprint, subjects] = await Promise.all([getBlueprintDetail(id), listSubjectsForForm()]);
  if (!blueprint) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Sửa Blueprint</h1>
        <p className="text-muted-foreground text-sm">{blueprint.name}</p>
      </div>
      <BlueprintForm
        mode="edit"
        blueprintId={blueprint.id}
        subjects={subjects}
        initialData={{
          name: blueprint.name,
          examType: blueprint.examType,
          subjectId: blueprint.subjectId,
          durationMinutes: blueprint.durationMinutes,
          sections: blueprint.sections.map((s) => ({
            name: s.name,
            rules: s.rules.map((r) => ({
              subjectId: r.subjectId,
              topicId: r.topicId,
              questionType: r.questionType,
              difficulty: r.difficulty,
              cognitiveLevel: r.cognitiveLevel,
              quantity: r.quantity,
            })),
          })),
        }}
      />
    </div>
  );
}
