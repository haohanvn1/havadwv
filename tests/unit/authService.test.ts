import { afterAll, beforeAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authenticate, changeOwnPassword, LoginError } from "@/server/services/authService";

// Test này chạy trên database thật (Postgres dev), dùng lại user "admin" đã
// seed và tự tạo/xoá một user INACTIVE riêng — không đụng tới seed gốc.

const INACTIVE_USERNAME = "vitest_inactive_tmp";
const INACTIVE_PASSWORD = "Inactive@123";

beforeAll(async () => {
  await prisma.user.create({
    data: {
      username: INACTIVE_USERNAME,
      passwordHash: await bcrypt.hash(INACTIVE_PASSWORD, 10),
      role: "STUDENT",
      fullName: "Vitest Inactive",
      status: "INACTIVE",
    },
  });
});

afterAll(async () => {
  await prisma.user.delete({ where: { username: INACTIVE_USERNAME } }).catch(() => {});
  await prisma.$disconnect();
});

describe("authService.authenticate", () => {
  it("đăng nhập thành công với username/password đúng (seed admin)", async () => {
    const user = await authenticate("admin", "Admin@123");
    expect(user.username).toBe("admin");
    expect(user.role).toBe("ADMIN");
  });

  it("đăng nhập thành công bằng email thay vì username", async () => {
    const user = await authenticate("admin@havaedu.local", "Admin@123");
    expect(user.username).toBe("admin");
  });

  it("từ chối sai mật khẩu", async () => {
    await expect(authenticate("admin", "sai-mat-khau")).rejects.toBeInstanceOf(LoginError);
  });

  it("từ chối username không tồn tại", async () => {
    await expect(authenticate("khong_ton_tai_xyz", "gi-cung-duoc")).rejects.toBeInstanceOf(
      LoginError,
    );
  });

  it("từ chối user INACTIVE dù đúng mật khẩu", async () => {
    await expect(authenticate(INACTIVE_USERNAME, INACTIVE_PASSWORD)).rejects.toBeInstanceOf(
      LoginError,
    );
  });

  it("thông báo lỗi giống hệt nhau cho cả 3 trường hợp thất bại (không lộ thông tin)", async () => {
    const [wrongPassword, notFound, inactive] = await Promise.all([
      authenticate("admin", "sai-mat-khau").catch((e: LoginError) => e.message),
      authenticate("khong_ton_tai_xyz", "gi-cung-duoc").catch((e: LoginError) => e.message),
      authenticate(INACTIVE_USERNAME, INACTIVE_PASSWORD).catch((e: LoginError) => e.message),
    ]);

    expect(wrongPassword).toBe(notFound);
    expect(notFound).toBe(inactive);
  });
});

describe("authService.changeOwnPassword", () => {
  it("đổi mật khẩu thành công → đăng nhập được bằng mật khẩu mới, tắt cờ mustChangePassword", async () => {
    const user = await prisma.user.create({
      data: {
        username: `vitest_changepw_${Date.now()}`,
        passwordHash: await bcrypt.hash("MatKhauCu@123", 10),
        role: "STUDENT",
        fullName: "[vitest] Change Password",
        status: "ACTIVE",
        mustChangePassword: true,
      },
    });

    await changeOwnPassword(user.id, "MatKhauMoi@456");

    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(fresh.mustChangePassword).toBe(false);

    await expect(authenticate(user.username, "MatKhauCu@123")).rejects.toBeInstanceOf(LoginError);
    const authenticated = await authenticate(user.username, "MatKhauMoi@456");
    expect(authenticated.id).toBe(user.id);

    await prisma.user.delete({ where: { id: user.id } });
  });
});
