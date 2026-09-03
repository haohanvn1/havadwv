import Link from "next/link";
import { Plus } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { BlueprintTable } from "@/components/admin/exam-blueprints/blueprint-table";
import { listBlueprints } from "@/server/services/blueprintService";

export default async function ExamStructuresPage() {
  await requireRole("ADMIN");
  const blueprints = await listBlueprints();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Cấu trúc đề (Blueprint)</h1>
          <p className="text-muted-foreground text-sm">
            Định nghĩa cấu trúc Section/Rule dùng để tự động sinh đề thi.
          </p>
        </div>
        <Button render={<Link href="/admin/exam-structures/new" />} nativeButton={false}>
          <Plus className="size-4" />
          Tạo Blueprint
        </Button>
      </div>

      {blueprints.length === 0 ? (
        <EmptyState
          title="Chưa có Blueprint nào."
          description="Tạo Blueprint đầu tiên để bắt đầu sinh đề tự động."
          action={
            <Button render={<Link href="/admin/exam-structures/new" />} nativeButton={false} size="sm">
              <Plus className="size-4" />
              Tạo Blueprint
            </Button>
          }
        />
      ) : (
        <BlueprintTable blueprints={blueprints} />
      )}
    </div>
  );
}
