import { describe, expect, it } from "vitest";
import { validateStudentCreate, validateStudentUpdate } from "@/validators/student";

function baseCreate(overrides: Record<string, unknown> = {}) {
  return {
    username: "hs.nguyenvana",
    fullName: "Nguyễn Văn A",
    password: "matkhau123",
    ...overrides,
  };
}

describe("validateStudentCreate", () => {
  it("hợp lệ → success, chuẩn hoá email/phone rỗng thành undefined", () => {
    const result = validateStudentCreate(baseCreate({ email: "", phone: "" }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBeUndefined();
      expect(result.data.phone).toBeUndefined();
    }
  });

  it("thiếu username → thông báo thân thiện", () => {
    const result = validateStudentCreate(baseCreate({ username: undefined }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.username).toBe("Vui lòng nhập tên đăng nhập.");
    }
  });

  it("username có ký tự hoa/khoảng trắng → lỗi định dạng", () => {
    const result = validateStudentCreate(baseCreate({ username: "Học Sinh A" }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.username).toMatch(/chữ thường/);
    }
  });

  it("username quá ngắn → lỗi", () => {
    const result = validateStudentCreate(baseCreate({ username: "ab" }));
    expect(result.success).toBe(false);
  });

  it("mật khẩu dưới 8 ký tự → lỗi", () => {
    const result = validateStudentCreate(baseCreate({ password: "1234567" }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.password).toBe("Mật khẩu phải có ít nhất 8 ký tự.");
    }
  });

  it("email không hợp lệ → lỗi rõ ràng", () => {
    const result = validateStudentCreate(baseCreate({ email: "khong-hop-le" }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.email).toBe("Email không hợp lệ.");
    }
  });

  it("thiếu họ tên → thông báo thân thiện", () => {
    const result = validateStudentCreate(baseCreate({ fullName: "" }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.fullName).toBe("Vui lòng nhập họ tên.");
    }
  });
});

describe("validateStudentUpdate", () => {
  it("hợp lệ, không có username/password trong schema", () => {
    const result = validateStudentUpdate({ fullName: "Nguyễn Văn B", email: "", phone: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect("username" in result.data).toBe(false);
      expect("password" in result.data).toBe(false);
    }
  });

  it("thiếu họ tên → lỗi", () => {
    const result = validateStudentUpdate({ fullName: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.fullName).toBe("Vui lòng nhập họ tên.");
    }
  });
});
