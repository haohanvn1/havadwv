import { Badge } from "@/components/ui/badge";
import type { UserStatus } from "@/lib/generated/prisma/enums";

export function StudentStatusBadge({ status }: { status: UserStatus }) {
  return (
    <Badge variant={status === "ACTIVE" ? "default" : "secondary"}>
      {status === "ACTIVE" ? "Đang hoạt động" : "Đã khoá"}
    </Badge>
  );
}
