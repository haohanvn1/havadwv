import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth/guards";
import {
  ExamNotAvailableError,
  ExamNotFoundError,
  MaxAttemptsReachedError,
  startOrResumeAttempt,
} from "@/server/services/studentAttemptService";

export async function POST(_request: Request, { params }: { params: Promise<{ examId: string }> }) {
  const auth = await requireRoleApi("STUDENT");
  if (!auth.ok) return auth.response;

  const { examId } = await params;

  try {
    const { attempt, resumed } = await startOrResumeAttempt(auth.user.id, examId);
    return NextResponse.json(
      {
        attemptId: attempt.id,
        status: attempt.status,
        attemptNumber: attempt.attemptNumber,
        resume: resumed,
      },
      { status: resumed ? 200 : 201 },
    );
  } catch (error) {
    if (error instanceof ExamNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ExamNotAvailableError) {
      // Đề DRAFT/ARCHIVED bị ẩn hoàn toàn khỏi Student — trả 404 như thể
      // không tồn tại, nhất quán với getExamAvailabilityForStudent (mục 5/37).
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof MaxAttemptsReachedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[POST /api/student/exams/:examId/attempts]", error);
    return NextResponse.json({ error: "Không thể bắt đầu làm bài." }, { status: 500 });
  }
}
