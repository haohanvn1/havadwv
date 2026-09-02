import { NextRequest, NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth/guards";
import { extractDraft } from "@/server/services/questionAIExtractionService";
import { DraftAlreadyApprovedError, DraftNotFoundError } from "@/server/services/importDraftErrors";
import { AIExtractionError, AIProviderNotConfiguredError } from "@/server/services/ai";

type Params = { params: Promise<{ id: string; draftId: string }> };

/**
 * "Phân tích lại" — về bản chất gọi lại đúng thao tác extractDraft (idempotent,
 * luôn ghi đè aiExtraction/review bằng kết quả mới nhất) — tách route riêng
 * theo đúng danh sách API mục 30 để phản ánh rõ ý định người dùng (chạy lại,
 * không phải chạy lần đầu), không phải một luồng logic khác.
 */
export async function POST(_request: NextRequest, { params }: Params) {
  const auth = await requireRoleApi("ADMIN");
  if (!auth.ok) return auth.response;

  const { draftId } = await params;
  try {
    const draft = await extractDraft(draftId);
    return NextResponse.json({ draft });
  } catch (error) {
    if (error instanceof DraftNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof DraftAlreadyApprovedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof AIProviderNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    if (error instanceof AIExtractionError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    console.error("[POST /api/admin/question-imports/:id/drafts/:draftId/regenerate]", error);
    return NextResponse.json({ error: "Không thể phân tích lại." }, { status: 500 });
  }
}
