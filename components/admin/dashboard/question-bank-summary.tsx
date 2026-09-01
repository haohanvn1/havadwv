import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { getQuestionBankSummary } from "@/server/services/dashboardService";

const TYPE_LABELS: Record<string, string> = {
  SINGLE_CHOICE: "Single Choice",
  MULTIPLE_CHOICE: "Multiple Choice",
  TRUE_FALSE: "True / False",
  SHORT_ANSWER: "Short Answer",
};

export async function QuestionBankSummary() {
  let summary;
  try {
    summary = await getQuestionBankSummary();
  } catch {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Question Bank</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorState message="Không thể tải số liệu ngân hàng câu hỏi." />
        </CardContent>
      </Card>
    );
  }

  if (summary.total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Question Bank</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState title="Chưa có câu hỏi nào." />
        </CardContent>
      </Card>
    );
  }

  const statusRows = [
    { label: "Total Questions", value: summary.total },
    { label: "Draft", value: summary.draft },
    { label: "Active", value: summary.active },
    { label: "Archived", value: summary.archived },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Question Bank</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {statusRows.map((row) => (
            <div key={row.label}>
              <dt className="text-muted-foreground text-xs">{row.label}</dt>
              <dd className="text-lg font-semibold tabular-nums">{row.value}</dd>
            </div>
          ))}
        </dl>

        <div className="border-t pt-3">
          <p className="text-muted-foreground mb-2 text-xs">Theo loại câu hỏi</p>
          <ul className="flex flex-wrap gap-x-6 gap-y-1.5 text-sm">
            {summary.byType.map((row) => (
              <li key={row.type} className="flex items-center gap-1.5">
                <span className="text-muted-foreground">{TYPE_LABELS[row.type] ?? row.type}</span>
                <span className="font-medium tabular-nums">{row.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
