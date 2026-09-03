import { NextRequest, NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth/guards";
import { saveDraftReviewSchema } from "@/validators/importDraftReview";
import { saveDraftReview } from "@/server/services/questionImportReviewService";
import {
  DraftAlreadyApprovedError,
  DraftNotFoundError,
  DraftValidationError,
} from "@/server/services/importDraftErrors";

type Params = { params: Promise<{ id: string; draftId: string }> };

/** Lưu bản Admin đang chỉnh sửa (mục 24) — không bao giờ tạo Question ở đây. */
export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireRoleApi("ADMIN");
  if (!auth.ok) return auth.response;

  const { draftId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ." }, { status: 400 });
  }

  const parsed = saveDraftReviewSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "form";
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return NextResponse.json({ error: "Dữ liệu không hợp lệ.", fieldErrors }, { status: 400 });
  }

  try {
    const draft = await saveDraftReview(draftId, parsed.data);
    return NextResponse.json({ draft });
  } catch (error) {
    if (error instanceof DraftNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof DraftAlreadyApprovedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof DraftValidationError) {
      return NextResponse.json({ error: error.message, fieldErrors: error.fieldErrors }, { status: 400 });
    }
    console.error("[PATCH /api/admin/question-imports/:id/drafts/:draftId]", error);
    return NextResponse.json({ error: "Không thể lưu draft." }, { status: 500 });
  }
}
