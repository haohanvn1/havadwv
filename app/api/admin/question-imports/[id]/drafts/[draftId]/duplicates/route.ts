import { NextRequest, NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth/guards";
import { checkDuplicateForDraft } from "@/server/services/questionImportApprovalService";
import { DraftNotFoundError } from "@/server/services/importDraftErrors";

type Params = { params: Promise<{ id: string; draftId: string }> };

/** Gọi trước khi Admin bấm Approve để cảnh báo khả năng trùng lặp (mục 29) — không chặn approve, chỉ cảnh báo. */
export async function GET(_request: NextRequest, { params }: Params) {
  const auth = await requireRoleApi("ADMIN");
  if (!auth.ok) return auth.response;

  const { draftId } = await params;
  try {
    const matches = await checkDuplicateForDraft(draftId);
    return NextResponse.json({ matches });
  } catch (error) {
    if (error instanceof DraftNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("[GET .../duplicates]", error);
    return NextResponse.json({ error: "Không thể kiểm tra trùng lặp." }, { status: 500 });
  }
}
