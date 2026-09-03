import { NextRequest, NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth/guards";
import { validatePracticeFilter } from "@/validators/practiceAttempt";
import {
  InvalidTopicError,
  PracticeNotAvailableError,
  previewPracticeAvailability,
} from "@/server/services/practiceAttemptService";

/** Xem trước số câu phù hợp — không tạo Attempt, không tăng usageCount (mục 16 Phase 11). */
export async function GET(request: NextRequest) {
  const auth = await requireRoleApi("STUDENT");
  if (!auth.ok) return auth.response;

  const params = request.nextUrl.searchParams;
  const raw = {
    subjectId: params.get("subjectId") ?? undefined,
    topicId: params.get("topicId") ?? undefined,
    difficulty: params.get("difficulty") ?? undefined,
    questionType: params.get("questionType") ?? undefined,
  };

  const validation = validatePracticeFilter(raw);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const preview = await previewPracticeAvailability(auth.user.id, validation.data);
    return NextResponse.json({ preview });
  } catch (error) {
    if (error instanceof PracticeNotAvailableError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof InvalidTopicError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[GET /api/student/practice/preview]", error);
    return NextResponse.json({ error: "Không thể xem trước." }, { status: 500 });
  }
}
