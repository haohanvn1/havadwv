import type { ReactNode } from "react";
import type { AuthUser } from "@/lib/auth/guards";
import { AdminSidebar } from "./admin-sidebar";
import { AdminHeader } from "./admin-header";

export function AdminShell({ user, children }: { user: AuthUser; children: ReactNode }) {
  return (
    <div className="flex min-h-svh">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminHeader user={user} />
        <main className="min-w-0 flex-1 overflow-x-hidden p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
