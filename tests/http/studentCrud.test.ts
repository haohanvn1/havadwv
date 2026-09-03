import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { BASE_URL, startTestServer, stopTestServer } from "../support/server";
import { getAdminCookie, getStudentCookie } from "../support/tokens";
import { authenticate, LoginError } from "@/server/services/authService";

// Test CRUD tài khoản Student (admin quản lý). Chạy trên database dev thật,
// tự tạo/xoá học sinh test riêng (prefix "vitest-http-student-") — không đụng
// tới student1/student2 đã seed.

let adminCookie: string;
let studentCookie: string;
const createdUserIds: string[] = [];

function authedFetch(path: string, cookie: string, init: RequestInit = {}) {
  return fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { "content-type": "application/json", cookie, ...init.headers },
  });
}

function uniqueUsername() {
  return `vitest-http-student-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createPayload(overrides: Record<string, unknown> = {}) {
  return {
    username: uniqueUsername(),
    password: "matkhau123",
    fullName: "[vitest-http-student] Học sinh test",
    ...overrides,
  };
}

beforeAll(async () => {
  await startTestServer();
  adminCookie = await getAdminCookie();
  studentCookie = await getStudentCookie();
}, 70_000);

afterAll(async () => {
  if (createdUserIds.length > 0) {
    await prisma.attempt.deleteMany({ where: { studentId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
  stopTestServer();
  await prisma.$disconnect();
});

describe("POST /api/admin/students — tạo tài khoản", () => {
  it("tạo hợp lệ → 201, mật khẩu được hash (không trả về plaintext)", async () => {
    const res = await authedFetch("/api/admin/students", adminCookie, {
      method: "POST",
      body: JSON.stringify(createPayload()),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    createdUserIds.push(body.student.id);
    expect(body.student.status).toBe("ACTIVE");
    expect(body.student.password).toBeUndefined();
  });

  it("username trùng → 400 fieldErrors.username", async () => {
    const payload = createPayload();
    const first = await authedFetch("/api/admin/students", adminCookie, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    createdUserIds.push((await first.json()).student.id);

    const second = await authedFetch("/api/admin/students", adminCookie, {
      method: "POST",
      body: JSON.stringify(createPayload({ username: payload.username })),
    });
    expect(second.status).toBe(400);
    const body = await second.json();
    expect(body.fieldErrors?.username).toBeDefined();
  });

  it("mật khẩu ngắn hơn 8 ký tự → 400", async () => {
    const res = await authedFetch("/api/admin/students", adminCookie, {
      method: "POST",
      body: JSON.stringify(createPayload({ password: "123" })),
    });
    expect(res.status).toBe(400);
  });

  it("STUDENT không thể tạo tài khoản khác → 403", async () => {
    const res = await authedFetch("/api/admin/students", studentCookie, {
      method: "POST",
      body: JSON.stringify(createPayload()),
    });
    expect(res.status).toBe(403);
  });

  it("unauthenticated → 401", async () => {
    const res = await fetch(`${BASE_URL}/api/admin/students`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(createPayload()),
    });
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/admin/students/:id — sửa / đổi trạng thái", () => {
  it("sửa fullName/email → lưu đúng", async () => {
    const createRes = await authedFetch("/api/admin/students", adminCookie, {
      method: "POST",
      body: JSON.stringify(createPayload()),
    });
    const created = (await createRes.json()).student;
    createdUserIds.push(created.id);

    const patchRes = await authedFetch(`/api/admin/students/${created.id}`, adminCookie, {
      method: "PATCH",
      body: JSON.stringify({ fullName: "[vitest-http-student] Đã sửa tên", email: undefined }),
    });
    expect(patchRes.status).toBe(200);
    const updated = (await patchRes.json()).student;
    expect(updated.fullName).toBe("[vitest-http-student] Đã sửa tên");
  });

  it("khoá tài khoản (status=INACTIVE) rồi mở lại → thành công", async () => {
    const createRes = await authedFetch("/api/admin/students", adminCookie, {
      method: "POST",
      body: JSON.stringify(createPayload()),
    });
    const created = (await createRes.json()).student;
    createdUserIds.push(created.id);

    const lockRes = await authedFetch(`/api/admin/students/${created.id}`, adminCookie, {
      method: "PATCH",
      body: JSON.stringify({ status: "INACTIVE" }),
    });
    expect(lockRes.status).toBe(200);
    expect((await lockRes.json()).student.status).toBe("INACTIVE");

    const unlockRes = await authedFetch(`/api/admin/students/${created.id}`, adminCookie, {
      method: "PATCH",
      body: JSON.stringify({ status: "ACTIVE" }),
    });
    expect((await unlockRes.json()).student.status).toBe("ACTIVE");
  });

  it("học sinh bị khoá (INACTIVE) không đăng nhập được", async () => {
    const payload = createPayload();
    const createRes = await authedFetch("/api/admin/students", adminCookie, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const created = (await createRes.json()).student;
    createdUserIds.push(created.id);

    await authedFetch(`/api/admin/students/${created.id}`, adminCookie, {
      method: "PATCH",
      body: JSON.stringify({ status: "INACTIVE" }),
    });

    await expect(authenticate(payload.username, payload.password)).rejects.toBeInstanceOf(LoginError);
  });

  it("id không tồn tại → 404", async () => {
    const res = await authedFetch(`/api/admin/students/00000000-0000-0000-0000-000000000000`, adminCookie, {
      method: "PATCH",
      body: JSON.stringify({ fullName: "x" }),
    });
    expect(res.status).toBe(404);
  });

  it("STUDENT không thể sửa → 403", async () => {
    const createRes = await authedFetch("/api/admin/students", adminCookie, {
      method: "POST",
      body: JSON.stringify(createPayload()),
    });
    const created = (await createRes.json()).student;
    createdUserIds.push(created.id);

    const res = await authedFetch(`/api/admin/students/${created.id}`, studentCookie, {
      method: "PATCH",
      body: JSON.stringify({ fullName: "x" }),
    });
    expect(res.status).toBe(403);
  });
});

describe("POST /api/admin/students/:id/reset-password", () => {
  it("đặt lại mật khẩu → đăng nhập được bằng mật khẩu mới, không đăng nhập được bằng mật khẩu cũ", async () => {
    const payload = createPayload();
    const createRes = await authedFetch("/api/admin/students", adminCookie, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const created = (await createRes.json()).student;
    createdUserIds.push(created.id);

    const resetRes = await authedFetch(`/api/admin/students/${created.id}/reset-password`, adminCookie, {
      method: "POST",
      body: JSON.stringify({ password: "matkhaumoi456" }),
    });
    expect(resetRes.status).toBe(200);

    await expect(authenticate(payload.username, payload.password)).rejects.toBeInstanceOf(LoginError);
    const authenticated = await authenticate(payload.username, "matkhaumoi456");
    expect(authenticated.id).toBe(created.id);
  });

  it("mật khẩu mới quá ngắn → 400", async () => {
    const createRes = await authedFetch("/api/admin/students", adminCookie, {
      method: "POST",
      body: JSON.stringify(createPayload()),
    });
    const created = (await createRes.json()).student;
    createdUserIds.push(created.id);

    const res = await authedFetch(`/api/admin/students/${created.id}/reset-password`, adminCookie, {
      method: "POST",
      body: JSON.stringify({ password: "123" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/admin/students/:id — xoá / bảo vệ referential integrity", () => {
  it("học sinh chưa có bài làm nào → xoá được (204)", async () => {
    const createRes = await authedFetch("/api/admin/students", adminCookie, {
      method: "POST",
      body: JSON.stringify(createPayload()),
    });
    const created = (await createRes.json()).student;

    const deleteRes = await authedFetch(`/api/admin/students/${created.id}`, adminCookie, {
      method: "DELETE",
    });
    expect(deleteRes.status).toBe(204);

    const getRes = await authedFetch(`/api/admin/students/${created.id}`, adminCookie);
    expect(getRes.status).toBe(404);
  });

  it("học sinh đã có Attempt → không cho xoá (409), vẫn khoá được", async () => {
    const createRes = await authedFetch("/api/admin/students", adminCookie, {
      method: "POST",
      body: JSON.stringify(createPayload()),
    });
    const created = (await createRes.json()).student;
    createdUserIds.push(created.id);

    await prisma.attempt.create({
      data: {
        studentId: created.id,
        mode: "PRACTICE",
        attemptNumber: 1,
        examSnapshot: {},
        status: "IN_PROGRESS",
      },
    });

    const deleteRes = await authedFetch(`/api/admin/students/${created.id}`, adminCookie, {
      method: "DELETE",
    });
    expect(deleteRes.status).toBe(409);

    const lockRes = await authedFetch(`/api/admin/students/${created.id}`, adminCookie, {
      method: "PATCH",
      body: JSON.stringify({ status: "INACTIVE" }),
    });
    expect(lockRes.status).toBe(200);
  });

  it("STUDENT không thể xoá → 403", async () => {
    const createRes = await authedFetch("/api/admin/students", adminCookie, {
      method: "POST",
      body: JSON.stringify(createPayload()),
    });
    const created = (await createRes.json()).student;
    createdUserIds.push(created.id);

    const res = await authedFetch(`/api/admin/students/${created.id}`, studentCookie, {
      method: "DELETE",
    });
    expect(res.status).toBe(403);
  });
});

describe("GET /api/admin/students — danh sách + tìm kiếm", () => {
  it("search theo tên khớp học sinh vừa tạo", async () => {
    const payload = createPayload({ fullName: "[vitest-http-student] Đặng Tìm Kiếm" });
    const createRes = await authedFetch("/api/admin/students", adminCookie, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const created = (await createRes.json()).student;
    createdUserIds.push(created.id);

    const res = await authedFetch(
      `/api/admin/students?search=${encodeURIComponent("Đặng Tìm Kiếm")}`,
      adminCookie,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.students.some((s: { id: string }) => s.id === created.id)).toBe(true);
  });

  it("unauthenticated → 401", async () => {
    const res = await fetch(`${BASE_URL}/api/admin/students`);
    expect(res.status).toBe(401);
  });
});
