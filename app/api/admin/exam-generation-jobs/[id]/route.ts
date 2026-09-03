import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth/guards";
import { getGenerationJobDetail } from "@/server/services/examGenerationService";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoleApi("ADMIN");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const job = await getGenerationJobDetail(id);
  if (!job) {
    return NextResponse.json({ error: "Không tìm thấy Generation Job." }, { status: 404 });
  }
  return NextResponse.json({ job });
}
