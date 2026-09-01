"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TopicSelect } from "./topic-select";
import { QuestionPreview } from "./question-preview";
import {
  COGNITIVE_LEVEL_LABELS,
  COGNITIVE_LEVELS,
  DIFFICULTY_LABELS,
  DIFFICULTY_OPTIONS,
  QUESTION_STATUS_LABELS,
  QUESTION_STATUS_OPTIONS,
  QUESTION_TYPE_LABELS,
  QUESTION_TYPE_OPTIONS,
  optionLabelForIndex,
} from "@/lib/constants/question-bank";
import type { Difficulty, QuestionStatus, QuestionType } from "@/lib/generated/prisma/enums";

interface OptionState {
  id?: string;
  content: string;
  isCorrect: boolean;
}

export interface QuestionFormInitialData {
  content: string;
  type: QuestionType;
  subjectId: string;
  topicId: string;
  difficulty: Difficulty;
  cognitiveLevel: string | null;
  hint: string | null;
  explanation: string | null;
  source: string | null;
  year: number | null;
  tags: string[];
  status: QuestionStatus;
  correctAnswerText: string | null;
  options: { id: string; content: string; isCorrect: boolean }[];
}

function deriveTrueFalseAnswer(initialData?: QuestionFormInitialData): "TRUE" | "FALSE" | "" {
  if (!initialData || initialData.type !== "TRUE_FALSE") return "";
  const correct = initialData.options.find((o) => o.isCorrect);
  if (!correct) return "";
  return correct.content === "Đúng" ? "TRUE" : "FALSE";
}

function defaultOptions(initialData?: QuestionFormInitialData): OptionState[] {
  if (initialData && (initialData.type === "SINGLE_CHOICE" || initialData.type === "MULTIPLE_CHOICE")) {
    return initialData.options.map((o) => ({ id: o.id, content: o.content, isCorrect: o.isCorrect }));
  }
  return [
    { content: "", isCorrect: false },
    { content: "", isCorrect: false },
  ];
}

