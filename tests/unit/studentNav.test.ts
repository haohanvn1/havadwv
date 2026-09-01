import { describe, expect, it } from "vitest";
import {
  getStudentPageTitle,
  studentNavItems,
  studentPrimaryMobileItems,
} from "@/lib/nav/student-nav";

describe("getStudentPageTitle", () => {
  it("trả về đúng label từ nav config", () => {
    expect(getStudentPageTitle("/student/dashboard")).toBe("Dashboard");
    expect(getStudentPageTitle("/student/video-lessons")).toBe("Bài giảng");
  });

  it("khớp route con (vd /student/exam-history/123 vẫn active cho Lịch sử làm bài)", () => {
    expect(getStudentPageTitle("/student/exam-history/123")).toBe("Lịch sử làm bài");
  });

  it("trả về mặc định khi không khớp route nào", () => {
    expect(getStudentPageTitle("/student/khong-ton-tai")).toBe("Học sinh");
  });

  it("mọi nav item đều có href bắt đầu bằng /student", () => {
    for (const item of studentNavItems) {
      expect(item.href.startsWith("/student")).toBe(true);
    }
  });
});

describe("studentPrimaryMobileItems", () => {
  it("chỉ chứa đúng 5 mục cho bottom nav mobile", () => {
    expect(studentPrimaryMobileItems).toHaveLength(5);
  });

  it("mỗi mục đều có nhãn hiển thị hợp lệ (mobileLabel hoặc label)", () => {
    for (const item of studentPrimaryMobileItems) {
      expect((item.mobileLabel ?? item.label).length).toBeGreaterThan(0);
    }
  });

  it("Dashboard dùng mobileLabel riêng (Trang chủ) thay vì label gốc", () => {
    const dashboard = studentPrimaryMobileItems.find((i) => i.href === "/student/dashboard");
    expect(dashboard?.mobileLabel).toBe("Trang chủ");
  });
});
