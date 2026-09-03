import { NextRequest, NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth/guards";
import { getImportJobDetail } from "@/server/services/questionImportService";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const auth = await requireRoleApi("ADMIN");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const job = await getImportJobDetail(id);
  if (!job) {
    return NextResponse.json({ error: "Không tìm thấy tiến trình import." }, { status: 404 });
  }
  return NextResponse.json({ job });
}
