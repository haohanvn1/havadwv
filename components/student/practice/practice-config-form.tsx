"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DIFFICULTY_LABELS, DIFFICULTY_OPTIONS, QUESTION_TYPE_LABELS, QUESTION_TYPE_OPTIONS } from "@/lib/constants/question-bank";
import { PRACTICE_QUESTION_COUNTS } from "@/validators/practiceAttempt";
import type { Difficulty, QuestionType } from "@/lib/generated/prisma/enums";
import type { AccessibleSubject } from "@/server/services/subjectAccessService";

const ALL_VALUE = "__all__";

export function PracticeConfigForm({ subjects }: { subjects: AccessibleSubject[] }) {
  const router = useRouter();

  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [topics, setTopics] = useState<{ id: string; name: string }[]>([]);
  const [topicId, setTopicId] = useState<string | undefined>(undefined);
  const [difficulty, setDifficulty] = useState<Difficulty | undefined>(undefined);
  const [questionType, setQuestionType] = useState<QuestionType | undefined>(undefined);
  const [questionCount, setQuestionCount] = useState<number>(20);

  const [eligibleCount, setEligibleCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const requestSeq = useRef(0);

  // subjectId đổi → xoá ngay topic/preview cũ trong cùng lượt render này,
  // không chờ effect chạy — tránh hiển thị nhầm topic/số câu của môn trước
  // đó trong lúc effect bên dưới đang fetch dữ liệu mới (đúng pattern đã
  // dùng ở components/admin/question-bank/topic-select.tsx).
  const [loadedForSubjectId, setLoadedForSubjectId] = useState(subjectId);
  if (subjectId !== loadedForSubjectId) {
    setLoadedForSubjectId(subjectId);
    setTopicId(undefined);
    setTopics([]);
    setEligibleCount(null);
  }

  // Tải Topic mỗi khi đổi Subject.
  useEffect(() => {
    if (!subjectId) return;
    let cancelled = false;
    fetch(`/api/student/practice/topics?subjectId=${subjectId}`)
      .then((res) => (res.ok ? res.json() : { topics: [] }))
      .then((body) => {
        if (!cancelled) setTopics(body.topics ?? []);
      })
      .catch(() => {
        if (!cancelled) setTopics([]);
      });
    return () => {
      cancelled = true;
    };
  }, [subjectId]);

  // Xem trước số câu phù hợp mỗi khi điều kiện đổi (không phụ thuộc questionCount — mục 16).
  useEffect(() => {
    if (!subjectId) return;
    let cancelled = false;
    const seq = ++requestSeq.current;

    async function loadPreview() {
      setPreviewLoading(true);
      setPreviewError(null);
      const params = new URLSearchParams({ subjectId });
      if (topicId) params.set("topicId", topicId);
      if (difficulty) params.set("difficulty", difficulty);
      if (questionType) params.set("questionType", questionType);

      try {
        const res = await fetch(`/api/student/practice/preview?${params.toString()}`);
        const body = await res.json().catch(() => ({}));
        if (cancelled || seq !== requestSeq.current) return;
        if (!res.ok) {
          setPreviewError(body.error ?? "Không thể xem trước.");
          setEligibleCount(null);
          return;
        }
        setEligibleCount(body.preview.eligibleCount);
      } catch {
        if (!cancelled && seq === requestSeq.current) setPreviewError("Có lỗi xảy ra, vui lòng thử lại.");
      } finally {
        if (!cancelled && seq === requestSeq.current) setPreviewLoading(false);
      }
    }

    loadPreview();
    return () => {
      cancelled = true;
    };
  }, [subjectId, topicId, difficulty, questionType]);

  async function handleStart() {
    setStarting(true);
    setStartError(null);
    try {
      const res = await fetch("/api/student/practice/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId, topicId, difficulty, questionType, questionCount }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStartError(body.error ?? "Không thể bắt đầu luyện tập.");
        return;
      }
      router.push(`/student/attempts/${body.attemptId}`);
    } catch {
      setStartError("Có lỗi xảy ra, vui lòng thử lại.");
    } finally {
      setStarting(false);
    }
  }

  if (subjects.length === 0) {
    return (
      <EmptyState
        className="bg-card rounded-3xl"
        title="Bạn chưa được cấp quyền vào môn học nào."
        description="Liên hệ trung tâm để được cấp quyền luyện tập."
      />
    );
  }

  const noMatch = eligibleCount === 0;
  const effectiveCount = eligibleCount != null ? Math.min(questionCount, eligibleCount) : questionCount;

  return (
    <div className="bg-card border-border flex flex-col gap-5 rounded-3xl border p-5 sm:max-w-md">
      <div className="flex flex-col gap-2">
        <Label>Môn</Label>
        <Select value={subjectId} onValueChange={(v) => v && setSubjectId(v as string)}>
          <SelectTrigger className="w-full">
            <SelectValue>{(v: string) => subjects.find((s) => s.id === v)?.name ?? "Chọn môn"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {subjects.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Chủ đề</Label>
        <Select
          value={topicId ?? ALL_VALUE}
          onValueChange={(v) => setTopicId(v === ALL_VALUE ? undefined : (v as string))}
        >
          <SelectTrigger className="w-full">
            <SelectValue>
              {(v: string) => (v === ALL_VALUE ? "Tất cả chủ đề" : (topics.find((t) => t.id === v)?.name ?? "Tất cả chủ đề"))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Tất cả chủ đề</SelectItem>
            {topics.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Độ khó</Label>
        <Select
          value={difficulty ?? ALL_VALUE}
          onValueChange={(v) => setDifficulty(v === ALL_VALUE ? undefined : (v as Difficulty))}
        >
          <SelectTrigger className="w-full">
            <SelectValue>
              {(v: string) => (v === ALL_VALUE ? "Tất cả" : DIFFICULTY_LABELS[v as Difficulty])}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Tất cả</SelectItem>
            {DIFFICULTY_OPTIONS.map((d) => (
              <SelectItem key={d} value={d}>
                {DIFFICULTY_LABELS[d]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Loại câu hỏi</Label>
        <Select
          value={questionType ?? ALL_VALUE}
          onValueChange={(v) => setQuestionType(v === ALL_VALUE ? undefined : (v as QuestionType))}
        >
          <SelectTrigger className="w-full">
            <SelectValue>
              {(v: string) => (v === ALL_VALUE ? "Tất cả" : QUESTION_TYPE_LABELS[v as QuestionType])}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Tất cả</SelectItem>
            {QUESTION_TYPE_OPTIONS.map((t) => (
              <SelectItem key={t} value={t}>
                {QUESTION_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Số câu</Label>
        <Select value={String(questionCount)} onValueChange={(v) => v && setQuestionCount(Number(v))}>
          <SelectTrigger className="w-full">
            <SelectValue>{(v: string) => v}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {PRACTICE_QUESTION_COUNTS.map((c) => (
              <SelectItem key={c} value={String(c)}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {previewError ? (
        <Alert variant="destructive">
          <AlertDescription>{previewError}</AlertDescription>
        </Alert>
      ) : previewLoading ? (
        <p className="text-muted-foreground text-sm">Đang kiểm tra số câu phù hợp...</p>
      ) : eligibleCount != null ? (
        noMatch ? (
          <Alert variant="destructive">
            <AlertDescription>Không có câu hỏi phù hợp với điều kiện bạn chọn.</AlertDescription>
          </Alert>
        ) : (
          <p className="text-sm">
            Có <span className="font-semibold">{eligibleCount}</span> câu phù hợp
            {eligibleCount < questionCount ? ` — bài luyện tập sẽ dùng cả ${effectiveCount} câu.` : "."}
          </p>
        )
      ) : null}

      {startError ? (
        <Alert variant="destructive">
          <AlertDescription>{startError}</AlertDescription>
        </Alert>
      ) : null}

      <Button onClick={handleStart} disabled={starting || noMatch || eligibleCount === null} className="w-fit">
        {starting ? <Loader2 className="size-4 animate-spin" /> : null}
        Bắt đầu luyện tập
      </Button>
    </div>
  );
}
