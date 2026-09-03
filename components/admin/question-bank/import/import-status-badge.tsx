import { Badge } from "@/components/ui/badge";
import { IMPORT_JOB_STATUS_LABELS } from "@/lib/constants/import";

export function ImportStatusBadge({ status }: { status: string }) {
  const variant = status === "DONE" ? "default" : status === "FAILED" ? "destructive" : "secondary";
  return <Badge variant={variant}>{IMPORT_JOB_STATUS_LABELS[status] ?? status}</Badge>;
}
