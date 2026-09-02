import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth/guards";
import { AttemptClosedError, AttemptNotFoundError, submitAttempt } from "@/server/services/studentAttemptService";

export async function POST(_request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const auth = await requireRoleApi("STUDENT");
  if (!auth.ok) return auth.response;

  const { attemptId } = await params;
  try {
    const attempt = await submitAttempt(auth.user.id, attemptId);
    return NextResponse.json({
      attemptId: attempt.id,
      status: attempt.status,
      submittedAt: attempt.submittedAt,
    });
  } catch (error) {
    if (error instanceof AttemptNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof AttemptClosedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[POST /api/student/attempts/:attemptId/submit]", error);
    return NextResponse.json({ error: "Không thể nộp bài." }, { status: 500 });
  }
}
