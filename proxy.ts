import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";

/**
 * Lớp chặn nhanh ở Edge — chỉ verify chữ ký/hạn JWT + đọc role từ token để
 * điều hướng theo route, KHÔNG gọi DB (Edge không tiện gọi Postgres qua
 * driver adapter). Đây không phải lớp kiểm tra thẩm quyền cuối cùng: một
 * token còn hạn nhưng user vừa bị khoá (status khác ACTIVE) vẫn qua được
 * middleware — lớp thật sự chặn việc đó là requireAuth()/requireRole()
 * (Node runtime, có đọc lại DB) chạy trong từng layout/action/route bên dưới.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminRoute = pathname.startsWith("/admin");
  const isStudentRoute = pathname.startsWith("/student");

  if (!isAdminRoute && !isStudentRoute) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAdminRoute && session.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/student/dashboard", request.url));
  }

  if (isStudentRoute && session.role !== "STUDENT") {
    return NextResponse.redirect(new URL("/admin/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/student/:path*"],
};
