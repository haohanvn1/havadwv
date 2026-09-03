import { describe, expect, it } from "vitest";
import { isNavItemActive, getAdminPageTitle, adminNavItems } from "@/lib/nav/admin-nav";

describe("isNavItemActive", () => {
  it("khớp chính xác pathname với href", () => {
    expect(isNavItemActive("/admin/dashboard", "/admin/dashboard")).toBe(true);
  });

  it("khớp route con (vd /admin/students/123 vẫn active cho Students)", () => {
    expect(isNavItemActive("/admin/students/123", "/admin/students")).toBe(true);
  });

  it("không khớp route không liên quan", () => {
    expect(isNavItemActive("/admin/exams", "/admin/students")).toBe(false);
  });

  it("không khớp nhầm khi href là tiền tố chuỗi ký tự (không phải path segment)", () => {
    // "/admin/exam" không được coi là active khi đang ở "/admin/exam-generator"
    expect(isNavItemActive("/admin/exam-generator", "/admin/exam")).toBe(false);
  });
});

describe("getAdminPageTitle", () => {
  it("trả về đúng label từ nav config", () => {
    expect(getAdminPageTitle("/admin/question-bank")).toBe("Question Bank");
    expect(getAdminPageTitle("/admin/live-classes")).toBe("Live Classes");
  });

  it("có override riêng cho các trang ngoài nav chính (vd Hồ sơ)", () => {
    expect(getAdminPageTitle("/admin/profile")).toBe("Hồ sơ");
  });

  it("trả về mặc định khi không khớp route nào", () => {
    expect(getAdminPageTitle("/admin/khong-ton-tai")).toBe("Admin");
  });

  it("mọi nav item đều có href bắt đầu bằng /admin", () => {
    for (const item of adminNavItems) {
      expect(item.href.startsWith("/admin")).toBe(true);
    }
  });
});
