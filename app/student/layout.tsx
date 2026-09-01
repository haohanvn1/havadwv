import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { LogoutButton } from "@/components/logout-button";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("STUDENT");

  return (
    <div className="min-h-svh">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <div>
          <p className="text-sm font-medium">HavaEdu</p>
          <p className="text-muted-foreground text-xs">{user.fullName}</p>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/student/dashboard">Dashboard</Link>
          <Link href="/student/profile">Hồ sơ</Link>
          <LogoutButton />
        </nav>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
