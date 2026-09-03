import { NextRequest, NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth/guards";
import { hasSubjectAccess } from "@/server/services/subjectAccessService";
import { listTopicsForSubject } from "@/server/services/questionService";

/** Danh sách Topic theo Subject cho Practice config — chỉ trả về nếu Student có quyền vào Subject đó (mục 5/6 Phase 11). */
export async function GET(request: NextRequest) {
  const auth = await requireRoleApi("STUDENT");
  if (!auth.ok) return auth.response;

  const subjectId = request.nextUrl.searchParams.get("subjectId");
  if (!subjectId) {
    return NextResponse.json({ error: "Thiếu subjectId." }, { status: 400 });
  }

  const allowed = await hasSubjectAccess(auth.user.id, subjectId);
  if (!allowed) {
    return NextResponse.json({ error: "Không có quyền truy cập môn học này." }, { status: 404 });
  }

  const topics = await listTopicsForSubject(subjectId);
  return NextResponse.json({ topics });
}
