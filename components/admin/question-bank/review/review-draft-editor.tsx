"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Loader2,
  Plus,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TopicSelect } from "@/components/admin/question-bank/topic-select";
import { TagInput } from "@/components/admin/question-bank/tag-input";
import { AIConfidenceBadge } from "./confidence-badge";
import {
  COGNITIVE_LEVEL_LABELS,
  COGNITIVE_LEVELS,
  DIFFICULTY_LABELS,
  DIFFICULTY_OPTIONS,
  QUESTION_TYPE_LABELS,
  QUESTION_TYPE_OPTIONS,
  optionLabelForIndex,
} from "@/lib/constants/question-bank";
import type { Difficulty, QuestionType } from "@/lib/generated/prisma/enums";
import type { DraftParsedContent, DraftReviewData } from "@/server/services/importDraftContent";

export interface ReviewDraftItem {
  id: string;
  rawText: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  parsedContent: unknown;
  updatedAt: string | Date;
  suggestedSubjectId: string | null;
  suggestedTopicId: string | null;
  suggestedDifficulty: Difficulty | null;
  suggestedSubject: { id: string; name: string } | null;
  suggestedTopic: { id: string; name: string } | null;
  approvedQuestionId: string | null;
}

interface OptionState {
  id?: string;
  label: string;
  text: string;
  isCorrect: boolean;
}

function defaultReview(type: QuestionType = "SINGLE_CHOICE"): DraftReviewData {
  return {
    questionText: "",
    questionType: type,
    options:
      type === "TRUE_FALSE"
        ? [
            { label: "A", text: "Đúng", isCorrect: true },
            { label: "B", text: "Sai", isCorrect: false },
          ]
        : type === "SHORT_ANSWER"
          ? []
          : [
              { label: "A", text: "", isCorrect: false },
              { label: "B", text: "", isCorrect: false },
            ],
    correctAnswerText: null,
    explanation: null,
    cognitiveLevel: null,
    tags: [],
    savedAt: null,
  };
}

