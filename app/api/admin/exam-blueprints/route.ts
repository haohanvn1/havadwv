import { NextRequest, NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth/guards";
import { validateBlueprintInput } from "@/validators/examBlueprint";
import { BlueprintValidationError, createBlueprint, listBlueprints } from "@/server/services/blueprintService";

export async function GET() {
  const auth = await requireRoleApi("ADMIN");
  if (!auth.ok) return auth.response;

  const blueprints = await listBlueprints();
  return NextResponse.json({ blueprints });
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

  const validation = validateBlueprintInput(body);
  if (!validation.success) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ.", fieldErrors: validation.errors }, { status: 400 });
  }

  try {
    const blueprint = await createBlueprint(validation.data, auth.user.id);
    return NextResponse.json({ blueprint }, { status: 201 });
  } catch (error) {
    if (error instanceof BlueprintValidationError) {
      return NextResponse.json({ error: error.message, fieldErrors: error.fieldErrors }, { status: 400 });
    }
    console.error("[POST /api/admin/exam-blueprints]", error);
    return NextResponse.json({ error: "Không thể tạo Blueprint." }, { status: 500 });
  }
}
