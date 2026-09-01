import type { ReactNode } from "react";
import type { AuthUser } from "@/lib/auth/guards";
import { StudentSidebar } from "./student-sidebar";
import { StudentHeader } from "./student-header";
import { StudentBottomNav } from "./student-bottom-nav";

export function StudentShell({ user, children }: { user: AuthUser; children: ReactNode }) {
  return (
    <div className="student-theme bg-background text-foreground flex min-h-svh">
      <StudentSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <StudentHeader user={user} />
        <main className="min-w-0 flex-1 overflow-x-hidden p-4 pb-20 md:p-6 md:pb-6">
          {children}
        </main>
      </div>
      <StudentBottomNav />
    </div>
  );
}