export function ReviewDraftEditor({
  jobId,
  draft,
  order,
  subjects,
  onChanged,
}: {
  jobId: string;
  draft: ReviewDraftItem;
  order: number;
  subjects: { id: string; name: string }[];
  onChanged: () => void;
}) {
  const content = draft.parsedContent as DraftParsedContent;
  const initialReview = content.review ?? defaultReview();
  const aiExtraction = content.aiExtraction;

  const [questionText, setQuestionText] = useState(initialReview.questionText);
  const [questionType, setQuestionType] = useState<QuestionType>(
    initialReview.questionType ?? "SINGLE_CHOICE",
  );
  const [options, setOptions] = useState<OptionState[]>(initialReview.options);
  const [correctAnswerText, setCorrectAnswerText] = useState(initialReview.correctAnswerText ?? "");
  const [explanation, setExplanation] = useState(initialReview.explanation ?? "");
  const [cognitiveLevel, setCognitiveLevel] = useState(initialReview.cognitiveLevel ?? "");
  const [tags, setTags] = useState<string[]>(initialReview.tags);
  const [subjectId, setSubjectId] = useState(draft.suggestedSubjectId ?? "");
  const [topicId, setTopicId] = useState<string | undefined>(draft.suggestedTopicId ?? undefined);
  const [difficulty, setDifficulty] = useState<Difficulty | "">(draft.suggestedDifficulty ?? "");

  const [busy, setBusy] = useState<"save" | "approve" | "reject" | "extract" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [duplicates, setDuplicates] = useState<{ id: string; content: string }[] | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const isApproved = draft.status === "APPROVED";
  const isRejected = draft.status === "REJECTED";
  const isLocked = isApproved || isRejected;

  function handleTypeChange(next: string | null) {
    if (!next) return;
    const nextType = next as QuestionType;
    setQuestionType(nextType);
    if (nextType === "TRUE_FALSE") {
      setOptions([
        { label: "A", text: "Đúng", isCorrect: true },
        { label: "B", text: "Sai", isCorrect: false },
      ]);
    } else if (nextType === "SHORT_ANSWER") {
      setOptions([]);
    } else if (options.length < 2) {
      setOptions([
        { label: "A", text: "", isCorrect: false },
        { label: "B", text: "", isCorrect: false },
      ]);
    }
  }

  function addOption() {
    setOptions((prev) => [...prev, { label: optionLabelForIndex(prev.length), text: "", isCorrect: false }]);
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
  function updateOptionText(index: number, text: string) {
    setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, text } : o)));
  }
  function setSingleCorrect(index: number) {
    setOptions((prev) => prev.map((o, i) => ({ ...o, isCorrect: i === index })));
  }
  function toggleMultipleCorrect(index: number) {
    setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, isCorrect: !o.isCorrect } : o)));
  }

  function buildPayload() {
    return {
      questionText,
      questionType,
      options: options.map((o, i) => ({
        id: o.id,
        label: optionLabelForIndex(i),
        text: o.text,
        isCorrect: o.isCorrect,
      })),
      correctAnswerText: questionType === "SHORT_ANSWER" ? correctAnswerText || null : null,
      explanation: explanation || null,
      cognitiveLevel: cognitiveLevel || null,
      tags,
      subjectId: subjectId || null,
      topicId: topicId || null,
      difficulty: difficulty || null,
    };
  }

  async function handleSave() {
    setBusy("save");
    setError(null);
    setFieldErrors({});
    try {
      const res = await fetch(`/api/admin/question-imports/${jobId}/drafts/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Không thể lưu.");
        setFieldErrors(body.fieldErrors ?? {});
        return;
      }
      onChanged();
    } catch {
      setError("Có lỗi xảy ra khi lưu.");
    } finally {
      setBusy(null);
    }
  }

  async function handleExtract() {
    setBusy("extract");
    setError(null);
    try {
      const res = await fetch(`/api/admin/question-imports/${jobId}/extract/${draft.id}`, {
        method: "POST",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Không thể phân tích bằng AI.");
        return;
      }
      onChanged();
    } catch {
      setError("Có lỗi xảy ra khi gọi AI.");
    } finally {
      setBusy(null);
    }
  }

  async function checkDuplicates() {
    try {
      const res = await fetch(`/api/admin/question-imports/${jobId}/drafts/${draft.id}/duplicates`);
      if (res.ok) {
        const body = await res.json();
        setDuplicates(body.matches ?? []);
      }
    } catch {
      // Cảnh báo trùng lặp chỉ mang tính tham khảo — lỗi ở đây không chặn luồng approve.
    }
  }

  async function handleApprove() {
    setBusy("approve");
    setError(null);
    setFieldErrors({});
    try {
      const saveRes = await fetch(`/api/admin/question-imports/${jobId}/drafts/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      if (!saveRes.ok) {
        const body = await saveRes.json().catch(() => ({}));
        setError(body.error ?? "Không thể lưu trước khi phê duyệt.");
        setFieldErrors(body.fieldErrors ?? {});
        return;
      }

      const res = await fetch(`/api/admin/question-imports/${jobId}/drafts/${draft.id}/approve`, {
        method: "POST",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Không thể phê duyệt.");
        setFieldErrors(body.fieldErrors ?? {});
        return;
      }
      onChanged();
    } catch {
      setError("Có lỗi xảy ra khi phê duyệt.");
    } finally {
      setBusy(null);
    }
  }

  async function handleReject() {
    setBusy("reject");
    setError(null);
    try {
      const res = await fetch(`/api/admin/question-imports/${jobId}/drafts/${draft.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason || undefined }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Không thể từ chối.");
        return;
      }
      setShowRejectDialog(false);
      onChanged();
    } catch {
      setError("Có lỗi xảy ra.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-muted-foreground text-xs font-medium">Draft #{order}</p>
      {isApproved ? (
        <Alert>
          <CheckCircle2 className="size-4" />
          <AlertDescription>Câu hỏi này đã được phê duyệt và thêm vào Ngân hàng câu hỏi.</AlertDescription>
        </Alert>
      ) : null}
      {isRejected ? (
        <Alert variant="destructive">
          <AlertDescription>
            Câu hỏi này đã bị từ chối{content.rejectReason ? `: ${content.rejectReason}` : "."}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {aiExtraction?.status === "DONE" && aiExtraction.result ? (
            <AIConfidenceBadge confidence={aiExtraction.result.confidence} />
          ) : null}
          {aiExtraction?.status === "FAILED" ? (
            <Alert variant="destructive" className="py-1.5">
              <AlertDescription className="text-xs">
                Phân tích AI thất bại: {aiExtraction.errorMessage}
              </AlertDescription>
            </Alert>
          ) : null}
        </div>
        {!isLocked ? (
          <Button variant="outline" size="sm" onClick={handleExtract} disabled={busy !== null}>
            {busy === "extract" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            {aiExtraction ? "Phân tích lại" : "Phân tích bằng AI"}
          </Button>
        ) : null}
      </div>

      {aiExtraction?.result?.warnings && aiExtraction.result.warnings.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {aiExtraction.result.warnings.map((warning, i) => (
            <Alert key={i} className="py-2">
              <AlertTriangle className="size-3.5" />
              <AlertDescription className="text-xs">{warning}</AlertDescription>
            </Alert>
          ))}
        </div>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <fieldset disabled={isLocked} className="flex flex-col gap-5 disabled:opacity-60">
        <div className="flex flex-col gap-2">
          <Label>Nội dung câu hỏi</Label>
          <Textarea value={questionText} onChange={(e) => setQuestionText(e.target.value)} rows={4} />
          {fieldErrors.content ? <p className="text-destructive text-xs">{fieldErrors.content}</p> : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label>Loại câu hỏi</Label>
          <Select value={questionType} onValueChange={handleTypeChange}>
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

        {(questionType === "SINGLE_CHOICE" || questionType === "MULTIPLE_CHOICE") && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label>Đáp án</Label>
              <Button type="button" variant="outline" size="sm" onClick={addOption}>
                <Plus className="size-3.5" />
                Thêm đáp án
              </Button>
            </div>
            {questionType === "SINGLE_CHOICE" ? (
              <RadioGroup
                value={String(options.findIndex((o) => o.isCorrect))}
                onValueChange={(v) => setSingleCorrect(Number(v))}
                className="gap-2"
              >
                {options.map((option, index) => (
                  <OptionRow key={index}>
                    <RadioGroupItem value={String(index)} />
                    <Input
                      value={option.text}
                      onChange={(e) => updateOptionText(index, e.target.value)}
                      placeholder={`Đáp án ${optionLabelForIndex(index)}`}
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
                  <OptionRow key={index}>
                    <Checkbox checked={option.isCorrect} onCheckedChange={() => toggleMultipleCorrect(index)} />
                    <Input
                      value={option.text}
                      onChange={(e) => updateOptionText(index, e.target.value)}
                      placeholder={`Đáp án ${optionLabelForIndex(index)}`}
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

        {questionType === "TRUE_FALSE" && (
          <div className="flex flex-col gap-2">
            <Label>Đáp án đúng</Label>
            <RadioGroup
              value={String(options.findIndex((o) => o.isCorrect))}
              onValueChange={(v) => setSingleCorrect(Number(v))}
              className="gap-2"
            >
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="0" /> Đúng
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="1" /> Sai
              </label>
            </RadioGroup>
          </div>
        )}

        {questionType === "SHORT_ANSWER" && (
          <div className="flex flex-col gap-2">
            <Label>Đáp án đúng</Label>
            <Input value={correctAnswerText} onChange={(e) => setCorrectAnswerText(e.target.value)} />
            {fieldErrors.correctAnswerText ? (
              <p className="text-destructive text-xs">{fieldErrors.correctAnswerText}</p>
            ) : null}
          </div>
        )}

        <Separator />

        <div className="flex flex-col gap-2">
          <Label>Giải thích đáp án</Label>
          <Textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={3} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label>Môn học</Label>
            <Select
              value={subjectId}
              onValueChange={(v) => {
                if (!v) return;
                setSubjectId(v);
                setTopicId(undefined);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue>{(v: string) => subjects.find((s) => s.id === v)?.name ?? "Chọn môn học"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {draft.suggestedSubject && !subjectId ? (
              <p className="text-muted-foreground text-xs">AI đề xuất: {draft.suggestedSubject.name}</p>
            ) : null}
            {fieldErrors.subjectId ? <p className="text-destructive text-xs">{fieldErrors.subjectId}</p> : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label>Chủ đề</Label>
            <TopicSelect subjectId={subjectId || undefined} value={topicId} onChange={setTopicId} />
            {fieldErrors.topicId ? <p className="text-destructive text-xs">{fieldErrors.topicId}</p> : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label>Độ khó</Label>
            <Select value={difficulty} onValueChange={(v) => setDifficulty((v as Difficulty) || "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Chọn độ khó">
                  {(v: Difficulty) => DIFFICULTY_LABELS[v]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {DIFFICULTY_OPTIONS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {DIFFICULTY_LABELS[d]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.difficulty ? <p className="text-destructive text-xs">{fieldErrors.difficulty}</p> : null}
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
        </div>

        <div className="flex flex-col gap-2">
          <Label>Tags</Label>
          <TagInput tags={tags} onChange={setTags} />
        </div>
      </fieldset>

      {!isLocked ? (
        <>
          <Separator />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
              <AlertDialogTrigger render={<Button variant="ghost" disabled={busy !== null} />}>
                <ThumbsDown className="size-4" />
                Từ chối
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Từ chối câu hỏi này?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Câu hỏi sẽ không được thêm vào Ngân hàng câu hỏi. Bạn có thể ghi lý do (không bắt buộc).
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Vd: AI đọc sai câu hỏi, File lỗi, Câu không phù hợp, Duplicate question..."
                  rows={3}
                />
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={busy !== null}>Huỷ</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={handleReject} disabled={busy !== null}>
                    {busy === "reject" ? <Loader2 className="size-4 animate-spin" /> : null}
                    Từ chối
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleSave} disabled={busy !== null}>
                {busy === "save" ? <Loader2 className="size-4 animate-spin" /> : null}
                Lưu bản nháp
              </Button>

              <AlertDialog onOpenChange={(open) => open && checkDuplicates()}>
                <AlertDialogTrigger render={<Button disabled={busy !== null} />}>
                  <ThumbsUp className="size-4" />
                  Phê duyệt & thêm vào ngân hàng câu hỏi
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Phê duyệt câu hỏi này?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Hệ thống sẽ lưu các chỉnh sửa hiện tại và tạo một câu hỏi thật trong Ngân hàng câu hỏi.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  {duplicates && duplicates.length > 0 ? (
                    <Alert>
                      <AlertTriangle className="size-4" />
                      <AlertDescription>
                        Có thể câu hỏi đã tồn tại trong Ngân hàng câu hỏi ({duplicates.length} câu tương tự). Bạn vẫn
                        có thể tiếp tục phê duyệt nếu chắc chắn đây không phải trùng lặp.
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={busy !== null}>Huỷ</AlertDialogCancel>
                    <AlertDialogAction onClick={handleApprove} disabled={busy !== null}>
                      {busy === "approve" ? <Loader2 className="size-4 animate-spin" /> : null}
                      Phê duyệt
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function OptionRow({ children }: { children: React.ReactNode }) {
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
      <Button type="button" variant="ghost" size="icon-sm" disabled={index === 0} onClick={() => onMove(index, -1)}>
        <ArrowUp className="size-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={index === total - 1}
        onClick={() => onMove(index, 1)}
      >
        <ArrowDown className="size-3.5" />
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" disabled={total <= 2} onClick={() => onRemove(index)}>
        <Trash2 className="text-destructive size-3.5" />
      </Button>
    </div>
  );
}
