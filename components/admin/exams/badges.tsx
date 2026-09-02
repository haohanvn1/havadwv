import { Badge } from "@/components/ui/badge";
import type { ExamStatus } from "@/lib/generated/prisma/enums";

const EXAM_STATUS_LABELS: Record<ExamStatus, string> = {
  DRAFT: "Nháp",
  PUBLISHED: "Đã publish",
  ARCHIVED: "Đã lưu trữ",
};

export function ExamStatusBadge({ status }: { status: ExamStatus }) {
  const variant = status === "PUBLISHED" ? "default" : status === "ARCHIVED" ? "outline" : "secondary";
  return <Badge variant={variant}>{EXAM_STATUS_LABELS[status]}</Badge>;
}
