import { describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { signSession, verifySessionToken } from "@/lib/auth/session";

describe("session JWT", () => {
  it("ký và xác thực round-trip đúng payload", async () => {
    const token = await signSession({
      sub: "user-123",
      role: "ADMIN",
      username: "admin",
    });

    const payload = await verifySessionToken(token);

    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe("user-123");
    expect(payload?.role).toBe("ADMIN");
    expect(payload?.username).toBe("admin");
  });

  it("từ chối token rác/không đúng định dạng", async () => {
    const payload = await verifySessionToken("khong-phai-jwt-hop-le");
    expect(payload).toBeNull();
  });

  it("từ chối token đã hết hạn", async () => {
    const secret = new TextEncoder().encode(process.env.SESSION_SECRET);
    const expiredToken = await new SignJWT({
      sub: "user-123",
      role: "STUDENT",
      username: "student1",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 120)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(secret);

    const payload = await verifySessionToken(expiredToken);
    expect(payload).toBeNull();
  });

  it("từ chối token ký bằng secret khác (chữ ký sai)", async () => {
    const wrongSecret = new TextEncoder().encode("mot-secret-khac-hoan-toan");
    const forgedToken = await new SignJWT({
      sub: "user-123",
      role: "ADMIN",
      username: "admin",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(wrongSecret);

    const payload = await verifySessionToken(forgedToken);
    expect(payload).toBeNull();
  });

  it("từ chối payload thiếu role hợp lệ", async () => {
    const secret = new TextEncoder().encode(process.env.SESSION_SECRET);
    const badToken = await new SignJWT({ sub: "user-123", role: "SUPERADMIN", username: "x" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(secret);

    const payload = await verifySessionToken(badToken);
    expect(payload).toBeNull();
  });
});
