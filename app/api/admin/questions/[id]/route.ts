import { NextRequest, NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth/guards";
import { z } from "zod";
import { validateQuestionInput } from "@/validators/question";
import {
  deleteQuestion,
  getQuestionDetail,
  QuestionConflictError,
  QuestionNotFoundError,
  QuestionValidationError,
  setQuestionStatus,
  updateQuestion,
} from "@/server/services/questionService";

const statusOnlySchema = z.object({ status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]) }).strict();

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const auth = await requireRoleApi("ADMIN");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const question = await getQuestionDetail(id);
  if (!question) {
    return NextResponse.json({ error: "Không tìm thấy câu hỏi." }, { status: 404 });
  }
  return NextResponse.json({ question });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireRoleApi("ADMIN");
  if (!auth.ok) return auth.response;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ." }, { status: 400 });
  }

  const statusOnly = statusOnlySchema.safeParse(body);
  if (statusOnly.success) {
    try {
      const question = await setQuestionStatus(id, statusOnly.data.status);
      return NextResponse.json({ question });
    } catch (error) {
      if (error instanceof QuestionNotFoundError) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      console.error("[PATCH /api/admin/questions/:id status-only]", error);
      return NextResponse.json({ error: "Không thể cập nhật trạng thái." }, { status: 500 });
    }
  }

  const validation = validateQuestionInput(body);
  if (!validation.success) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ.", fieldErrors: validation.errors }, {
      status: 400,
    });
  }

  try {
    const question = await updateQuestion(id, validation.data);
    return NextResponse.json({ question });
  } catch (error) {
    if (error instanceof QuestionNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof QuestionValidationError) {
      return NextResponse.json(
        { error: error.message, fieldErrors: error.fieldErrors },
        { status: 400 },
      );
    }
    console.error("[PATCH /api/admin/questions/:id]", error);
    return NextResponse.json({ error: "Không thể cập nhật câu hỏi." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const auth = await requireRoleApi("ADMIN");
  if (!auth.ok) return auth.response;

  const { id } = await params;

  try {
    await deleteQuestion(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof QuestionNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof QuestionConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[DELETE /api/admin/questions/:id]", error);
    return NextResponse.json({ error: "Không thể xoá câu hỏi." }, { status: 500 });
  }
}
