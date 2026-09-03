/** "/admin/students/123" vẫn tính là active cho mục "Students" (href "/admin/students"). */
export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Khi hai nav item có href lồng nhau (vd "/admin/question-bank" và
 * "/admin/question-bank/import"), `isNavItemActive` gọi độc lập cho từng
 * item sẽ khiến CẢ HAI cùng sáng ở route con — dùng hàm này để chỉ chọn ra
 * đúng MỘT item khớp đặc hiệu nhất (ưu tiên khớp chính xác, sau đó tiền tố
 * dài nhất) cho việc highlight sidebar.
 */
export function findActiveNavItem<T extends { href: string }>(
  pathname: string,
  items: readonly T[],
): T | undefined {
  const exact = items.find((item) => pathname === item.href);
  if (exact) return exact;

  return [...items]
    .filter((item) => isNavItemActive(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
}
