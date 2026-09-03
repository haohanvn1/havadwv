import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth/guards";
import { BlueprintNotFoundError, setBlueprintStatus } from "@/server/services/blueprintService";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoleApi("ADMIN");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  try {
    const blueprint = await setBlueprintStatus(id, "ARCHIVED");
    return NextResponse.json({ blueprint });
  } catch (error) {
    if (error instanceof BlueprintNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("[POST /api/admin/exam-blueprints/:id/archive]", error);
    return NextResponse.json({ error: "Không thể lưu trữ Blueprint." }, { status: 500 });
  }
}
