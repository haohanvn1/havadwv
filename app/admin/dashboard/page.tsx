import { requireRole } from "@/lib/auth/guards";

export default async function AdminDashboardPage() {
  const user = await requireRole("ADMIN");

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-xl font-semibold">Chào, {user.fullName}</h1>
      <p className="text-muted-foreground text-sm">
        Admin dashboard — placeholder. Số liệu thật (học sinh, đề, câu hỏi...) sẽ hoàn thiện ở phase
        sau.
      </p>
    </div>
  );
}
