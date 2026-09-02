import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth/guards";
import {
  AttemptNotFoundError,
  AttemptNotSubmittedError,
  getAttemptResult,
} from "@/server/services/studentAttemptService";

export async function GET(_request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const auth = await requireRoleApi("STUDENT");
  if (!auth.ok) return auth.response;

  const { attemptId } = await params;
  try {
    const result = await getAttemptResult(auth.user.id, attemptId);
    return NextResponse.json({ result });
  } catch (error) {
    if (error instanceof AttemptNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof AttemptNotSubmittedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[GET /api/student/attempts/:attemptId/result]", error);
    return NextResponse.json({ error: "Không thể tải kết quả." }, { status: 500 });
  }
}
