import { NextRequest, NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth/guards";
import { studentPasswordResetSchema } from "@/validators/student";
import { resetStudentPassword, StudentNotFoundError } from "@/server/services/studentService";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireRoleApi("ADMIN");
  if (!auth.ok) return auth.response;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ." }, { status: 400 });
  }

  const validation = studentPasswordResetSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Dữ liệu không hợp lệ.", fieldErrors: { password: validation.error.issues[0]?.message ?? "Không hợp lệ." } },
      { status: 400 },
    );
  }

  try {
    await resetStudentPassword(id, validation.data.password);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof StudentNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("[POST /api/admin/students/:id/reset-password]", error);
    return NextResponse.json({ error: "Không thể đặt lại mật khẩu." }, { status: 500 });
  }
}
