import { NextRequest, NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth/guards";
import { extractDraft } from "@/server/services/questionAIExtractionService";
import { DraftAlreadyApprovedError, DraftNotFoundError } from "@/server/services/importDraftErrors";
import { AIExtractionError, AIProviderNotConfiguredError } from "@/server/services/ai";

type Params = { params: Promise<{ id: string; draftId: string }> };

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
    console.error("[POST /api/admin/question-imports/:id/extract/:draftId]", error);
    return NextResponse.json({ error: "Không thể phân tích bằng AI." }, { status: 500 });
  }
}
