"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PAGE_SIZE_OPTIONS } from "@/lib/constants/question-bank";

export function PaginationControls({
  page,
  totalPages,
  total,
  pageSize,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function goToPage(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(nextPage));
    router.push(`${pathname}?${params.toString()}`);
  }

  function changePageSize(nextSize: string | null) {
    if (!nextSize) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("pageSize", nextSize);
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <span>
          Tổng <span className="text-foreground font-medium">{total}</span> câu hỏi
        </span>
        <Select value={String(pageSize)} onValueChange={changePageSize}>
          <SelectTrigger size="sm" className="w-fit">
            <SelectValue>{(v: string) => `${v} / trang`}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size} / trang
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => goToPage(page - 1)}
          aria-label="Trang trước"
        >
          <ChevronLeft className="size-4" />
          Trước
        </Button>
        <span className="text-muted-foreground text-sm whitespace-nowrap">
          Trang {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => goToPage(page + 1)}
          aria-label="Trang sau"
        >
          Sau
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
