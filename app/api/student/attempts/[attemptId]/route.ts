import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth/guards";
import { AttemptNotFoundError, getAttemptDetail } from "@/server/services/studentAttemptService";

export async function GET(_request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const auth = await requireRoleApi("STUDENT");
  if (!auth.ok) return auth.response;

  const { attemptId } = await params;
  try {
    const attempt = await getAttemptDetail(auth.user.id, attemptId);
    return NextResponse.json({ attempt });
  } catch (error) {
    if (error instanceof AttemptNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("[GET /api/student/attempts/:attemptId]", error);
    return NextResponse.json({ error: "Không thể tải bài làm." }, { status: 500 });
  }
}
