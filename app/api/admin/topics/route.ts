import { NextRequest, NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth/guards";
import { listTopicsForSubject } from "@/server/services/questionService";

export async function GET(request: NextRequest) {
  const auth = await requireRoleApi("ADMIN");
  if (!auth.ok) return auth.response;

  const subjectId = request.nextUrl.searchParams.get("subjectId");
  if (!subjectId) {
    return NextResponse.json({ error: "Thiếu subjectId." }, { status: 400 });
  }

  const topics = await listTopicsForSubject(subjectId);
  return NextResponse.json({ topics });
}
