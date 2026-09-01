"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChevronDown, LogOut, UserRound } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getStudentPageTitle } from "@/lib/nav/student-nav";
import { logoutAction } from "@/lib/auth/actions";
import type { AuthUser } from "@/lib/auth/guards";

function initials(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

export function StudentHeader({ user }: { user: AuthUser }) {
  const pathname = usePathname();
  const pageTitle = getStudentPageTitle(pathname);

  return (
    <header className="bg-card/80 sticky top-0 z-30 flex items-center justify-between gap-4 border-b px-4 py-3 backdrop-blur md:px-6">
      <h1 className="truncate text-base font-semibold">{pageTitle}</h1>

      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Thông báo (sắp ra mắt)"
          title="Thông báo (sắp ra mắt)"
          disabled
        >
          <Bell className="size-4.5" aria-hidden="true" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label={`Menu tài khoản của ${user.fullName}`}
                className="focus-visible:ring-ring/50 flex items-center gap-2 rounded-full px-1.5 py-1 outline-none focus-visible:ring-3"
              >
                <Avatar className="size-8">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {initials(user.fullName)}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden text-sm font-medium sm:inline">{user.fullName}</span>
                <ChevronDown className="text-muted-foreground size-3.5" aria-hidden="true" />
              </button>
            }
          />
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              render={
                <Link href="/student/profile">
                  <UserRound className="size-4" aria-hidden="true" />
                  Hồ sơ
                </Link>
              }
            />
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              render={
                <form action={logoutAction} className="contents">
                  <button type="submit" className="flex w-full items-center gap-2">
                    <LogOut className="size-4" aria-hidden="true" />
                    Đăng xuất
                  </button>
                </form>
              }
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
