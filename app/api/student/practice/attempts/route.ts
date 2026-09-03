import { NextRequest, NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth/guards";
import { validatePracticeStart } from "@/validators/practiceAttempt";
import {
  InvalidTopicError,
  NoEligibleQuestionsError,
  PracticeNotAvailableError,
  startPracticeAttempt,
} from "@/server/services/practiceAttemptService";

/**
 * Tạo (hoặc resume) một Practice Attempt ad-hoc — KHÔNG tạo Exam, KHÔNG tạo
 * ExamQuestion (mục Core Design Phase 11). Client chỉ được gửi đúng 5 field
 * điều kiện chọn câu — mọi thứ khác (studentId, mode, examId, snapshot,
 * questionIds, đáp án đúng) do server tự quyết định, validator `.strict()`
 * reject thẳng nếu client cố gửi thêm (mục 29).
 */
export async function POST(request: NextRequest) {
  const auth = await requireRoleApi("STUDENT");
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ." }, { status: 400 });
  }

  const validation = validatePracticeStart(body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const { attempt, resumed } = await startPracticeAttempt(auth.user.id, validation.data);
    return NextResponse.json({ attemptId: attempt.id, resumed }, { status: resumed ? 200 : 201 });
  } catch (error) {
    if (error instanceof PracticeNotAvailableError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof InvalidTopicError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof NoEligibleQuestionsError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error("[POST /api/student/practice/attempts]", error);
    return NextResponse.json({ error: "Không thể tạo bài luyện tập." }, { status: 500 });
  }
}
