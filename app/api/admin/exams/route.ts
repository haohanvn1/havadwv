import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth/guards";
import { listExams } from "@/server/services/examService";

export async function GET() {
  const auth = await requireRoleApi("ADMIN");
  if (!auth.ok) return auth.response;

  const exams = await listExams();
  return NextResponse.json({ exams });
}
