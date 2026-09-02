import Link from "next/link";
import { Wand2 } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { BlueprintStatusBadge } from "@/components/admin/exam-blueprints/badges";
import { listBlueprints } from "@/server/services/blueprintService";

/**
 * Trang này chỉ là lối vào nhanh: chọn Blueprint rồi sang trang chi tiết
 * Blueprint (/admin/exam-structures/[id]) để Preview/Sinh đề — không lặp lại
 * UI Preview/Generate ở một nơi khác, tránh 2 chỗ cùng làm một việc.
 */
export default async function ExamGeneratorPage() {
  await requireRole("ADMIN");
  const blueprints = await listBlueprints();
  const usable = blueprints.filter((b) => b.status !== "ARCHIVED");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Sinh đề tự động</h1>
        <p className="text-muted-foreground text-sm">Chọn một Blueprint để xem trước và sinh đề.</p>
      </div>

      {usable.length === 0 ? (
        <EmptyState
          title="Chưa có Blueprint khả dụng."
          description="Tạo Blueprint ở mục Cấu trúc đề trước khi sinh đề tự động."
          action={
            <Button render={<Link href="/admin/exam-structures/new" />} nativeButton={false} size="sm">
              Tạo Blueprint
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {usable.map((b) => (
            <div key={b.id} className="bg-card flex items-center justify-between gap-3 rounded-xl border p-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{b.name}</p>
                  <BlueprintStatusBadge status={b.status} />
                </div>
                <p className="text-muted-foreground text-xs">
                  {b.examType} · {b.subject?.name ?? "Nhiều môn"} · {b.totalQuestions} câu
                </p>
              </div>
              <Button size="sm" render={<Link href={`/admin/exam-structures/${b.id}`} />} nativeButton={false}>
                <Wand2 className="size-3.5" />
                Sinh đề
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
