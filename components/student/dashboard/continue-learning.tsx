import Link from "next/link";
import { BookOpen, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { getContinueLearning } from "@/server/services/studentDashboardService";

function formatMinutes(seconds: number) {
  const m = Math.floor(seconds / 60);
  return `${m} phút`;
}

export async function ContinueLearning({ studentId }: { studentId: string }) {
  let item;
  try {
    item = await getContinueLearning(studentId);
  } catch {
    return <ErrorState message="Không thể tải nội dung đang học dở." />;
  }

  if (!item) {
    return (
      <EmptyState
        className="bg-card rounded-3xl"
        title="Bạn chưa có bài học đang thực hiện."
        description="Chọn một đề để bắt đầu nhé!"
        action={
          <Button
            size="sm"
            nativeButton={false}
            className="rounded-full"
            render={<Link href="/student/exams">Xem đề thi</Link>}
          />
        }
      />
    );
  }

  if (item.kind === "attempt") {
    const percent =
      item.totalCount && item.totalCount > 0
        ? Math.min(100, Math.round((item.answeredCount / item.totalCount) * 100))
        : null;

    return (
      <div className="bg-card border-border flex items-center gap-4 rounded-3xl border p-5">
        <div className="bg-primary/10 text-primary flex size-12 shrink-0 items-center justify-center rounded-2xl">
          <BookOpen className="size-5.5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {item.subjectName ? `${item.subjectName} — ${item.title}` : item.title}
          </p>
          <p className="text-muted-foreground text-xs">
            {percent !== null
              ? `Đã làm ${item.answeredCount}/${item.totalCount} câu`
              : `Đã trả lời ${item.answeredCount} câu`}
          </p>
          {percent !== null && (
            <div className="bg-border mt-2 h-1.5 overflow-hidden rounded-full">
              <div className="bg-primary h-full rounded-full" style={{ width: `${percent}%` }} />
            </div>
          )}
        </div>
        <Button
          size="sm"
          nativeButton={false}
          className="shrink-0 rounded-full"
          render={<Link href={`/student/exams/mock`}>Tiếp tục</Link>}
        />
      </div>
    );
  }

  const percent =
    item.durationSeconds && item.durationSeconds > 0
      ? Math.min(100, Math.round((item.progressSeconds / item.durationSeconds) * 100))
      : null;

  return (
    <div className="bg-card border-border flex items-center gap-4 rounded-3xl border p-5">
      <div className="bg-accent2-soft text-accent2 flex size-12 shrink-0 items-center justify-center rounded-2xl">
        <PlayCircle className="size-5.5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {item.subjectName ? `${item.subjectName} — ${item.title}` : item.title}
        </p>
        <p className="text-muted-foreground text-xs">
          Đã xem {formatMinutes(item.progressSeconds)}
          {item.durationSeconds ? ` / ${formatMinutes(item.durationSeconds)}` : ""}
        </p>
        {percent !== null && (
          <div className="bg-border mt-2 h-1.5 overflow-hidden rounded-full">
            <div className="bg-accent2 h-full rounded-full" style={{ width: `${percent}%` }} />
          </div>
        )}
      </div>
      <Button
        size="sm"
        nativeButton={false}
        className="shrink-0 rounded-full"
        render={<Link href="/student/video-lessons">Tiếp tục</Link>}
      />
    </div>
  );
}
