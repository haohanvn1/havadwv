import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRoleApi } from "@/lib/auth/guards";
import { rejectDraft } from "@/server/services/questionImportApprovalService";
import { DraftAlreadyApprovedError, DraftNotFoundError } from "@/server/services/importDraftErrors";

type Params = { params: Promise<{ id: string; draftId: string }> };

const rejectSchema = z.object({ reason: z.string().trim().max(500).optional() });

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireRoleApi("ADMIN");
  if (!auth.ok) return auth.response;

  const { draftId } = await params;

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ." }, { status: 400 });
  }

  const parsed = rejectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  try {
    const draft = await rejectDraft(draftId, auth.user.id, { reason: parsed.data.reason ?? null });
    return NextResponse.json({ draft });
  } catch (error) {
    if (error instanceof DraftNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof DraftAlreadyApprovedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[POST /api/admin/question-imports/:id/drafts/:draftId/reject]", error);
    return NextResponse.json({ error: "Không thể từ chối câu hỏi." }, { status: 500 });
  }
}
