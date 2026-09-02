import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth/guards";
import {
  AttemptNotFoundError,
  AttemptNotSubmittedError,
  getAttemptReview,
} from "@/server/services/studentAttemptService";

/**
 * Phase 9D — review chi tiết từng câu. Chỉ Student sở hữu Attempt, và chỉ
 * sau khi đã nộp bài (service tự chặn IN_PROGRESS) mới xem được đáp án đúng.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const auth = await requireRoleApi("STUDENT");
  if (!auth.ok) return auth.response;

  const { attemptId } = await params;
  try {
    const review = await getAttemptReview(auth.user.id, attemptId);
    return NextResponse.json({ review });
  } catch (error) {
    if (error instanceof AttemptNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof AttemptNotSubmittedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[GET /api/student/attempts/:attemptId/review]", error);
    return NextResponse.json({ error: "Không thể tải chi tiết bài làm." }, { status: 500 });
  }
}
