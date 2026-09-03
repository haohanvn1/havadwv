import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth/guards";
import { listAvailableExamsForStudent } from "@/server/services/studentAttemptService";

export async function GET() {
  const auth = await requireRoleApi("STUDENT");
  if (!auth.ok) return auth.response;

  const exams = await listAvailableExamsForStudent(auth.user.id);
  return NextResponse.json({ exams });
}
