import { ErrorState } from "@/components/ui/error-state";
import { getLearningOverview } from "@/server/services/studentDashboardService";

function formatStudyTime(seconds: number) {
  if (seconds === 0) return "Chưa có dữ liệu";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours > 0) return `${hours} giờ ${minutes} phút`;
  return `${minutes} phút`;
}

export async function LearningProgress({ studentId }: { studentId: string }) {
  let overview;
  try {
    overview = await getLearningOverview(studentId);
  } catch {
    return (
      <div>
        <h2 className="mb-3 text-base font-bold">Tiến độ học tập</h2>
        <ErrorState message="Không thể tải tiến độ học tập." />
      </div>
    );
  }

  const accuracy =
    overview.questionsAnswered > 0
      ? Math.round((overview.correctAnswers / overview.questionsAnswered) * 100)
      : 0;

  const stats = [
    { label: "Đề đã làm", value: overview.examsCompleted },
    {
      label: "Điểm trung bình",
      value: overview.averageScore !== null ? `${Math.round(overview.averageScore)}%` : "—",
    },
    { label: "Câu hỏi đã làm", value: overview.questionsAnswered },
    { label: "Thời gian học", value: formatStudyTime(overview.studyTimeSeconds) },
  ];

  const achievements = [
    { emoji: "🎯", label: "Accuracy trên 70%", unlocked: accuracy >= 70 },
    { emoji: "🏆", label: "Hoàn thành 10 đề", unlocked: overview.examsCompleted >= 10 },
  ];

  // Mục tiêu tuần tạm tính từ accuracy — chưa có bảng lưu "mục tiêu tuần"
  // riêng, không bịa số cụ thể như "3/5 mục tiêu" khi chưa có cơ chế đặt
  // mục tiêu thật.
  const ringPercent = accuracy;

  return (
    <div>
      <h2 className="mb-3 text-base font-bold">Tiến độ học tập</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-card border-border rounded-2xl border p-4">
            <p className="text-lg font-extrabold tabular-nums">{s.value}</p>
            <p className="text-muted-foreground text-xs">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border-border mt-3 rounded-3xl border p-5">
        <div className="flex items-center gap-4">
          <div
            className="flex size-16 shrink-0 items-center justify-center rounded-full"
            style={{
              background: `conic-gradient(var(--primary) 0% ${ringPercent}%, var(--border) ${ringPercent}% 100%)`,
            }}
            role="img"
            aria-label={`Độ chính xác ${ringPercent}%`}
          >
            <div className="bg-card flex size-12 items-center justify-center rounded-full text-sm font-extrabold">
              {ringPercent}%
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold">Độ chính xác chung</p>
            <p className="text-muted-foreground text-xs">
              {overview.questionsAnswered > 0
                ? `${overview.correctAnswers}/${overview.questionsAnswered} câu đúng`
                : "Chưa có dữ liệu"}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {achievements.map((a) => (
            <span
              key={a.label}
              className={
                a.unlocked
                  ? "bg-warning-soft flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-[color-mix(in_oklch,var(--warning),black_25%)]"
                  : "bg-muted text-muted-foreground flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
              }
            >
              <span aria-hidden="true">{a.unlocked ? a.emoji : "🔒"}</span>
              {a.label}
              {!a.unlocked && <span className="sr-only">(chưa đạt)</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
