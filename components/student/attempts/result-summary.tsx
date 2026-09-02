export interface AttemptResultSummary {
  score: number | null;
  maxScore: number;
  correctCount: number | null;
  wrongCount: number | null;
  unansweredCount: number | null;
}

/**
 * Chỉ hiển thị tổng hợp điểm (Phase 9B API) — KHÔNG hiển thị đúng/sai từng
 * câu, không có nút xem lại chi tiết. Review chi tiết thuộc Phase 9D, ngoài
 * phạm vi ở đây (mục 16/28).
 */
export function ResultSummary({ result }: { result: AttemptResultSummary }) {
  return (
    <div className="bg-card border-border grid grid-cols-2 gap-3 rounded-2xl border p-4 sm:grid-cols-4">
      <div>
        <p className="text-muted-foreground text-xs">Điểm</p>
        <p className="text-lg font-bold">
          {result.score ?? "—"}/{result.maxScore}
        </p>
      </div>
      <div>
        <p className="text-muted-foreground text-xs">Đúng</p>
        <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{result.correctCount ?? "—"}</p>
      </div>
      <div>
        <p className="text-muted-foreground text-xs">Sai</p>
        <p className="text-destructive text-lg font-bold">{result.wrongCount ?? "—"}</p>
      </div>
      <div>
        <p className="text-muted-foreground text-xs">Bỏ trống</p>
        <p className="text-lg font-bold">{result.unansweredCount ?? "—"}</p>
      </div>
    </div>
  );
}
