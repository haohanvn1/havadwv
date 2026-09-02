import { NextRequest, NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth/guards";
import {
  AnswerValidationError,
  AttemptClosedError,
  AttemptNotFoundError,
  QuestionNotInAttemptError,
  saveAnswer,
} from "@/server/services/studentAttemptService";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string; questionId: string }> },
) {
  const auth = await requireRoleApi("STUDENT");
  if (!auth.ok) return auth.response;

  const { attemptId, questionId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ." }, { status: 400 });
  }

  try {
    const answer = await saveAnswer(auth.user.id, attemptId, questionId, body);
    return NextResponse.json({
      questionId,
      selectedOptionIds: answer.selectedOptionIds,
      answerText: answer.answerText,
      answered: Boolean(answer.answeredAt),
    });
  } catch (error) {
    if (error instanceof AttemptNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof AttemptClosedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof QuestionNotInAttemptError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (error instanceof AnswerValidationError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error("[PATCH /api/student/attempts/:attemptId/answers/:questionId]", error);
    return NextResponse.json({ error: "Không thể lưu câu trả lời." }, { status: 500 });
  }
}
