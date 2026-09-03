import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth/guards";

export async function GET() {
  const auth = await requireRoleApi("ADMIN");
  if (!auth.ok) return auth.response;

  const { user } = auth;
  return NextResponse.json({
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    status: user.status,
  });
}
