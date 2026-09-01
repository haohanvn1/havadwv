import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { BASE_URL, startTestServer, stopTestServer } from "../support/server";
import { getAdminCookie, getStudentCookie } from "../support/tokens";

let adminCookie: string;
let studentCookie: string;

beforeAll(async () => {
  await startTestServer();
  adminCookie = await getAdminCookie();
  studentCookie = await getStudentCookie();
}, 70_000);

afterAll(async () => {
  stopTestServer();
  await prisma.$disconnect();
});

async function getNoRedirect(pathname: string, cookie?: string) {
  return fetch(`${BASE_URL}${pathname}`, {
    redirect: "manual",
    headers: cookie ? { cookie } : undefined,
  });
}

describe("Route protection — chưa đăng nhập", () => {
  it("GET /admin/dashboard → redirect /login", async () => {
    const res = await getNoRedirect("/admin/dashboard");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("GET /student/dashboard → redirect /login", async () => {
    const res = await getNoRedirect("/student/dashboard");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("GET /api/admin/students → 401", async () => {
    const res = await getNoRedirect("/api/admin/students");
    expect(res.status).toBe(401);
  });

  it("GET /api/student/profile → 401", async () => {
    const res = await getNoRedirect("/api/student/profile");
    expect(res.status).toBe(401);
  });
});

describe("Route protection — RBAC", () => {
  it("ADMIN vào /admin/dashboard → 200", async () => {
    const res = await getNoRedirect("/admin/dashboard", adminCookie);
    expect(res.status).toBe(200);
  });

  it("STUDENT vào /admin/dashboard → bị chặn, không thấy nội dung admin", async () => {
    const res = await getNoRedirect("/admin/dashboard", studentCookie);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).not.toContain("/admin");
  });

  it("STUDENT vào /student/dashboard → 200", async () => {
    const res = await getNoRedirect("/student/dashboard", studentCookie);
    expect(res.status).toBe(200);
  });

  it("ADMIN vào /student/dashboard → bounce về /admin/dashboard (không phải trang lỗi chết)", async () => {
    const res = await getNoRedirect("/student/dashboard", adminCookie);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/admin/dashboard");
  });

  it("STUDENT gọi thẳng API admin (POST/GET) dù biết endpoint → 403", async () => {
    const res = await getNoRedirect("/api/admin/students", studentCookie);
    expect(res.status).toBe(403);
  });

  it("ADMIN gọi thẳng API student → 403", async () => {
    const res = await getNoRedirect("/api/student/profile", adminCookie);
    expect(res.status).toBe(403);
  });

  it("ADMIN gọi đúng API của mình → 200 + dữ liệu thật", async () => {
    const res = await getNoRedirect("/api/admin/students", adminCookie);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.students)).toBe(true);
    expect(body.students.length).toBeGreaterThan(0);
  });

  it("STUDENT gọi đúng API của mình → 200 + đúng hồ sơ của chính họ", async () => {
    const res = await getNoRedirect("/api/student/profile", studentCookie);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.username).toBe("student1");
  });
});

describe("Token không hợp lệ", () => {
  it("cookie session là rác → xử lý như chưa đăng nhập, không lỗi 500", async () => {
    const res = await getNoRedirect("/admin/dashboard", "session=abc.def.ghi");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });
});
