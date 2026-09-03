"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { studentPrimaryMobileItems, isNavItemActive } from "@/lib/nav/student-nav";
import { cn } from "@/lib/utils";

/**
 * Thay cho hamburger + drawer của Admin — học sinh dùng điện thoại nhiều,
 * bottom nav cho ngón cái chạm ngay không cần mở menu (kiểu Duolingo/
 * Quizlet). Chỉ 5 mục quan trọng nhất (`primaryMobile` trong nav config);
 * các mục còn lại vào từ Dashboard hoặc sidebar đầy đủ ở desktop/tablet.
 */
export function StudentBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Điều hướng chính"
      className="bg-card fixed inset-x-0 bottom-0 z-40 flex border-t pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {studentPrimaryMobileItems.map((item) => {
        const active = isNavItemActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 px-1 py-2.5 text-[11px] font-medium",
              "focus-visible:ring-ring/50 outline-none focus-visible:ring-3",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className="size-5.5" aria-hidden="true" />
            {item.mobileLabel ?? item.label}
          </Link>
        );
      })}
    </nav>
  );
}
