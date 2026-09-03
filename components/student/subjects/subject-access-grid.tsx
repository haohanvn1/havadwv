import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { AccessibleSubject } from "@/server/services/subjectAccessService";

/**
 * Danh sách card Subject học sinh có quyền — dùng chung cho "Lớp" (bài
 * giảng) và "Bộ đề" (đề thi), Phase 10. `countLabel` chọn đúng số liệu cần
 * hiển thị trên card của từng trang (videoLessonCount hoặc examCount).
 */
export function SubjectAccessGrid({
  subjects,
  basePath,
  countLabel,
}: {
  subjects: AccessibleSubject[];
  basePath: string;
  countLabel: (subject: AccessibleSubject) => string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {subjects.map((subject) => (
        <Link
          key={subject.id}
          href={`${basePath}/${subject.id}`}
          className="bg-card border-border hover:border-primary/40 flex items-center justify-between gap-2 rounded-3xl border p-4 transition-colors"
        >
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold">{subject.name}</span>
            <span className="text-muted-foreground text-xs">{countLabel(subject)}</span>
          </div>
          <ChevronRight className="text-muted-foreground size-4 shrink-0" />
        </Link>
      ))}
    </div>
  );
}
