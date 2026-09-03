import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { getUpcomingLiveClasses } from "@/server/services/studentDashboardService";

function formatClassTime(start: Date, end: Date) {
  const time = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const date = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return `${time.format(start)} – ${time.format(end)} · ${date.format(start)}`;
}

export async function UpcomingClasses({ studentId }: { studentId: string }) {
  let classes;
  try {
    classes = await getUpcomingLiveClasses(studentId, 5);
  } catch {
    return (
      <div>
        <h2 className="mb-3 text-base font-bold">Lớp học sắp tới</h2>
        <ErrorState message="Không thể tải danh sách lớp học sắp tới." />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold">Lớp học sắp tới</h2>
        {classes.length > 0 && (
          <Link href="/student/live-classes" className="text-primary text-xs font-semibold">
            Xem tất cả
          </Link>
        )}
      </div>

      {classes.length === 0 ? (
        <EmptyState
          className="bg-card rounded-3xl"
          title="Chưa có lớp học sắp tới."
          description="Theo dõi lịch học để không bỏ lỡ buổi nào nhé!"
        />
      ) : (
        <div className="bg-card border-border divide-border divide-y rounded-3xl border px-5">
          {classes.map((c) => (
            <div key={c.id} className="flex items-center gap-3 py-3.5">
              <span className="bg-success size-2 shrink-0 rounded-full" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {c.subjectName ? `${c.subjectName} — ${c.title}` : c.title}
                </p>
                <p className="text-muted-foreground text-xs">
                  {c.teacherName ? `${c.teacherName} · ` : ""}
                  {formatClassTime(c.startTime, c.endTime)}
                </p>
              </div>
              <Link
                href="/student/live-classes"
                className="bg-primary/10 text-primary shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold"
              >
                Xem lớp
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
