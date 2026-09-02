import { NextRequest, NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth/guards";
import { validateBlueprintInput } from "@/validators/examBlueprint";
import {
  BlueprintConflictError,
  BlueprintNotFoundError,
  BlueprintValidationError,
  deleteBlueprint,
  getBlueprintDetail,
  updateBlueprint,
} from "@/server/services/blueprintService";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const auth = await requireRoleApi("ADMIN");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const blueprint = await getBlueprintDetail(id);
  if (!blueprint) {
    return NextResponse.json({ error: "Không tìm thấy Blueprint." }, { status: 404 });
  }
  return NextResponse.json({ blueprint });
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

  const validation = validateBlueprintInput(body);
  if (!validation.success) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ.", fieldErrors: validation.errors }, { status: 400 });
  }

  try {
    const blueprint = await updateBlueprint(id, validation.data);
    return NextResponse.json({ blueprint });
  } catch (error) {
    if (error instanceof BlueprintNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof BlueprintConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof BlueprintValidationError) {
      return NextResponse.json({ error: error.message, fieldErrors: error.fieldErrors }, { status: 400 });
    }
    console.error("[PATCH /api/admin/exam-blueprints/:id]", error);
    return NextResponse.json({ error: "Không thể cập nhật Blueprint." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const auth = await requireRoleApi("ADMIN");
  if (!auth.ok) return auth.response;

  const { id } = await params;

  try {
    await deleteBlueprint(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof BlueprintNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof BlueprintConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[DELETE /api/admin/exam-blueprints/:id]", error);
    return NextResponse.json({ error: "Không thể xoá Blueprint." }, { status: 500 });
  }
}
