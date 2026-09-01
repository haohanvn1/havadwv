import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { getRecentResults } from "@/server/services/studentDashboardService";

function scoreTone(score: number | null) {
  if (score === null) return { bg: "bg-muted", text: "text-muted-foreground" };
  if (score >= 70)
    return { bg: "bg-success-soft", text: "text-[color-mix(in_oklch,var(--success),black_20%)]" };
  if (score >= 50)
    return { bg: "bg-warning-soft", text: "text-[color-mix(in_oklch,var(--warning),black_25%)]" };
  return { bg: "bg-destructive/10", text: "text-destructive" };
}

export async function RecentResults({ studentId }: { studentId: string }) {
  let results;
  try {
    results = await getRecentResults(studentId, 5);
  } catch {
    return (
      <div>
        <h2 className="mb-3 text-base font-bold">Kết quả gần đây</h2>
        <ErrorState message="Không thể tải kết quả gần đây." />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold">Kết quả gần đây</h2>
        {results.length > 0 && (
          <Link href="/student/exam-history" className="text-primary text-xs font-semibold">
            Xem tất cả
          </Link>
        )}
      </div>

      {results.length === 0 ? (
        <EmptyState
          className="bg-card rounded-3xl"
          title="Bạn chưa làm đề nào."
          description="Hoàn thành đề đầu tiên để xem tiến bộ của mình nhé!"
        />
      ) : (
        <div className="bg-card border-border divide-border divide-y rounded-3xl border px-5">
          {results.map((r) => {
            const tone = scoreTone(r.score);
            return (
              <div key={r.id} className="flex items-center gap-3 py-3.5">
                <div
                  className={`flex size-9 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold ${tone.bg} ${tone.text}`}
                >
                  {r.score !== null ? `${Math.round(r.score)}%` : "—"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{r.title}</p>
                  <p className="text-muted-foreground text-xs">
                    {r.submittedAt ? new Intl.DateTimeFormat("vi-VN").format(r.submittedAt) : "—"} ·{" "}
                    {r.status === "AUTO_SUBMITTED" ? "Tự động nộp" : "Hoàn thành"}
                  </p>
                </div>
                <Link
                  href="/student/exam-history"
                  className="bg-primary/10 text-primary shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold"
                >
                  Xem lại
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
