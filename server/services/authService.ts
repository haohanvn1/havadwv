import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import type { User } from "@/lib/generated/prisma/client";

const BCRYPT_COST = 10;

const GENERIC_LOGIN_ERROR = "Tài khoản hoặc mật khẩu không chính xác.";

// Hash giả, không tương ứng mật khẩu thật nào — dùng để bcrypt.compare vẫn
// chạy ngay cả khi không tìm thấy user, để thời gian phản hồi giữa "sai mật
// khẩu" và "tài khoản không tồn tại" không lệch nhau (chống dò username).
const DUMMY_PASSWORD_HASH = "$2b$10$rE6HLidVIVcywCE0Bm9Qi.OJXVNlQsW/voRinLhPgWP8KxHaTm2oO";

export class LoginError extends Error {}

/**
 * Xác thực username/email + password. Luôn ném cùng một LoginError chung
 * chung cho mọi lý do thất bại (không tìm thấy user, sai mật khẩu, tài
 * khoản không ACTIVE) — không được để lộ lý do cụ thể qua thông báo lỗi.
 */
export async function authenticate(identifier: string, password: string): Promise<User> {
  const user = await prisma.user.findFirst({
    where: { OR: [{ username: identifier }, { email: identifier }] },
  });

  const passwordMatches = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);

  if (!user || !passwordMatches || user.status !== "ACTIVE") {
    throw new LoginError(GENERIC_LOGIN_ERROR);
  }

  return user;
}

/** Đổi mật khẩu của chính mình (đăng nhập lần đầu sau import Excel / Admin reset) — tắt luôn cờ mustChangePassword. */
export async function changeOwnPassword(userId: string, newPassword: string): Promise<void> {
  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: false },
  });
}
