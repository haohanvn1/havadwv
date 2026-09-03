import { NextRequest, NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth/guards";
import { extractAllDraftsForJob } from "@/server/services/questionAIExtractionService";
import { ImportNotFoundError } from "@/server/services/questionImportService";
import { AIProviderNotConfiguredError } from "@/server/services/ai";

type Params = { params: Promise<{ id: string }> };

/** Phân tích AI cho TẤT CẢ draft chưa duyệt trong job — Admin chủ động bấm, không tự chạy khi upload (mục 54, tránh tốn AI ngoài ý muốn). */
export async function POST(_request: NextRequest, { params }: Params) {
  const auth = await requireRoleApi("ADMIN");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  try {
    const results = await extractAllDraftsForJob(id);
    const succeeded = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;
    return NextResponse.json({ results, succeeded, failed });
  } catch (error) {
    if (error instanceof ImportNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof AIProviderNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("[POST /api/admin/question-imports/:id/extract]", error);
    return NextResponse.json({ error: "Không thể phân tích bằng AI." }, { status: 500 });
  }
}
