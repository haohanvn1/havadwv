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

describe("Phase 4 — /admin root và các trang module placeholder", () => {
  it("GET /admin (chưa đăng nhập) → redirect /login", async () => {
    const res = await getNoRedirect("/admin");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("GET /admin (ADMIN) → redirect /admin/dashboard", async () => {
    const res = await getNoRedirect("/admin", adminCookie);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/admin/dashboard");
  });

  it("GET /admin (STUDENT) → không được vào, bounce khỏi khu vực admin", async () => {
    const res = await getNoRedirect("/admin", studentCookie);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).not.toContain("/admin");
  });

  // Đại diện cho 8 route module chưa implement — tất cả đi qua cùng một
  // AdminLayout nên chỉ cần kiểm tra 2 route là đủ chứng minh cơ chế áp
  // dụng chung, không cần lặp lại cho cả 8 route.
  for (const pathname of ["/admin/question-bank", "/admin/settings"]) {
    it(`GET ${pathname} (ADMIN) → 200, hiển thị placeholder`, async () => {
      const res = await getNoRedirect(pathname, adminCookie);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain("Module đang được phát triển.");
    });

    it(`GET ${pathname} (STUDENT) → bị chặn`, async () => {
      const res = await getNoRedirect(pathname, studentCookie);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).not.toContain(pathname);
    });

    it(`GET ${pathname} (chưa đăng nhập) → redirect /login`, async () => {
      const res = await getNoRedirect(pathname);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/login");
    });
  }
});

describe("Phase 4 — Dashboard đọc số liệu thật từ database", () => {
  it("Question count hiển thị trên dashboard khớp đúng COUNT thật trong DB", async () => {
    const realCount = await prisma.question.count();
    const res = await getNoRedirect("/admin/dashboard", adminCookie);
    expect(res.status).toBe(200);
    const html = await res.text();
    // Không so khớp bằng regex phức tạp — chỉ cần con số thật có xuất hiện
    // trong HTML là đủ bằng chứng dashboard không hard-code số liệu.
    expect(html).toContain(`>${realCount}<`);
  });
});

describe("Phase 5 — /student root và các trang module placeholder", () => {
  it("GET /student (chưa đăng nhập) → redirect /login", async () => {
    const res = await getNoRedirect("/student");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("GET /student (STUDENT) → redirect /student/dashboard", async () => {
    const res = await getNoRedirect("/student", studentCookie);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/student/dashboard");
  });

  it("GET /student (ADMIN) → không được vào, bounce khỏi khu vực student", async () => {
    const res = await getNoRedirect("/student", adminCookie);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).not.toContain("/student");
  });

  // Đại diện cho các route module chưa implement — tất cả đi qua cùng một
  // StudentLayout nên chỉ cần kiểm tra 2 route là đủ chứng minh cơ chế áp
  // dụng chung, không cần lặp lại cho cả 8 route.
  for (const pathname of ["/student/exams", "/student/video-lessons"]) {
    it(`GET ${pathname} (STUDENT) → 200, hiển thị placeholder`, async () => {
      const res = await getNoRedirect(pathname, studentCookie);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain("Chức năng đang được phát triển");
    });

    it(`GET ${pathname} (ADMIN) → bị chặn`, async () => {
      const res = await getNoRedirect(pathname, adminCookie);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).not.toContain(pathname);
    });

    it(`GET ${pathname} (chưa đăng nhập) → redirect /login`, async () => {
      const res = await getNoRedirect(pathname);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/login");
    });
  }

  it("GET /student/profile (STUDENT) → 200, hiển thị đúng hồ sơ của chính họ", async () => {
    const res = await getNoRedirect("/student/profile", studentCookie);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("student1");
  });
});

describe("Phase 5 — Student dashboard đọc dữ liệu thật từ database", () => {
  it("Dashboard hiển thị empty state thật khi student chưa có hoạt động, không bịa dữ liệu", async () => {
    const res = await getNoRedirect("/student/dashboard", studentCookie);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Bạn chưa làm đề nào.");
  });
});

describe("Token không hợp lệ", () => {
  it("cookie session là rác → xử lý như chưa đăng nhập, không lỗi 500", async () => {
    const res = await getNoRedirect("/admin/dashboard", "session=abc.def.ghi");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });
});
