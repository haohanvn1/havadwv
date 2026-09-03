import { NextRequest, NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth/guards";
import { parseRosterFile, RosterFileFormatError } from "@/server/services/studentRosterImportService";

export async function POST(request: NextRequest) {
  const auth = await requireRoleApi("ADMIN");
  if (!auth.ok) return auth.response;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Vui lòng chọn một tệp Excel để tải lên." }, { status: 400 });
  }

  let columnMappingOverrides: Record<string, string> = {};
  const rawMapping = formData.get("columnMappingOverrides");
  if (typeof rawMapping === "string" && rawMapping.length > 0) {
    try {
      columnMappingOverrides = JSON.parse(rawMapping);
    } catch {
      return NextResponse.json({ error: "columnMappingOverrides không hợp lệ." }, { status: 400 });
    }
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const preview = await parseRosterFile(buffer, columnMappingOverrides);
    return NextResponse.json({ preview });
  } catch (error) {
    if (error instanceof RosterFileFormatError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[POST /api/admin/students/import/preview]", error);
    return NextResponse.json({ error: "Không thể đọc file." }, { status: 500 });
  }
}
