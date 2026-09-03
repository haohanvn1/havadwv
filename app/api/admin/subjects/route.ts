import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth/guards";
import { listSubjectsForForm } from "@/server/services/questionService";

export async function GET() {
  const auth = await requireRoleApi("ADMIN");
  if (!auth.ok) return auth.response;

  const subjects = await listSubjectsForForm();
  return NextResponse.json({ subjects });
}
