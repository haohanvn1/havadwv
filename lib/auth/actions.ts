"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/validators/auth";
import { authenticate, LoginError } from "@/server/services/authService";
import { signSession } from "@/lib/auth/session";
import { setSessionCookie, clearSessionCookie } from "@/lib/auth/cookies";
import { checkRateLimit, resetRateLimit } from "@/lib/auth/rate-limit";
import { resolveSafeRedirectPath, getDefaultDashboardPath } from "@/lib/auth/redirect-target";

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

  const from = formData.get("from");
  const target = resolveSafeRedirectPath(from, user.role) ?? getDefaultDashboardPath(user.role);

  redirect(target);
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}
