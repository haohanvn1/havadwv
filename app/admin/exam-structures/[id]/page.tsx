import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { getBlueprintDetail } from "@/server/services/blueprintService";
import { BlueprintStatusBadge } from "@/components/admin/exam-blueprints/badges";
import { BlueprintActions } from "@/components/admin/exam-blueprints/blueprint-actions";
import { PreviewGeneratePanel } from "@/components/admin/exam-blueprints/preview-generate-panel";
import { DIFFICULTY_LABELS, QUESTION_TYPE_LABELS } from "@/lib/constants/question-bank";

export default async function BlueprintDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("ADMIN");
  const { id } = await params;

  const blueprint = await getBlueprintDetail(id);
  if (!blueprint) notFound();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          href="/admin/exam-structures"
          className="text-muted-foreground hover:text-foreground mb-2 inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-3.5" />
          Quay lại danh sách Blueprint
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">{blueprint.name}</h1>
              <BlueprintStatusBadge status={blueprint.status} />
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              {blueprint.examType} · {blueprint.subject?.name ?? "Nhiều môn"} ·{" "}
              {blueprint.durationMinutes ? `${blueprint.durationMinutes} phút` : "Chưa có thời lượng"} ·{" "}
              {blueprint.totalQuestions} câu · {blueprint._count.exams} đề đã sinh
            </p>
          </div>
          <BlueprintActions id={blueprint.id} status={blueprint.status} />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Sections</h2>
        {blueprint.sections.map((section, index) => (
          <div key={section.id} className="bg-card flex flex-col gap-2 rounded-xl border p-4">
            <p className="text-sm font-medium">
              [{index + 1}] {section.name}{" "}
              <span className="text-muted-foreground font-normal">({section.questionCount} câu)</span>
            </p>
            <div className="flex flex-col gap-1">
              {section.rules.map((rule) => (
                <div key={rule.id} className="text-muted-foreground rounded-md border px-3 py-1.5 text-xs">
                  {[
                    rule.subject?.name ?? "Mọi môn",
                    rule.topic?.name ?? "Mọi chủ đề",
                    rule.difficulty ? DIFFICULTY_LABELS[rule.difficulty] : "Mọi độ khó",
                    rule.questionType ? QUESTION_TYPE_LABELS[rule.questionType] : "Mọi loại",
                  ].join(" | ")}{" "}
                  — {rule.quantity} câu
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <PreviewGeneratePanel blueprintId={blueprint.id} status={blueprint.status} />
    </div>
  );
}
