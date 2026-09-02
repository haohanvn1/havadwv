import { NextRequest, NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth/guards";
import { z } from "zod";
import { validateStudentUpdate } from "@/validators/student";
import { UserStatus } from "@/lib/generated/prisma/enums";
import {
  deleteStudent,
  getStudentDetail,
  setStudentStatus,
  StudentConflictError,
  StudentNotFoundError,
  StudentValidationError,
  updateStudent,
} from "@/server/services/studentService";

const statusOnlySchema = z.object({ status: z.enum(Object.values(UserStatus) as [UserStatus, ...UserStatus[]]) }).strict();

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const auth = await requireRoleApi("ADMIN");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const student = await getStudentDetail(id);
  if (!student) {
    return NextResponse.json({ error: "Không tìm thấy học sinh." }, { status: 404 });
  }
  return NextResponse.json({ student });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireRoleApi("ADMIN");
  if (!auth.ok) return auth.response;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ." }, { status: 400 });
  }

  const statusOnly = statusOnlySchema.safeParse(body);
  if (statusOnly.success) {
    try {
      const student = await setStudentStatus(id, statusOnly.data.status);
      return NextResponse.json({ student });
    } catch (error) {
      if (error instanceof StudentNotFoundError) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      console.error("[PATCH /api/admin/students/:id status-only]", error);
      return NextResponse.json({ error: "Không thể cập nhật trạng thái." }, { status: 500 });
    }
  }

  const validation = validateStudentUpdate(body);
  if (!validation.success) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ.", fieldErrors: validation.errors }, {
      status: 400,
    });
  }

  try {
    const student = await updateStudent(id, validation.data);
    return NextResponse.json({ student });
  } catch (error) {
    if (error instanceof StudentNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof StudentValidationError) {
      return NextResponse.json(
        { error: error.message, fieldErrors: error.fieldErrors },
        { status: 400 },
      );
    }
    console.error("[PATCH /api/admin/students/:id]", error);
    return NextResponse.json({ error: "Không thể cập nhật học sinh." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const auth = await requireRoleApi("ADMIN");
  if (!auth.ok) return auth.response;

  const { id } = await params;

  try {
    await deleteStudent(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof StudentNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof StudentConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[DELETE /api/admin/students/:id]", error);
    return NextResponse.json({ error: "Không thể xoá học sinh." }, { status: 500 });
  }
}
