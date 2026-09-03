import { BookOpen, FileText, Radio, Video, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { getRecentActivity, type RecentActivityType } from "@/server/services/dashboardService";

const ICONS: Record<RecentActivityType, typeof BookOpen> = {
  question: BookOpen,
  exam: FileText,
  liveClass: Radio,
  video: Video,
  blueprintImport: Upload,
};

function formatRelativeTime(date: Date) {
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.round(hours / 24);
  return `${days} ngày trước`;
}

export async function RecentActivity() {
  let items;
  try {
    items = await getRecentActivity(8);
  } catch {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorState message="Không thể tải hoạt động gần đây." />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState title="Chưa có hoạt động nào." />
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((item) => {
              const Icon = ICONS[item.type];
              return (
                <li key={item.id} className="flex items-start gap-3 text-sm">
                  <Icon
                    className="text-muted-foreground mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{item.label}</p>
                    <p className="text-muted-foreground text-xs">
                      {item.actor ? `${item.actor} · ` : ""}
                      {formatRelativeTime(item.at)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
