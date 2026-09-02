import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth/guards";
import { BlueprintNotFoundError } from "@/server/services/blueprintService";
import { previewBlueprint } from "@/server/services/examGenerationService";

/** Preview chỉ đọc — không tạo Exam, không mutate Question/Blueprint (mục 22). */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoleApi("ADMIN");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  try {
    const preview = await previewBlueprint(id);
    return NextResponse.json({ preview });
  } catch (error) {
    if (error instanceof BlueprintNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("[POST /api/admin/exam-blueprints/:id/preview]", error);
    return NextResponse.json({ error: "Không thể xem trước Blueprint." }, { status: 500 });
  }
}
