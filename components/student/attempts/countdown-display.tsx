import { cn } from "@/lib/utils";
import { formatRemaining, isTimerExpired, isTimerWarning } from "./attempt-runner-logic";

/**
 * Chỉ hiển thị — server vẫn là authority duy nhất cho việc hết hạn (mục 3/10
 * Phase 9C). Cảnh báo bằng cả màu VÀ trọng lượng chữ khi còn dưới 5 phút,
 * không dùng animation giật/nhấp nháy gây xao nhãng.
 */
export function CountdownDisplay({ remainingMs }: { remainingMs: number | null }) {
  if (remainingMs === null) {
    return <span className="text-muted-foreground text-sm font-medium">Không giới hạn thời gian</span>;
  }

  return (
    <span
      className={cn(
        "font-mono text-base font-semibold tabular-nums sm:text-lg",
        isTimerExpired(remainingMs) || isTimerWarning(remainingMs) ? "text-destructive" : "text-foreground",
      )}
      role="timer"
      aria-live="off"
    >
      {formatRemaining(remainingMs)}
    </span>
  );
}
