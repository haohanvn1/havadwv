import { NextRequest, NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth/guards";
import {
  ImportNotFoundError,
  ImportRetryBlockedError,
  retryImportJob,
} from "@/server/services/questionImportService";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: Params) {
  const auth = await requireRoleApi("ADMIN");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  try {
    const job = await retryImportJob(id);
    return NextResponse.json({ job });
  } catch (error) {
    if (error instanceof ImportNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ImportRetryBlockedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[POST /api/admin/question-imports/:id/retry]", error);
    return NextResponse.json({ error: "Không thể xử lý lại import." }, { status: 500 });
  }
}
