"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface QuestionNavItem {
  questionId: string;
  answered: boolean;
}

/**
 * Bảng điều hướng câu hỏi dạng lưới số — tham khảo bố cục UX của hệ thống
 * thi trực tuyến truyền thống (không copy nhận diện/thương hiệu, chỉ lấy bố
 * cục: lưới số câu bên trái + tiến độ, mục 4 Phase 9C redesign). Click một
 * số sẽ cuộn tới đúng câu đó thay vì chuyển trang — toàn bộ câu hỏi nằm
 * liên tục theo chiều dọc ở khu vực chính (mục 5).
 *
 * 3 trạng thái luôn được phân biệt bằng NHIỀU hơn một tín hiệu thị giác
 * (không chỉ màu — mục 4/25 accessibility): current = viền + nền đậm;
 * answered = dấu tích + nền nhạt; unanswered = số trần, viền nhạt.
 */
export function QuestionNavigatorGrid({
  items,
  currentIndex,
  onSelect,
}: {
  items: QuestionNavItem[];
  currentIndex: number;
  onSelect: (index: number) => void;
}) {
  const answeredCount = items.filter((i) => i.answered).length;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Danh sách câu hỏi</p>

      <div className="grid grid-cols-5 gap-1.5" role="tablist" aria-label="Danh sách câu hỏi">
        {items.map((item, index) => {
          const isCurrent = index === currentIndex;
          return (
            <button
              key={item.questionId}
              type="button"
              role="tab"
              aria-selected={isCurrent}
              aria-current={isCurrent ? "true" : undefined}
              aria-label={`Câu ${index + 1}${item.answered ? " — đã trả lời" : " — chưa trả lời"}`}
              onClick={() => onSelect(index)}
              className={cn(
                "relative flex h-9 items-center justify-center rounded-md border text-xs font-medium transition-colors",
                isCurrent
                  ? "border-primary bg-primary text-primary-foreground ring-primary/30 ring-2"
                  : item.answered
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground",
              )}
            >
              {item.answered && !isCurrent ? (
                <Check className="absolute -top-1.5 -right-1.5 size-3.5 rounded-full bg-white p-0.5 text-emerald-600 shadow-sm dark:bg-neutral-900" />
              ) : null}
              {String(index + 1).padStart(2, "0")}
            </button>
          );
        })}
      </div>

      <div className="border-border flex flex-col gap-1 border-t pt-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Đã trả lời</span>
          <span className="font-semibold">
            {answeredCount}/{items.length}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Chưa trả lời</span>
          <span className="font-semibold">{items.length - answeredCount}</span>
        </div>
      </div>
    </div>
  );
}
