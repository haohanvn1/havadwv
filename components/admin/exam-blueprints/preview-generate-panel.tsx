"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Eye, Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { BlueprintStatus } from "@/lib/generated/prisma/enums";

interface PreviewRule {
  ruleId: string;
  summary: string;
  required: number;
  available: number;
  status: "OK" | "THIEU";
}
interface PreviewSection {
  sectionId: string;
  name: string;
  questionCount: number;
  rules: PreviewRule[];
}
interface PreviewResult {
  totalQuestions: number;
  sections: PreviewSection[];
  hasShortage: boolean;
}

export function PreviewGeneratePanel({ blueprintId, status }: { blueprintId: string; status: BlueprintStatus }) {
  const router = useRouter();
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateResult, setGenerateResult] = useState<{ examId: string } | null>(null);

  async function handlePreview() {
    setLoadingPreview(true);
    setGenerateError(null);
    try {
      const res = await fetch(`/api/admin/exam-blueprints/${blueprintId}/preview`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setGenerateError(body.error ?? "Không thể xem trước.");
        return;
      }
      setPreview(body.preview);
    } catch {
      setGenerateError("Có lỗi xảy ra khi xem trước.");
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setGenerateError(null);
    setGenerateResult(null);
    try {
      const res = await fetch(`/api/admin/exam-blueprints/${blueprintId}/generate`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setGenerateError(body.error ?? "Không thể sinh đề.");
        return;
      }
      setGenerateResult({ examId: body.examId });
      router.refresh();
    } catch {
      setGenerateError("Có lỗi xảy ra khi sinh đề.");
    } finally {
      setGenerating(false);
    }
  }

  const disabled = status === "ARCHIVED";

  return (
    <div className="bg-card flex flex-col gap-4 rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Xem trước &amp; Sinh đề</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePreview} disabled={disabled || loadingPreview}>
            {loadingPreview ? <Loader2 className="size-3.5 animate-spin" /> : <Eye className="size-3.5" />}
            Xem trước
          </Button>
          <Button size="sm" onClick={handleGenerate} disabled={disabled || generating}>
            {generating ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
            Sinh đề
          </Button>
        </div>
      </div>

      {disabled ? (
        <p className="text-muted-foreground text-xs">Blueprint đã lưu trữ — không thể xem trước hoặc sinh đề.</p>
      ) : null}

      {generateError ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>{generateError}</AlertDescription>
        </Alert>
      ) : null}

      {generateResult ? (
        <Alert>
          <AlertDescription className="flex items-center justify-between gap-2">
            <span>Sinh đề thành công.</span>
            <Button variant="outline" size="sm" render={<Link href={`/admin/exams/${generateResult.examId}`} />} nativeButton={false}>
              Xem đề vừa tạo
              <ArrowRight className="size-3.5" />
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {preview ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">Tổng số câu: {preview.totalQuestions}</p>
          {preview.sections.map((section) => (
            <div key={section.sectionId} className="flex flex-col gap-1.5">
              <p className="text-sm font-medium">
                {section.name} <span className="text-muted-foreground font-normal">({section.questionCount} câu)</span>
              </p>
              <div className="flex flex-col gap-1">
                {section.rules.map((rule) => (
                  <div
                    key={rule.ruleId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-xs"
                  >
                    <span>{rule.summary}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        Cần {rule.required} / Có {rule.available}
                      </span>
                      <Badge variant={rule.status === "OK" ? "default" : "destructive"}>
                        {rule.status === "OK" ? "OK" : "Thiếu"}
                      </Badge>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {preview.hasShortage ? (
            <p className="text-destructive text-xs">
              Một số Rule đang thiếu câu hỏi phù hợp — sinh đề sẽ thất bại cho tới khi bổ sung đủ câu hỏi trong
              Ngân hàng câu hỏi (con số này là khả dụng độc lập từng Rule, chưa trừ trùng lặp giữa các Rule).
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
