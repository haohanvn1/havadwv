import { NextRequest, NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth/guards";
import { ImportNotFoundError, listDraftsForJob } from "@/server/services/questionImportService";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const auth = await requireRoleApi("ADMIN");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  try {
    const drafts = await listDraftsForJob(id);
    return NextResponse.json({ drafts });
  } catch (error) {
    if (error instanceof ImportNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("[GET /api/admin/question-imports/:id/drafts]", error);
    return NextResponse.json({ error: "Không thể tải danh sách draft." }, { status: 500 });
  }
}
