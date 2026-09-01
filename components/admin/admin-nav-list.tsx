"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { adminNavGroups, isNavItemActive } from "@/lib/nav/admin-nav";
import { logoutAction } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

/**
 * Danh sách nav thật — dùng lại y hệt ở AdminSidebar (desktop/tablet) và bên
 * trong Sheet drawer (mobile), không định nghĩa route ở nơi thứ hai.
 */
export function AdminNavList({
  onNavigate,
  collapsedLabels = false,
}: {
  onNavigate?: () => void;
  /** true ở dải tablet (md) — icon vẫn còn, chữ ẩn qua CSS nhưng vẫn có aria-label. */
  collapsedLabels?: boolean;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col justify-between">
      <nav aria-label="Điều hướng khu vực Admin" className="flex flex-col gap-4">
        {adminNavGroups.map((group) => (
          <div key={group.label} className="flex flex-col gap-1">
            <span
              className={cn(
                "text-muted-foreground px-2.5 text-[11px] font-medium tracking-wide uppercase",
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
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors",
                    "focus-visible:ring-ring/50 outline-none focus-visible:ring-3",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-foreground/80 hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
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
            "text-foreground/80 hover:bg-muted hover:text-foreground flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors",
            "focus-visible:ring-ring/50 outline-none focus-visible:ring-3",
          )}
        >
          <LogOut className="size-4 shrink-0" aria-hidden="true" />
          <span className={cn(collapsedLabels && "sr-only")}>Đăng xuất</span>
        </button>
      </form>
    </div>
  );
}
