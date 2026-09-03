import { NextRequest, NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth/guards";
import { parseQuestionListParams, validateQuestionInput } from "@/validators/question";
import { createQuestion, listQuestions, QuestionValidationError } from "@/server/services/questionService";

export async function GET(request: NextRequest) {
  const auth = await requireRoleApi("ADMIN");
  if (!auth.ok) return auth.response;

  const params = parseQuestionListParams(request.nextUrl.searchParams);
  const result = await listQuestions(params);
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const auth = await requireRoleApi("ADMIN");
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ." }, { status: 400 });
  }

  const validation = validateQuestionInput(body);
  if (!validation.success) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ.", fieldErrors: validation.errors }, {
      status: 400,
    });
  }

  try {
    const question = await createQuestion(validation.data, auth.user.id);
    return NextResponse.json({ question }, { status: 201 });
  } catch (error) {
    if (error instanceof QuestionValidationError) {
      return NextResponse.json(
        { error: error.message, fieldErrors: error.fieldErrors },
        { status: 400 },
      );
    }
    console.error("[POST /api/admin/questions]", error);
    return NextResponse.json({ error: "Không thể tạo câu hỏi." }, { status: 500 });
  }
}
