import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth/guards";
import { getExamDetail } from "@/server/services/examService";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoleApi("ADMIN");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const exam = await getExamDetail(id);
  if (!exam) {
    return NextResponse.json({ error: "Không tìm thấy đề thi." }, { status: 404 });
  }
  return NextResponse.json({ exam });
}
