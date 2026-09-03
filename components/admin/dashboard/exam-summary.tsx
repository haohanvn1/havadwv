import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { getExamSummary } from "@/server/services/dashboardService";

export async function ExamSummary() {
  let summary;
  try {
    summary = await getExamSummary();
  } catch {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Exams</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorState message="Không thể tải số liệu đề thi." />
        </CardContent>
      </Card>
    );
  }

  if (summary.total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Exams</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState title="Chưa có đề thi nào." />
        </CardContent>
      </Card>
    );
  }

  const rows = [
    { label: "Total Exams", value: summary.total },
    { label: "Published", value: summary.published },
    { label: "Draft", value: summary.draft },
    { label: "Archived", value: summary.archived },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Exams</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {rows.map((row) => (
            <div key={row.label}>
              <dt className="text-muted-foreground text-xs">{row.label}</dt>
              <dd className="text-lg font-semibold tabular-nums">{row.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
