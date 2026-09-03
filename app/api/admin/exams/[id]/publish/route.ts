import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth/guards";
import { ExamNotFoundError, ExamPublishError, publishExam } from "@/server/services/examService";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoleApi("ADMIN");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  try {
    const exam = await publishExam(id);
    return NextResponse.json({ exam });
  } catch (error) {
    if (error instanceof ExamNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ExamPublishError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[POST /api/admin/exams/:id/publish]", error);
    return NextResponse.json({ error: "Không thể publish đề thi." }, { status: 500 });
  }
}
