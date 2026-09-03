import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { getUpcomingLiveClasses } from "@/server/services/dashboardService";

function formatClassTime(start: Date, end: Date) {
  const time = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const date = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return `${time.format(start)} – ${time.format(end)} · ${date.format(start)}`;
}

export async function UpcomingClasses() {
  let classes;
  try {
    classes = await getUpcomingLiveClasses(5);
  } catch {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Classes</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorState message="Không thể tải danh sách lớp học sắp tới." />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming Classes</CardTitle>
      </CardHeader>
      <CardContent>
        {classes.length === 0 ? (
          <EmptyState
            title="Chưa có lớp học sắp tới."
            action={
              <Button
                size="sm"
                nativeButton={false}
                render={<Link href="/admin/live-classes">Create Live Class</Link>}
              />
            }
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {classes.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {c.subjectName ? `${c.subjectName} — ${c.title}` : c.title}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {formatClassTime(c.startTime, c.endTime)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
