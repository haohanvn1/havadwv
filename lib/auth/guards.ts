import "server-only";
import { cache } from "react";
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
  mustChangePassword: boolean;
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
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}): AuthUser {
  // Chỉ chọn field an toàn — không bao giờ để passwordHash lọt ra khỏi đây.
  const { id, username, fullName, email, phone, role, status, mustChangePassword, lastLoginAt, createdAt } = user;
  return { id, username, fullName, email, phone, role, status, mustChangePassword, lastLoginAt, createdAt };
}

/**
 * Đọc session hiện tại + xác nhận lại status từ DB (không chỉ tin JWT) —
 * đây là lớp chặn tài khoản INACTIVE thật sự, vì JWT là stateless và không
 * tự biết được nếu admin vừa khoá tài khoản sau khi token đã phát hành.
 *
 * Bọc bằng React `cache()` để layout và page trong cùng một request (vd
 * AdminLayout gọi requireRole rồi trang con cũng gọi lại để lấy `user`)
 * chỉ tốn đúng một lượt truy vấn DB, không phải hai — không cần truyền
 * user qua props hay tự dựng cơ chế cache riêng.
 */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const token = await getSessionCookie();
  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || user.status !== "ACTIVE") return null;

  return toAuthUser(user);
});

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
  // Tài khoản vừa được tạo/đặt lại mật khẩu hàng loạt (import Excel, Admin
  // reset mật khẩu) buộc phải tự đổi mật khẩu trước khi vào bất kỳ trang
  // nào khác — trang /change-password tự gọi requireAuth() (không phải
  // requireRole) nên không bị vướng vào chính điều kiện này.
  if (user.mustChangePassword) redirect("/change-password");
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
