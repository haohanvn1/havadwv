"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RuleEditor, emptyRule, type RuleState } from "./rule-editor";

const ALL_SUBJECTS = "__all_subjects__";

interface SectionState {
  name: string;
  rules: RuleState[];
}

export interface BlueprintFormInitialData {
  name: string;
  examType: string;
  subjectId: string | null;
  durationMinutes: number | null;
  sections: {
    name: string;
    rules: {
      subjectId: string | null;
      topicId: string | null;
      questionType: string | null;
      difficulty: string | null;
      cognitiveLevel: string | null;
      quantity: number;
    }[];
  }[];
}

function initialSections(data?: BlueprintFormInitialData): SectionState[] {
  if (data && data.sections.length > 0) {
    return data.sections.map((s) => ({
      name: s.name,
      rules: s.rules.map((r) => ({
        subjectId: r.subjectId ?? "",
        topicId: r.topicId ?? "",
        questionType: r.questionType ?? "",
        difficulty: r.difficulty ?? "",
        cognitiveLevel: r.cognitiveLevel ?? "",
        quantity: String(r.quantity),
      })),
    }));
  }
  return [{ name: "Section 1", rules: [emptyRule()] }];
}

export function BlueprintForm({
  mode,
  blueprintId,
  subjects,
  initialData,
}: {
  mode: "create" | "edit";
  blueprintId?: string;
  subjects: { id: string; name: string }[];
  initialData?: BlueprintFormInitialData;
}) {
  const router = useRouter();

  const [name, setName] = useState(initialData?.name ?? "");
  const [examType, setExamType] = useState(initialData?.examType ?? "");
  const [subjectId, setSubjectId] = useState(initialData?.subjectId ?? "");
  const [durationMinutes, setDurationMinutes] = useState(
    initialData?.durationMinutes ? String(initialData.durationMinutes) : "90",
  );
  const [sections, setSections] = useState<SectionState[]>(initialSections(initialData));

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const totalQuestions = sections.reduce(
    (sum, s) => sum + s.rules.reduce((rs, r) => rs + (Number.parseInt(r.quantity, 10) || 0), 0),
    0,
  );

  function updateSectionName(index: number, value: string) {
    setSections((prev) => prev.map((s, i) => (i === index ? { ...s, name: value } : s)));
  }

  function addSection() {
    setSections((prev) => [...prev, { name: `Section ${prev.length + 1}`, rules: [emptyRule()] }]);
  }

  function removeSection(index: number) {
    setSections((prev) => prev.filter((_, i) => i !== index));
  }

  function addRule(sectionIndex: number) {
    setSections((prev) =>
      prev.map((s, i) => (i === sectionIndex ? { ...s, rules: [...s.rules, emptyRule()] } : s)),
    );
  }

  function removeRule(sectionIndex: number, ruleIndex: number) {
    setSections((prev) =>
      prev.map((s, i) => (i === sectionIndex ? { ...s, rules: s.rules.filter((_, r) => r !== ruleIndex) } : s)),
    );
  }

  function updateRule(sectionIndex: number, ruleIndex: number, next: RuleState) {
    setSections((prev) =>
      prev.map((s, i) =>
        i === sectionIndex ? { ...s, rules: s.rules.map((r, ri) => (ri === ruleIndex ? next : r)) } : s,
      ),
    );
  }

  function ruleError(sectionIndex: number, ruleIndex: number): string | undefined {
    const prefix = `sections.${sectionIndex}.rules.${ruleIndex}`;
    const key = Object.keys(fieldErrors).find((k) => k.startsWith(prefix));
    return key ? fieldErrors[key] : undefined;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    const payload = {
      name,
      examType,
      subjectId: subjectId || undefined,
      durationMinutes: durationMinutes || undefined,
      sections: sections.map((s) => ({
        name: s.name,
        rules: s.rules.map((r) => ({
          subjectId: r.subjectId || undefined,
          topicId: r.topicId || undefined,
          questionType: r.questionType || undefined,
          difficulty: r.difficulty || undefined,
          cognitiveLevel: r.cognitiveLevel || undefined,
          quantity: r.quantity,
        })),
      })),
    };

    try {
      const url = mode === "create" ? "/api/admin/exam-blueprints" : `/api/admin/exam-blueprints/${blueprintId}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (json.fieldErrors) setFieldErrors(json.fieldErrors);
        setFormError(json.error ?? "Không thể lưu Blueprint.");
        return;
      }

      const id = mode === "create" ? json.blueprint.id : blueprintId;
      router.push(`/admin/exam-structures/${id}`);
      router.refresh();
    } catch {
      setFormError("Có lỗi xảy ra, vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 pb-16">
      {formError ? (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="name">Tên Blueprint</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ĐGTD Toán — Cấu trúc 2026"
          />
          {fieldErrors.name ? <p className="text-destructive text-xs">{fieldErrors.name}</p> : null}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="examType">Loại đề</Label>
          <Input id="examType" value={examType} onChange={(e) => setExamType(e.target.value)} placeholder="ĐGNL" />
          {fieldErrors.examType ? <p className="text-destructive text-xs">{fieldErrors.examType}</p> : null}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="durationMinutes">Thời lượng (phút)</Label>
          <Input
            id="durationMinutes"
            type="number"
            min={1}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
          />
          {fieldErrors.durationMinutes ? (
            <p className="text-destructive text-xs">{fieldErrors.durationMinutes}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <Label>Môn học (tổng thể)</Label>
          <Select
            value={subjectId || ALL_SUBJECTS}
            onValueChange={(v) => {
              if (!v) return;
              setSubjectId(v === ALL_SUBJECTS ? "" : v);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {(v: string) => (v === ALL_SUBJECTS ? "Nhiều môn" : subjects.find((s) => s.id === v)?.name)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_SUBJECTS}>Nhiều môn</SelectItem>
              {subjects.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Sections</h2>
            <p className="text-muted-foreground text-xs">Tổng số câu dự kiến: {totalQuestions}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addSection}>
            <Plus className="size-3.5" />
            Thêm Section
          </Button>
        </div>
        {fieldErrors.sections ? <p className="text-destructive text-xs">{fieldErrors.sections}</p> : null}

        {sections.map((section, sIndex) => {
          const sectionTotal = section.rules.reduce((s, r) => s + (Number.parseInt(r.quantity, 10) || 0), 0);
          return (
            <div key={sIndex} className="bg-card flex flex-col gap-3 rounded-xl border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground text-xs font-medium">[{sIndex + 1}]</span>
                <Input
                  value={section.name}
                  onChange={(e) => updateSectionName(sIndex, e.target.value)}
                  className="max-w-64"
                  placeholder="Tên Section (vd: Trắc nghiệm)"
                />
                <span className="text-muted-foreground text-xs">{sectionTotal} câu</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={sections.length <= 1}
                  onClick={() => removeSection(sIndex)}
                  className="ml-auto"
                  aria-label="Xoá Section"
                >
                  <Trash2 className="text-destructive size-3.5" />
                </Button>
              </div>

              <div className="flex flex-col gap-2">
                {section.rules.map((rule, rIndex) => (
                  <RuleEditor
                    key={rIndex}
                    rule={rule}
                    subjects={subjects}
                    onChange={(next) => updateRule(sIndex, rIndex, next)}
                    onRemove={() => removeRule(sIndex, rIndex)}
                    canRemove={section.rules.length > 1}
                    error={ruleError(sIndex, rIndex)}
                  />
                ))}
              </div>

              <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => addRule(sIndex)}>
                <Plus className="size-3.5" />
                Thêm Rule
              </Button>
            </div>
          );
        })}
      </div>

      <Separator />

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.push("/admin/exam-structures")}>
          Huỷ
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
          {mode === "create" ? "Tạo Blueprint" : "Lưu thay đổi"}
        </Button>
      </div>
    </form>
  );
}
