import "server-only";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionCookie } from "./cookies";
import { verifySessionToken, type SessionRole } from "./session";

export type AuthUser = {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: SessionRole;
  status: "ACTIVE" | "INACTIVE";
  lastLoginAt: Date | null;
  createdAt: Date;
};

function toAuthUser(user: {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: SessionRole;
  status: "ACTIVE" | "INACTIVE";
  lastLoginAt: Date | null;
  createdAt: Date;
}): AuthUser {
  // Chỉ chọn field an toàn — không bao giờ để passwordHash lọt ra khỏi đây.
  const { id, username, fullName, email, phone, role, status, lastLoginAt, createdAt } = user;
  return { id, username, fullName, email, phone, role, status, lastLoginAt, createdAt };
}

/**
 * Đọc session hiện tại + xác nhận lại status từ DB (không chỉ tin JWT) —
 * đây là lớp chặn tài khoản INACTIVE thật sự, vì JWT là stateless và không
 * tự biết được nếu admin vừa khoá tài khoản sau khi token đã phát hành.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = await getSessionCookie();
  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || user.status !== "ACTIVE") return null;

  return toAuthUser(user);
}

// ---------- Dùng trong Server Component / Page / Layout ----------

export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(role: SessionRole): Promise<AuthUser> {
  const user = await requireAuth();
  if (user.role !== role) {
    redirect(user.role === "ADMIN" ? "/admin/dashboard" : "/student/dashboard");
  }
  return user;
}

// ---------- Dùng trong Route Handler (API) ----------
// Tách riêng vì API cần trả 401/403 kèm JSON, không phải redirect như trang.

type ApiAuthResult = { ok: true; user: AuthUser } | { ok: false; response: NextResponse };

export async function requireAuthApi(): Promise<ApiAuthResult> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 }),
    };
  }
  return { ok: true, user };
}

export async function requireRoleApi(role: SessionRole): Promise<ApiAuthResult> {
  const result = await requireAuthApi();
  if (!result.ok) return result;

  if (result.user.role !== role) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Không có quyền truy cập." }, { status: 403 }),
    };
  }
  return result;
}
