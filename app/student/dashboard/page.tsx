import { requireRole } from "@/lib/auth/guards";

export default async function StudentDashboardPage() {
  const user = await requireRole("STUDENT");

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-xl font-semibold">Chào, {user.fullName}</h1>
      <p className="text-muted-foreground text-sm">
        Student dashboard — placeholder. Ôn tập, thi thử, bài giảng sẽ có ở các phase sau.
      </p>
    </div>
  );
}
