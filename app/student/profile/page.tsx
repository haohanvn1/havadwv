import { requireRole } from "@/lib/auth/guards";
import { getStudentProfileDetails } from "@/server/services/studentProfileService";

function initials(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

export default async function StudentProfilePage() {
  const user = await requireRole("STUDENT");
  const profile = await getStudentProfileDetails(user.id);

  const details = [
    { label: "Tên đăng nhập", value: user.username },
    { label: "Email", value: user.email ?? "—" },
    { label: "Số điện thoại", value: user.phone ?? "—" },
    { label: "Lớp", value: profile?.class ?? "—" },
    { label: "Trường", value: profile?.school ?? "—" },
    { label: "Kỳ thi mục tiêu", value: profile?.targetExamType ?? "Chưa cập nhật" },
    {
      label: "Ngày tham gia",
      value: new Intl.DateTimeFormat("vi-VN", { dateStyle: "long" }).format(user.createdAt),
    },
  ];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div className="bg-card border-border flex items-center gap-4 rounded-3xl border p-6">
        <div className="bg-primary/10 text-primary flex size-16 shrink-0 items-center justify-center rounded-full text-xl font-extrabold">
          {initials(user.fullName)}
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold">{user.fullName}</h1>
          <span className="bg-success-soft mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold text-[color-mix(in_oklch,var(--success),black_20%)]">
            {user.status === "ACTIVE" ? "Đang hoạt động" : "Ngừng hoạt động"}
          </span>
        </div>
      </div>

      <div className="bg-card border-border rounded-3xl border p-6">
        <h2 className="mb-4 text-sm font-bold">Thông tin cá nhân</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {details.map((d) => (
            <div key={d.label}>
              <dt className="text-muted-foreground text-xs">{d.label}</dt>
              <dd className="text-sm font-medium">{d.value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-muted-foreground mt-5 text-xs">
          Cần đổi thông tin? Liên hệ admin — chỉnh sửa hồ sơ trực tiếp sẽ có ở phase sau.
        </p>
      </div>
    </div>
  );
}
