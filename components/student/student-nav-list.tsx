"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { studentNavGroups, isNavItemActive } from "@/lib/nav/student-nav";
import { logoutAction } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

/** Danh sách nav thật cho sidebar desktop/tablet — bottom nav mobile dùng component riêng (StudentBottomNav) vì bố cục khác hẳn, nhưng cả hai đọc chung `studentNavGroups`. */
export function StudentNavList({
  onNavigate,
  collapsedLabels = false,
}: {
  onNavigate?: () => void;
  collapsedLabels?: boolean;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col justify-between">
      <nav aria-label="Điều hướng khu vực học sinh" className="flex flex-col gap-4">
        {studentNavGroups.map((group) => (
          <div key={group.label} className="flex flex-col gap-1">
            <span
              className={cn(
                "text-muted-foreground px-3 text-[11px] font-semibold tracking-wide uppercase",
                collapsedLabels && "sr-only",
              )}
            >
              {group.label}
            </span>
            {group.items.map((item) => {
              const active = isNavItemActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  title={collapsedLabels ? item.label : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium transition-colors",
                    "focus-visible:ring-ring/50 outline-none focus-visible:ring-3",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-foreground/75 hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <Icon className="size-4.5 shrink-0" aria-hidden="true" />
                  <span className={cn(collapsedLabels && "sr-only")}>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <form action={logoutAction}>
        <button
          type="submit"
          className={cn(
            "text-foreground/75 hover:bg-accent hover:text-accent-foreground flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium transition-colors",
            "focus-visible:ring-ring/50 outline-none focus-visible:ring-3",
          )}
        >
          <LogOut className="size-4.5 shrink-0" aria-hidden="true" />
          <span className={cn(collapsedLabels && "sr-only")}>Đăng xuất</span>
        </button>
      </form>
    </div>
  );
}
