"use client";

import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TopicOption {
  id: string;
  name: string;
}

const ALL_VALUE = "__all__";

/**
 * Dropdown Topic phụ thuộc Subject — dùng chung cho cả filter (list) và form
 * (create/edit), fetch qua GET /api/admin/topics?subjectId= mỗi khi subjectId
 * đổi, không cho chọn Topic thuộc Subject khác.
 */
export function TopicSelect({
  subjectId,
  value,
  onChange,
  allowAll = false,
  disabled = false,
  onTopicsChange,
}: {
  subjectId: string | undefined;
  value: string | undefined;
  onChange: (topicId: string | undefined) => void;
  allowAll?: boolean;
  disabled?: boolean;
  /** Cho component cha (vd form preview) biết danh sách topic vừa tải, để lấy tên hiển thị mà không phải fetch trùng lặp. */
  onTopicsChange?: (topics: TopicOption[]) => void;
}) {
  const [topics, setTopics] = useState<TopicOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadedForSubjectId, setLoadedForSubjectId] = useState(subjectId);

  // subjectId đổi (kể cả về undefined) → xoá ngay danh sách topic cũ trong
  // cùng lượt render này, không chờ effect chạy — tránh hiển thị nhầm topic
  // của môn học trước đó trong lúc effect bên dưới đang fetch dữ liệu mới.
  // Chỉ set state của chính component này ở đây — onTopicsChange (callback
  // của component cha) phải gọi trong effect, không được gọi khi đang render
  // vì React cấm cập nhật state của một component khác trong lúc render.
  if (subjectId !== loadedForSubjectId) {
    setLoadedForSubjectId(subjectId);
    setTopics([]);
  }

  useEffect(() => {
    if (!subjectId) {
      onTopicsChange?.([]);
      return;
    }
    let cancelled = false;

    async function loadTopics(currentSubjectId: string) {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/topics?subjectId=${encodeURIComponent(currentSubjectId)}`);
        const data: { topics?: TopicOption[] } = res.ok ? await res.json() : { topics: [] };
        if (!cancelled) {
          setTopics(data.topics ?? []);
          onTopicsChange?.(data.topics ?? []);
        }
      } catch {
        if (!cancelled) setTopics([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadTopics(subjectId);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId]);

  const placeholder = !subjectId
    ? "Chọn môn học trước"
    : loading
      ? "Đang tải chủ đề..."
      : "Chọn chủ đề";

  return (
    <Select
      value={value ?? (allowAll ? ALL_VALUE : "")}
      onValueChange={(next) => onChange(next === ALL_VALUE ? undefined : (next as string))}
      disabled={disabled || !subjectId}
    >
      <SelectTrigger className="w-full">
        <SelectValue>
          {(v: string) =>
            v === ALL_VALUE ? "Tất cả chủ đề" : (topics.find((t) => t.id === v)?.name ?? placeholder)
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {allowAll ? <SelectItem value={ALL_VALUE}>Tất cả chủ đề</SelectItem> : null}
        {topics.map((topic) => (
          <SelectItem key={topic.id} value={topic.id}>
            {topic.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
