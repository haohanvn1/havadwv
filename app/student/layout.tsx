import { requireRole } from "@/lib/auth/guards";
import { StudentShell } from "@/components/student/student-shell";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("STUDENT");

  return <StudentShell user={user}>{children}</StudentShell>;
}
