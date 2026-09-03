import { NextRequest, NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth/guards";
import {
  createImportJob,
  ImportValidationError,
  listImportJobs,
} from "@/server/services/questionImportService";

export async function GET() {
  const auth = await requireRoleApi("ADMIN");
  if (!auth.ok) return auth.response;

  const jobs = await listImportJobs();
  return NextResponse.json({ jobs });
}

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
    return NextResponse.json({ error: "Vui lòng chọn một tệp để tải lên." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const job = await createImportJob({
      originalFilename: file.name,
      mimeType: file.type,
      buffer,
      uploadedById: auth.user.id,
    });
    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    if (error instanceof ImportValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[POST /api/admin/question-imports]", error);
    return NextResponse.json({ error: "Không thể tải lên tệp." }, { status: 500 });
  }
}
