import { NextRequest, NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth/guards";
import { approveDraft } from "@/server/services/questionImportApprovalService";
import {
  DraftAlreadyApprovedError,
  DraftAlreadyRejectedError,
  DraftNotFoundError,
  DraftValidationError,
} from "@/server/services/importDraftErrors";

type Params = { params: Promise<{ id: string; draftId: string }> };

/**
 * Duy nhất endpoint được phép tạo Question thật (mục 40). authenticate +
 * authorize ADMIN qua requireRoleApi (mục 25 bước 1-2); toàn bộ validate +
 * transaction nằm trong service (mục 25 bước 3-12).
 */
export async function POST(_request: NextRequest, { params }: Params) {
  const auth = await requireRoleApi("ADMIN");
  if (!auth.ok) return auth.response;

  const { draftId } = await params;
  try {
    const result = await approveDraft(draftId, auth.user.id);
    return NextResponse.json(
      { question: result.question, alreadyApproved: result.alreadyApproved },
      { status: result.alreadyApproved ? 200 : 201 },
    );
  } catch (error) {
    if (error instanceof DraftNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof DraftAlreadyApprovedError || error instanceof DraftAlreadyRejectedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof DraftValidationError) {
      return NextResponse.json({ error: error.message, fieldErrors: error.fieldErrors }, { status: 400 });
    }
    console.error("[POST /api/admin/question-imports/:id/drafts/:draftId/approve]", error);
    return NextResponse.json({ error: "Không thể phê duyệt câu hỏi." }, { status: 500 });
  }
}
