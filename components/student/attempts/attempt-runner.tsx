"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, List, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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
import type { AttemptDetail } from "@/server/services/studentAttemptService";
import { QuestionNavigatorGrid } from "./question-navigator";
import { QuestionPanel, type QuestionAnswerState, type SaveState } from "./question-panel";
import { ResultSummary, type AttemptResultSummary } from "./result-summary";
import { CountdownDisplay } from "./countdown-display";
import { buildAnswerPayload, countAnswered, createSaveSequencer, isAnswered, pickCurrentIndex } from "./attempt-runner-logic";

export function AttemptRunner({ initial }: { initial: AttemptDetail }) {
  const router = useRouter();
  const isLocked = initial.status !== "IN_PROGRESS";
  const questions = initial.snapshot.questions;

  const [answers, setAnswers] = useState(() => {
    const map = new Map<string, QuestionAnswerState>();
    for (const q of questions) map.set(q.questionId, { selectedOptionIds: [], answerText: null });
    for (const a of initial.answers) {
      map.set(a.questionId, { selectedOptionIds: a.selectedOptionIds, answerText: a.answerText });
    }
    return map;
  });
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [saveErrors, setSaveErrors] = useState<Record<string, string | null>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [autoSubmitting, setAutoSubmitting] = useState(false);
  const [result, setResult] = useState<AttemptResultSummary | null>(null);

  const saveSequencerRef = useRef(createSaveSequencer());
  const questionElementsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const intersectingRef = useRef<Set<number>>(new Set());

  // Scroll-spy: câu "current" trong navigator luôn theo đúng câu Student
  // đang thực sự xem trên màn hình (mục 20) — không cần thư viện, chỉ một
  // IntersectionObserver dùng chung cho toàn bộ câu hỏi.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const idxAttr = (entry.target as HTMLElement).dataset.questionIndex;
          const idx = idxAttr ? Number(idxAttr) : NaN;
          if (Number.isNaN(idx)) continue;
          if (entry.isIntersecting) intersectingRef.current.add(idx);
          else intersectingRef.current.delete(idx);
        }
        setCurrentIndex((prev) => pickCurrentIndex([...intersectingRef.current], prev));
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0 },
    );
    questionElementsRef.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [questions.length]);

  useEffect(() => {
    if (!isLocked) return;
    let cancelled = false;
    fetch(`/api/student/attempts/${initial.id}/result`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!cancelled && body?.result) setResult(body.result);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocked]);

  // clockOffset neo vào serverNow lúc load — countdown hiển thị dựa trên đồng
  // hồ server, không phải đồng hồ máy Student (mục 16, kế thừa nguyên vẹn
  // kiến trúc Phase 9A — không tạo timer logic mới).
  const [clockOffsetMs] = useState(() => new Date(initial.serverNow).getTime() - Date.now());
  const deadlineMs = initial.deadline ? new Date(initial.deadline).getTime() : null;
  const [remainingMs, setRemainingMs] = useState<number | null>(() =>
    deadlineMs !== null ? deadlineMs - Date.now() - clockOffsetMs : null,
  );
  const autoSubmitTriggered = useRef(false);

  useEffect(() => {
    if (deadlineMs === null || isLocked) return;
    const interval = setInterval(() => {
      const remaining = deadlineMs - Date.now() - clockOffsetMs;
      setRemainingMs(remaining);
      if (remaining <= 0 && !autoSubmitTriggered.current) {
        autoSubmitTriggered.current = true;
        setAutoSubmitting(true);
        // Hết giờ theo đồng hồ hiển thị — KHÔNG tự coi là đã nộp. Server mới
        // là nơi quyết định SUBMITTED hay AUTO_SUBMITTED thật sự.
        fetch(`/api/student/attempts/${initial.id}/submit`, { method: "POST" }).finally(() => router.refresh());
      }
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadlineMs, isLocked]);

  const performSave = useCallback(
    async (questionId: string, payload: unknown) => {
      const sequencer = saveSequencerRef.current;
      const seq = sequencer.next(questionId);
      const isLatest = () => sequencer.isLatest(questionId, seq);

      setSaveStates((prev) => ({ ...prev, [questionId]: "saving" }));
      setSaveErrors((prev) => ({ ...prev, [questionId]: null }));

      try {
        const res = await fetch(`/api/student/attempts/${initial.id}/answers/${questionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!isLatest()) return; // response cũ của một lần lưu đã bị thay thế — bỏ qua (mục 9)

        if (res.status === 409) {
          // Bài đã bị nộp/hết hạn ở phía server — chuyển ngay sang locked
          // state thay vì báo lỗi lưu chung chung (mục 15/22).
          router.refresh();
          return;
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setSaveStates((prev) => ({ ...prev, [questionId]: "error" }));
          setSaveErrors((prev) => ({ ...prev, [questionId]: body.error ?? "Chưa lưu — thử lại." }));
          return;
        }
        setSaveStates((prev) => ({ ...prev, [questionId]: "saved" }));
      } catch {
        if (!isLatest()) return;
        setSaveStates((prev) => ({ ...prev, [questionId]: "error" }));
        setSaveErrors((prev) => ({ ...prev, [questionId]: "Không thể lưu câu trả lời. Vui lòng kiểm tra kết nối." }));
      }
    },
    [initial.id, router],
  );

  function setSingleChoice(questionId: string, optionId: string) {
    if (isLocked) return;
    setAnswers((prev) => new Map(prev).set(questionId, { selectedOptionIds: [optionId], answerText: null }));
    performSave(questionId, { selectedOptionId: optionId });
  }

  function toggleMultipleChoice(questionId: string, optionId: string) {
    if (isLocked) return;
    const current = answers.get(questionId)?.selectedOptionIds ?? [];
    const next = current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId];
    setAnswers((prev) => new Map(prev).set(questionId, { selectedOptionIds: next, answerText: null }));
    performSave(questionId, { selectedOptionIds: next });
  }

  function setShortAnswerText(questionId: string, text: string) {
    if (isLocked) return;
    // Không autosave mỗi keystroke — SHORT_ANSWER chỉ lưu khi Student bấm
    // "Gửi câu trả lời" (mục 11/22), tránh PATCH liên tục không cần thiết.
    setAnswers((prev) => new Map(prev).set(questionId, { selectedOptionIds: [], answerText: text }));
  }

  function explicitSave(questionId: string) {
    const state = answers.get(questionId);
    const question = questions.find((q) => q.questionId === questionId);
    if (!state || !question) return;
    performSave(questionId, buildAnswerPayload(question.type, state));
  }

  function registerQuestionRef(questionId: string) {
    return (el: HTMLDivElement | null) => {
      if (el) questionElementsRef.current.set(questionId, el);
      else questionElementsRef.current.delete(questionId);
    };
  }

  function scrollToQuestion(index: number) {
    const question = questions[index];
    setCurrentIndex(index);
    setMobileNavOpen(false);
    if (!question) return;
    questionElementsRef.current.get(question.questionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/student/attempts/${initial.id}/submit`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(body.error ?? "Không thể nộp bài.");
        return;
      }
      router.refresh();
    } catch {
      setSubmitError("Có lỗi xảy ra khi nộp bài. Vui lòng kiểm tra kết nối và thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  const questionIds = questions.map((q) => q.questionId);
  const answeredCount = countAnswered(questionIds, answers);
  const unansweredCount = questions.length - answeredCount;
  const navItems = questions.map((q) => ({ questionId: q.questionId, answered: isAnswered(answers.get(q.questionId)) }));

  const saveStateValues = Object.values(saveStates);
  const autosaveLabel = saveStateValues.includes("saving")
    ? "Đang lưu..."
    : saveStateValues.includes("error")
      ? "Có lỗi lưu"
      : answeredCount > 0
        ? "Đã lưu"
        : "";

  return (
    <div className="flex flex-col gap-4 pb-16">
      {/* Header — sticky, không phải dashboard card (mục 3/24) */}
      <div className="bg-background/95 border-border sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b px-1 py-3 backdrop-blur">
        <div>
          <h1 className="text-base font-bold">{initial.exam?.title ?? "Bài làm"}</h1>
          <p className="text-muted-foreground text-xs">
            Lần làm bài #{initial.attemptNumber} · Đã trả lời {answeredCount}/{questions.length}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CountdownDisplay remainingMs={isLocked ? null : remainingMs} />
          {!isLocked && autosaveLabel ? (
            <span
              className={autosaveLabel === "Có lỗi lưu" ? "text-destructive text-xs" : "text-muted-foreground text-xs"}
              role="status"
            >
              {autosaveLabel}
            </span>
          ) : null}
          {isLocked ? (
            <Alert className="w-fit py-1.5">
              <CheckCircle2 className="size-4" />
              <AlertDescription>Đã nộp bài.</AlertDescription>
            </Alert>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger render={<Button disabled={submitting || autoSubmitting} />}>
                {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                Nộp bài
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Bạn có chắc chắn muốn nộp bài?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {unansweredCount > 0
                      ? `Bạn còn ${unansweredCount} câu chưa trả lời. `
                      : "Bạn đã trả lời tất cả các câu. "}
                    Sau khi nộp, bạn sẽ không thể thay đổi câu trả lời nữa.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={submitting}>Huỷ</AlertDialogCancel>
                  <AlertDialogAction onClick={handleSubmit} disabled={submitting}>
                    {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                    Nộp bài
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {autoSubmitting && !isLocked ? (
        <Alert>
          <Loader2 className="size-4 animate-spin" />
          <AlertDescription>Đã hết thời gian. Bài làm đang được nộp...</AlertDescription>
        </Alert>
      ) : null}

      {isLocked && result ? <ResultSummary result={result} /> : null}

      {submitError ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      ) : null}

      {/* Mobile: navigator dạng drawer thay vì ép 2 cột (mục 18) */}
      <div className="md:hidden">
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetTrigger
            render={<Button variant="outline" size="sm" className="w-full justify-start" />}
          >
            <List className="size-4" />
            Câu hỏi 1–{questions.length} · Đã trả lời {answeredCount}/{questions.length}
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Danh sách câu hỏi</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-4">
              <QuestionNavigatorGrid items={navItems} currentIndex={currentIndex} onSelect={scrollToQuestion} />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[14rem_1fr] lg:grid-cols-[16rem_1fr]">
        {/* Desktop/tablet: navigator sticky bên trái (mục 4/17/19) */}
        <div className="hidden md:block">
          <div className="bg-card border-border sticky top-24 rounded-xl border p-4">
            <QuestionNavigatorGrid items={navItems} currentIndex={currentIndex} onSelect={scrollToQuestion} />
          </div>
        </div>

        {/* Câu hỏi liên tục theo chiều dọc (mục 5) */}
        <div className="flex flex-col gap-4">
          {questions.map((question, index) => (
            <QuestionPanel
              key={question.questionId}
              question={question}
              index={index}
              total={questions.length}
              answer={answers.get(question.questionId) ?? { selectedOptionIds: [], answerText: null }}
              saveState={isLocked ? "idle" : (saveStates[question.questionId] ?? "idle")}
              saveError={saveErrors[question.questionId] ?? null}
              disabled={isLocked}
              isCurrent={index === currentIndex}
              registerRef={registerQuestionRef(question.questionId)}
              onSingleChoiceChange={(optionId) => setSingleChoice(question.questionId, optionId)}
              onMultipleChoiceToggle={(optionId) => toggleMultipleChoice(question.questionId, optionId)}
              onShortAnswerChange={(text) => setShortAnswerText(question.questionId, text)}
              onExplicitSave={() => explicitSave(question.questionId)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
