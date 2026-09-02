import { NextRequest, NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth/guards";
import { validateStudentCreate } from "@/validators/student";
import { createStudent, listStudents, StudentValidationError } from "@/server/services/studentService";

export async function GET(request: NextRequest) {
  const auth = await requireRoleApi("ADMIN");
  if (!auth.ok) return auth.response;

  const search = request.nextUrl.searchParams.get("search") ?? undefined;
  const students = await listStudents(search);
  return NextResponse.json({ students });
}

export async function POST(request: NextRequest) {
  const auth = await requireRoleApi("ADMIN");
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ." }, { status: 400 });
  }

  const validation = validateStudentCreate(body);
  if (!validation.success) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ.", fieldErrors: validation.errors }, {
      status: 400,
    });
  }

  try {
    const student = await createStudent(validation.data);
    return NextResponse.json({ student }, { status: 201 });
  } catch (error) {
    if (error instanceof StudentValidationError) {
      return NextResponse.json(
        { error: error.message, fieldErrors: error.fieldErrors },
        { status: 400 },
      );
    }
    console.error("[POST /api/admin/students]", error);
    return NextResponse.json({ error: "Không thể tạo tài khoản học sinh." }, { status: 500 });
  }
}