export function QuestionForm({
  mode,
  questionId,
  subjects,
  initialData,
}: {
  mode: "create" | "edit";
  questionId?: string;
  subjects: { id: string; name: string }[];
  initialData?: QuestionFormInitialData;
}) {
  const router = useRouter();

  const [content, setContent] = useState(initialData?.content ?? "");
  const [type, setType] = useState<QuestionType>(initialData?.type ?? "SINGLE_CHOICE");
  const [subjectId, setSubjectId] = useState(initialData?.subjectId ?? "");
  const [topicId, setTopicId] = useState<string | undefined>(initialData?.topicId);
  const [topicName, setTopicName] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>(initialData?.difficulty ?? "EASY");
  const [cognitiveLevel, setCognitiveLevel] = useState(initialData?.cognitiveLevel ?? "");
  const [hint, setHint] = useState(initialData?.hint ?? "");
  const [explanation, setExplanation] = useState(initialData?.explanation ?? "");
  const [source, setSource] = useState(initialData?.source ?? "");
  const [year, setYear] = useState(initialData?.year ? String(initialData.year) : "");
  const [tags, setTags] = useState<string[]>(initialData?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [status, setStatus] = useState<QuestionStatus>(initialData?.status ?? "DRAFT");
  const [correctAnswerText, setCorrectAnswerText] = useState(initialData?.correctAnswerText ?? "");
  const [trueFalseAnswer, setTrueFalseAnswer] = useState<"TRUE" | "FALSE" | "">(
    deriveTrueFalseAnswer(initialData),
  );
  const [options, setOptions] = useState<OptionState[]>(defaultOptions(initialData));

  const [showPreview, setShowPreview] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleTypeChange(next: string | null) {
    if (!next) return;
    const nextType = next as QuestionType;
    setType(nextType);
    if ((nextType === "SINGLE_CHOICE" || nextType === "MULTIPLE_CHOICE") && options.length < 2) {
      setOptions([
        { content: "", isCorrect: false },
        { content: "", isCorrect: false },
      ]);
    }
  }

  function handleSubjectChange(next: string | null) {
    if (!next) return;
    setSubjectId(next);
    setTopicId(undefined);
    setTopicName(null);
  }

  function addOption() {
    setOptions((prev) => [...prev, { content: "", isCorrect: false }]);
  }

  function removeOption(index: number) {
    setOptions((prev) => prev.filter((_, i) => i !== index));
  }

  function moveOption(index: number, direction: -1 | 1) {
    setOptions((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function updateOptionContent(index: number, value: string) {
    setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, content: value } : o)));
  }

  function setSingleCorrect(index: number) {
    setOptions((prev) => prev.map((o, i) => ({ ...o, isCorrect: i === index })));
  }

  function toggleMultipleCorrect(index: number) {
    setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, isCorrect: !o.isCorrect } : o)));
  }

  function handleTagKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      const value = tagInput.trim();
      if (value && !tags.includes(value)) setTags((prev) => [...prev, value]);
      setTagInput("");
    } else if (event.key === "Backspace" && tagInput === "" && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1));
    }
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    const payload = {
      content,
      type,
      subjectId,
      topicId,
      difficulty,
      cognitiveLevel: cognitiveLevel || undefined,
      hint: hint || undefined,
      explanation: explanation || undefined,
      source: source || undefined,
      year: year || undefined,
      tags,
      status,
      correctAnswerText: type === "SHORT_ANSWER" ? correctAnswerText : undefined,
      trueFalseAnswer: type === "TRUE_FALSE" ? trueFalseAnswer || undefined : undefined,
      options:
        type === "SINGLE_CHOICE" || type === "MULTIPLE_CHOICE"
          ? options.map((o) => ({ id: o.id, content: o.content, isCorrect: o.isCorrect }))
          : [],
    };

    try {
      const url = mode === "create" ? "/api/admin/questions" : `/api/admin/questions/${questionId}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (json.fieldErrors) setFieldErrors(json.fieldErrors);
        setFormError(json.error ?? "Không thể lưu câu hỏi.");
        return;
      }

      router.push("/admin/question-bank");
      router.refresh();
    } catch {
      setFormError("Có lỗi xảy ra, vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  const subjectName = subjects.find((s) => s.id === subjectId)?.name ?? null;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 pb-16">
      {formError ? (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="content">Nội dung câu hỏi</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              placeholder="Nhập nội dung câu hỏi..."
              aria-invalid={Boolean(fieldErrors.content)}
            />
            <p className="text-muted-foreground text-xs">
              Hỗ trợ xuống dòng và văn bản thuần. Công thức toán (LaTeX/KaTeX) sẽ được hỗ trợ ở phase
              sau — kiến trúc nội dung dạng text hiện tại tương thích để nâng cấp không cần đổi schema.
            </p>
            {fieldErrors.content ? <p className="text-destructive text-xs">{fieldErrors.content}</p> : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label>Loại câu hỏi</Label>
            <Select value={type} onValueChange={handleTypeChange}>
              <SelectTrigger className="w-full sm:w-72">
                <SelectValue>{(v: QuestionType) => QUESTION_TYPE_LABELS[v]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {QUESTION_TYPE_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {QUESTION_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {(type === "SINGLE_CHOICE" || type === "MULTIPLE_CHOICE") && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <Label>
                  Đáp án{" "}
                  <span className="text-muted-foreground font-normal">
                    ({type === "SINGLE_CHOICE" ? "chọn đúng 1 đáp án đúng" : "chọn ít nhất 1 đáp án đúng"})
                  </span>
                </Label>
                <Button type="button" variant="outline" size="sm" onClick={addOption}>
                  <Plus className="size-3.5" />
                  Thêm đáp án
                </Button>
              </div>

              {type === "SINGLE_CHOICE" ? (
                <RadioGroup
                  value={String(options.findIndex((o) => o.isCorrect))}
                  onValueChange={(v) => setSingleCorrect(Number(v))}
                  className="gap-2"
                >
                  {options.map((option, index) => (
                    <OptionRow key={index} index={index}>
                      <RadioGroupItem value={String(index)} aria-label={`Đáp án đúng là ${optionLabelForIndex(index)}`} />
                      <Input
                        value={option.content}
                        onChange={(e) => updateOptionContent(index, e.target.value)}
                        placeholder={`Nội dung đáp án ${optionLabelForIndex(index)}`}
                        className="flex-1"
                      />
                      <OptionRowActions
                        index={index}
                        total={options.length}
                        onMove={moveOption}
                        onRemove={removeOption}
                      />
                    </OptionRow>
                  ))}
                </RadioGroup>
              ) : (
                <div className="flex flex-col gap-2">
                  {options.map((option, index) => (
                    <OptionRow key={index} index={index}>
                      <Checkbox
                        checked={option.isCorrect}
                        onCheckedChange={() => toggleMultipleCorrect(index)}
                        aria-label={`Đánh dấu ${optionLabelForIndex(index)} là đáp án đúng`}
                      />
                      <Input
                        value={option.content}
                        onChange={(e) => updateOptionContent(index, e.target.value)}
                        placeholder={`Nội dung đáp án ${optionLabelForIndex(index)}`}
                        className="flex-1"
                      />
                      <OptionRowActions
                        index={index}
                        total={options.length}
                        onMove={moveOption}
                        onRemove={removeOption}
                      />
                    </OptionRow>
                  ))}
                </div>
              )}
              {fieldErrors.options ? <p className="text-destructive text-xs">{fieldErrors.options}</p> : null}
            </div>
          )}

          {type === "TRUE_FALSE" && (
            <div className="flex flex-col gap-2">
              <Label>Đáp án đúng</Label>
              <RadioGroup
                value={trueFalseAnswer}
                onValueChange={(v) => setTrueFalseAnswer(v as "TRUE" | "FALSE")}
                className="gap-2"
              >
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="TRUE" /> Đúng
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="FALSE" /> Sai
                </label>
              </RadioGroup>
              {fieldErrors.trueFalseAnswer ? (
                <p className="text-destructive text-xs">{fieldErrors.trueFalseAnswer}</p>
              ) : null}
            </div>
          )}

          {type === "SHORT_ANSWER" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="correctAnswerText">Đáp án đúng</Label>
              <Input
                id="correctAnswerText"
                value={correctAnswerText}
                onChange={(e) => setCorrectAnswerText(e.target.value)}
                placeholder="Nhập đáp án đúng"
              />
              <p className="text-muted-foreground text-xs">
                Phase 6 chỉ lưu đáp án tham chiếu — logic so khớp câu trả lời tự luận sẽ được xây ở
                Practice Engine (phase sau).
              </p>
              {fieldErrors.correctAnswerText ? (
                <p className="text-destructive text-xs">{fieldErrors.correctAnswerText}</p>
              ) : null}
            </div>
          )}

          <Separator />

          <div className="flex flex-col gap-2">
            <Label htmlFor="hint">Gợi ý (Hint)</Label>
            <Textarea
              id="hint"
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              rows={2}
              placeholder="Chỉ hiển thị ở chế độ Ôn tập, không hiển thị khi Thi thử."
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="explanation">Giải thích đáp án (Explanation)</Label>
            <Textarea
              id="explanation"
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              rows={3}
              placeholder="Học sinh sẽ xem sau khi trả lời hoặc khi xem lại kết quả."
            />
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label>Môn học</Label>
            <Select value={subjectId} onValueChange={handleSubjectChange}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v: string) => subjects.find((s) => s.id === v)?.name ?? "Chọn môn học"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.subjectId ? <p className="text-destructive text-xs">{fieldErrors.subjectId}</p> : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label>Chủ đề</Label>
            <TopicSelect
              subjectId={subjectId || undefined}
              value={topicId}
              onChange={setTopicId}
              onTopicsChange={(topics) => setTopicName(topics.find((t) => t.id === topicId)?.name ?? null)}
            />
            {fieldErrors.topicId ? <p className="text-destructive text-xs">{fieldErrors.topicId}</p> : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label>Độ khó</Label>
            <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
              <SelectTrigger className="w-full">
                <SelectValue>{(v: Difficulty) => DIFFICULTY_LABELS[v]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {DIFFICULTY_OPTIONS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {DIFFICULTY_LABELS[d]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Mức độ tư duy</Label>
            <Select
              value={cognitiveLevel || "__none__"}
              onValueChange={(v) => setCognitiveLevel(!v || v === "__none__" ? "" : v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v: string) => (v === "__none__" ? "Không chọn" : COGNITIVE_LEVEL_LABELS[v])}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Không chọn</SelectItem>
                {COGNITIVE_LEVELS.map((level) => (
                  <SelectItem key={level.value} value={level.value}>
                    {level.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Trạng thái</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as QuestionStatus)}>
              <SelectTrigger className="w-full">
                <SelectValue>{(v: QuestionStatus) => QUESTION_STATUS_LABELS[v]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {QUESTION_STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {QUESTION_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="source">Nguồn</Label>
              <Input
                id="source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="Đề thi ĐGNL 2025"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="year">Năm</Label>
              <Input
                id="year"
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="2025"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="tags">Tags</Label>
            <div className="border-input flex flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="bg-secondary text-secondary-foreground flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                >
                  {tag}
                  <button type="button" onClick={() => removeTag(tag)} aria-label={`Xoá tag ${tag}`}>
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              <input
                id="tags"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder={tags.length === 0 ? "Nhập tag rồi Enter" : ""}
                className="min-w-24 flex-1 bg-transparent text-sm outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      <Separator />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={() => setShowPreview((v) => !v)}>
          {showPreview ? "Ẩn xem trước" : "Xem trước"}
        </Button>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" onClick={() => router.push("/admin/question-bank")}>
            Huỷ
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {mode === "create" ? "Tạo câu hỏi" : "Lưu thay đổi"}
          </Button>
        </div>
      </div>

      {showPreview ? (
        <QuestionPreview
          question={{
            content: content || "(chưa nhập nội dung)",
            type,
            difficulty,
            subjectName,
            topicName,
            correctAnswerText: correctAnswerText || null,
            hint: hint || null,
            explanation: explanation || null,
            options:
              type === "TRUE_FALSE"
                ? [
                    { id: "tf-true", label: "A", content: "Đúng", isCorrect: trueFalseAnswer === "TRUE" },
                    { id: "tf-false", label: "B", content: "Sai", isCorrect: trueFalseAnswer === "FALSE" },
                  ]
                : options.map((o, index) => ({
                    id: o.id ?? `new-${index}`,
                    label: optionLabelForIndex(index),
                    content: o.content || `(đáp án ${optionLabelForIndex(index)})`,
                    isCorrect: o.isCorrect,
                  })),
          }}
        />
      ) : null}
    </form>
  );
}

function OptionRow({ children }: { index: number; children: React.ReactNode }) {
  return <div className="flex items-center gap-2">{children}</div>;
}

function OptionRowActions({
  index,
  total,
  onMove,
  onRemove,
}: {
  index: number;
  total: number;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={index === 0}
        onClick={() => onMove(index, -1)}
        aria-label="Di chuyển lên"
      >
        <ArrowUp className="size-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={index === total - 1}
        onClick={() => onMove(index, 1)}
        aria-label="Di chuyển xuống"
      >
        <ArrowDown className="size-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={total <= 2}
        onClick={() => onRemove(index)}
        aria-label="Xoá đáp án"
      >
        <Trash2 className="text-destructive size-3.5" />
      </Button>
    </div>
  );
}
