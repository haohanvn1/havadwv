import { SignJWT, jwtVerify, type JWTPayload } from "jose";

// Thuần jose — không import next/headers ở đây, vì file này phải chạy được
// cả ở Edge runtime (proxy.ts) lẫn Node runtime (Server Component/Action).

export const SESSION_COOKIE_NAME = "session";
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7; // 7 ngày

export type SessionRole = "ADMIN" | "STUDENT";

export interface SessionPayload extends JWTPayload {
  sub: string;
  role: SessionRole;
  username: string;
}

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET chưa được cấu hình — xem .env.example.");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(
  payload: Pick<SessionPayload, "sub" | "role" | "username">,
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());
}

/** Trả về null nếu token thiếu, sai chữ ký, hoặc đã hết hạn — không bao giờ throw. */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (
      typeof payload.sub !== "string" ||
      (payload.role !== "ADMIN" && payload.role !== "STUDENT") ||
      typeof payload.username !== "string"
    ) {
      return null;
    }
    return payload as SessionPayload;
  } catch {
    return null;
  }
}
