"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loginSchema, changePasswordSchema } from "@/validators/auth";
import { authenticate, changeOwnPassword, LoginError } from "@/server/services/authService";
import { signSession } from "@/lib/auth/session";
import { setSessionCookie, clearSessionCookie } from "@/lib/auth/cookies";
import { checkRateLimit, resetRateLimit } from "@/lib/auth/rate-limit";
import { resolveSafeRedirectPath, getDefaultDashboardPath } from "@/lib/auth/redirect-target";
import { requireAuth } from "@/lib/auth/guards";

export interface LoginFormState {
  error?: string;
}

export async function loginAction(
  _prevState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const parsed = loginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Vui lòng nhập đầy đủ thông tin." };
  }

  const { identifier, password } = parsed.data;

  const rateLimitKey = `login:${identifier.toLowerCase()}`;
  const rateLimit = checkRateLimit(rateLimitKey);
  if (!rateLimit.allowed) {
    return { error: "Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau ít phút." };
  }

  let user;
  try {
    user = await authenticate(identifier, password);
  } catch (error) {
    if (error instanceof LoginError) {
      return { error: error.message };
    }
    throw error;
  }

  resetRateLimit(rateLimitKey);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const token = await signSession({ sub: user.id, role: user.role, username: user.username });
  await setSessionCookie(token);

  if (user.mustChangePassword) {
    redirect("/change-password");
  }

  const from = formData.get("from");
  const target = resolveSafeRedirectPath(from, user.role) ?? getDefaultDashboardPath(user.role);

  redirect(target);
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}

export interface ChangePasswordFormState {
  error?: string;
}

/** Đổi mật khẩu lần đầu sau khi tài khoản được tạo hàng loạt (import Excel) hoặc Admin đặt lại mật khẩu (Phase 10). */
export async function changePasswordAction(
  _prevState: ChangePasswordFormState,
  formData: FormData,
): Promise<ChangePasswordFormState> {
  const user = await requireAuth();

  const parsed = changePasswordSchema.safeParse({
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }

  await changeOwnPassword(user.id, parsed.data.newPassword);

  redirect(getDefaultDashboardPath(user.role));
}
