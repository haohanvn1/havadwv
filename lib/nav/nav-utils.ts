/** "/admin/students/123" vẫn tính là active cho mục "Students" (href "/admin/students"). */
export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
