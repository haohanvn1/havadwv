import type { SessionRole } from "./session";

/**
 * Chỉ cho phép chuyển hướng nội bộ tuyệt đối (chặn open redirect qua "from"),
 * và phải khớp đúng khu vực của role vừa đăng nhập. Nếu không kiểm tra vế
 * role: một student bị middleware đá về /login?from=/admin/... rồi đăng
 * nhập đúng tài khoản student của họ sẽ bị đưa tới /admin/dashboard trước,
 * tới lúc AdminLayout mới redirect tiếp sang /student/dashboard — nội dung
 * hiển thị vẫn đúng nhưng thanh URL đi qua một bước thừa. Kiểm tra role
 * ngay tại đây để luôn đi thẳng một bước.
 *
 * Tách khỏi lib/auth/actions.ts (file "use server") vì một module Server
 * Action chỉ được export async function — hàm thuần này cần export được để
 * unit test trực tiếp.
 */
export function resolveSafeRedirectPath(
  path: FormDataEntryValue | null,
  role: SessionRole,
): string | null {
  if (
    typeof path !== "string" ||
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.startsWith("/\\")
  ) {
    return null;
  }
  const ownAreaPrefix = role === "ADMIN" ? "/admin" : "/student";
  return path.startsWith(ownAreaPrefix) ? path : null;
}

export function getDefaultDashboardPath(role: SessionRole): string {
  return role === "ADMIN" ? "/admin/dashboard" : "/student/dashboard";
}
