import { describe, expect, it } from "vitest";
import { resolveSafeRedirectPath, getDefaultDashboardPath } from "@/lib/auth/redirect-target";

describe("resolveSafeRedirectPath", () => {
  it("chấp nhận đường dẫn nội bộ khớp đúng khu vực của role", () => {
    expect(resolveSafeRedirectPath("/admin/students", "ADMIN")).toBe("/admin/students");
    expect(resolveSafeRedirectPath("/student/profile", "STUDENT")).toBe("/student/profile");
  });

  it("từ chối đường dẫn thuộc khu vực khác role — đây là điểm đã sửa ở Phase 4", () => {
    // Student bị middleware đá về /login?from=/admin/... rồi đăng nhập đúng
    // tài khoản student — không được quay lại khu vực admin.
    expect(resolveSafeRedirectPath("/admin/dashboard", "STUDENT")).toBeNull();
    expect(resolveSafeRedirectPath("/student/dashboard", "ADMIN")).toBeNull();
  });

  it("từ chối open redirect ra ngoài domain", () => {
    expect(resolveSafeRedirectPath("//evil.com/phish", "ADMIN")).toBeNull();
    expect(resolveSafeRedirectPath("https://evil.com", "ADMIN")).toBeNull();
    expect(resolveSafeRedirectPath("/\\evil.com", "ADMIN")).toBeNull();
  });

  it("từ chối giá trị rỗng/null/không phải chuỗi", () => {
    expect(resolveSafeRedirectPath(null, "ADMIN")).toBeNull();
    expect(resolveSafeRedirectPath("", "ADMIN")).toBeNull();
  });
});

describe("getDefaultDashboardPath", () => {
  it("trả về đúng dashboard mặc định theo role", () => {
    expect(getDefaultDashboardPath("ADMIN")).toBe("/admin/dashboard");
    expect(getDefaultDashboardPath("STUDENT")).toBe("/student/dashboard");
  });
});
