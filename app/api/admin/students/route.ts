import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth/guards";
import { listStudents } from "@/server/services/studentService";

export async function GET() {
  const auth = await requireRoleApi("ADMIN");
  if (!auth.ok) return auth.response;

  const students = await listStudents();
  return NextResponse.json({ students });
}
