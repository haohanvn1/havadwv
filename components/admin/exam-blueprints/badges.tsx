import { Badge } from "@/components/ui/badge";
import {
  BLUEPRINT_STATUS_LABELS,
  GENERATION_JOB_STATUS_LABELS,
} from "@/lib/constants/exam-blueprint";
import type { BlueprintStatus, GenerationJobStatus } from "@/lib/generated/prisma/enums";

export function BlueprintStatusBadge({ status }: { status: BlueprintStatus }) {
  const variant = status === "APPROVED" ? "default" : status === "ARCHIVED" ? "outline" : "secondary";
  return <Badge variant={variant}>{BLUEPRINT_STATUS_LABELS[status]}</Badge>;
}

export function GenerationJobStatusBadge({ status }: { status: GenerationJobStatus }) {
  const variant = status === "CONFIRMED" ? "default" : status === "FAILED" ? "destructive" : "secondary";
  return <Badge variant={variant}>{GENERATION_JOB_STATUS_LABELS[status]}</Badge>;
}
