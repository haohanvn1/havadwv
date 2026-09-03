"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TopicSelect } from "./topic-select";
import {
  COGNITIVE_LEVEL_LABELS,
  COGNITIVE_LEVELS,
  DIFFICULTY_LABELS,
  DIFFICULTY_OPTIONS,
  QUESTION_STATUS_LABELS,
  QUESTION_STATUS_OPTIONS,
  QUESTION_TYPE_LABELS,
  QUESTION_TYPE_OPTIONS,
  SORT_OPTIONS,
} from "@/lib/constants/question-bank";

const SORT_LABELS: Record<string, string> = Object.fromEntries(
  SORT_OPTIONS.map((o) => [o.value, o.label]),
);

const ALL_VALUE = "__all__";

export function QuestionFilters({ subjects }: { subjects: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const searchFromUrl = searchParams.get("search") ?? "";
  const [search, setSearch] = useState(searchFromUrl);
  const [syncedSearch, setSyncedSearch] = useState(searchFromUrl);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // searchParams đổi từ bên ngoài (điều hướng back/forward, xoá bộ lọc) →
  // đồng bộ lại state hiển thị ngay trong lượt render này, không dùng effect
  // cho việc chỉ phản chiếu một giá trị bên ngoài vào state cục bộ.
  if (searchFromUrl !== syncedSearch) {
    setSyncedSearch(searchFromUrl);
    setSearch(searchFromUrl);
  }

  function updateParams(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined || value === "" || value === ALL_VALUE) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleSearchChange(next: string) {
    setSearch(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => updateParams({ search: next }), 350);
  }

  const hasActiveFilters =
    searchParams.get("search") ||
    searchParams.get("subjectId") ||
    searchParams.get("topicId") ||
    searchParams.get("type") ||
    searchParams.get("difficulty") ||
    searchParams.get("cognitiveLevel") ||
    searchParams.get("status") ||
    searchParams.get("year");

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Tìm theo nội dung, nguồn đề hoặc tag..."
          className="pl-8"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Select
          value={searchParams.get("subjectId") ?? ALL_VALUE}
          onValueChange={(v) =>
            updateParams({ subjectId: v === ALL_VALUE ? undefined : (v as string), topicId: undefined })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue>
              {(v: string) => (v === ALL_VALUE ? "Tất cả môn học" : (subjects.find((s) => s.id === v)?.name ?? "Môn học"))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Tất cả môn học</SelectItem>
            {subjects.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <TopicSelect
          subjectId={searchParams.get("subjectId") ?? undefined}
          value={searchParams.get("topicId") ?? undefined}
          onChange={(topicId) => updateParams({ topicId })}
          allowAll
        />

        <Select
          value={searchParams.get("type") ?? ALL_VALUE}
          onValueChange={(v) => updateParams({ type: v === ALL_VALUE ? undefined : (v as string) })}
        >
          <SelectTrigger className="w-full">
            <SelectValue>
              {(v: string) => (v === ALL_VALUE ? "Tất cả loại" : QUESTION_TYPE_LABELS[v as keyof typeof QUESTION_TYPE_LABELS])}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Tất cả loại</SelectItem>
            {QUESTION_TYPE_OPTIONS.map((t) => (
              <SelectItem key={t} value={t}>
                {QUESTION_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={searchParams.get("difficulty") ?? ALL_VALUE}
          onValueChange={(v) => updateParams({ difficulty: v === ALL_VALUE ? undefined : (v as string) })}
        >
          <SelectTrigger className="w-full">
            <SelectValue>
              {(v: string) => (v === ALL_VALUE ? "Tất cả độ khó" : DIFFICULTY_LABELS[v as keyof typeof DIFFICULTY_LABELS])}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Tất cả độ khó</SelectItem>
            {DIFFICULTY_OPTIONS.map((d) => (
              <SelectItem key={d} value={d}>
                {DIFFICULTY_LABELS[d]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={searchParams.get("cognitiveLevel") ?? ALL_VALUE}
          onValueChange={(v) =>
            updateParams({ cognitiveLevel: v === ALL_VALUE ? undefined : (v as string) })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue>
              {(v: string) => (v === ALL_VALUE ? "Tất cả mức độ" : (COGNITIVE_LEVEL_LABELS[v] ?? "Mức độ tư duy"))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Tất cả mức độ</SelectItem>
            {COGNITIVE_LEVELS.map((level) => (
              <SelectItem key={level.value} value={level.value}>
                {level.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={searchParams.get("status") ?? ALL_VALUE}
          onValueChange={(v) => updateParams({ status: v === ALL_VALUE ? undefined : (v as string) })}
        >
          <SelectTrigger className="w-full">
            <SelectValue>
              {(v: string) => (v === ALL_VALUE ? "Tất cả trạng thái" : QUESTION_STATUS_LABELS[v as keyof typeof QUESTION_STATUS_LABELS])}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Tất cả trạng thái</SelectItem>
            {QUESTION_STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {QUESTION_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="number"
          value={searchParams.get("year") ?? ""}
          onChange={(e) => updateParams({ year: e.target.value || undefined })}
          placeholder="Năm"
          className="w-24"
        />

        <Select
          value={searchParams.get("sort") ?? SORT_OPTIONS[0].value}
          onValueChange={(v) => updateParams({ sort: v as string })}
        >
          <SelectTrigger className="w-fit">
            <SelectValue>{(v: string) => SORT_LABELS[v] ?? "Sắp xếp"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters ? (
          <Button variant="ghost" size="sm" onClick={() => router.push(pathname)}>
            <X className="size-3.5" />
            Xoá bộ lọc
          </Button>
        ) : null}
      </div>
    </div>
  );
}
