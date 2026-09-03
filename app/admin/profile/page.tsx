import { requireRole } from "@/lib/auth/guards";

export default async function AdminProfilePage() {
  const user = await requireRole("ADMIN");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Hồ sơ</h1>
      <dl className="grid max-w-md grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Họ tên</dt>
        <dd>{user.fullName}</dd>
        <dt className="text-muted-foreground">Tên đăng nhập</dt>
        <dd>{user.username}</dd>
        <dt className="text-muted-foreground">Email</dt>
        <dd>{user.email ?? "—"}</dd>
        <dt className="text-muted-foreground">Vai trò</dt>
        <dd>{user.role}</dd>
        <dt className="text-muted-foreground">Trạng thái</dt>
        <dd>{user.status}</dd>
        <dt className="text-muted-foreground">Đăng nhập gần nhất</dt>
        <dd>{user.lastLoginAt ? user.lastLoginAt.toLocaleString("vi-VN") : "—"}</dd>
      </dl>
    </div>
  );
}
