"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TopicSelect } from "@/components/admin/question-bank/topic-select";
import {
  COGNITIVE_LEVEL_LABELS,
  COGNITIVE_LEVELS,
  DIFFICULTY_LABELS,
  DIFFICULTY_OPTIONS,
  QUESTION_TYPE_LABELS,
  QUESTION_TYPE_OPTIONS,
} from "@/lib/constants/question-bank";

const ALL_SUBJECTS = "__all_subjects__";
const ALL_TYPES = "__all_types__";
const ALL_DIFFICULTY = "__all_difficulty__";
const NO_COGNITIVE = "__none__";

export interface RuleState {
  subjectId: string;
  topicId: string;
  questionType: string;
  difficulty: string;
  cognitiveLevel: string;
  quantity: string;
}

export function emptyRule(): RuleState {
  return { subjectId: "", topicId: "", questionType: "", difficulty: "", cognitiveLevel: "", quantity: "1" };
}

export function RuleEditor({
  rule,
  subjects,
  onChange,
  onRemove,
  canRemove,
  error,
}: {
  rule: RuleState;
  subjects: { id: string; name: string }[];
  onChange: (next: RuleState) => void;
  onRemove: () => void;
  canRemove: boolean;
  error?: string;
}) {
  return (
    <div className="border-input flex flex-col gap-3 rounded-lg border p-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <div className="flex flex-col gap-1 lg:col-span-1">
          <Label className="text-xs">Môn học</Label>
          <Select
            value={rule.subjectId || ALL_SUBJECTS}
            onValueChange={(v) => {
              if (!v) return;
              onChange({ ...rule, subjectId: v === ALL_SUBJECTS ? "" : v, topicId: "" });
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {(v: string) => (v === ALL_SUBJECTS ? "Mọi môn" : subjects.find((s) => s.id === v)?.name)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_SUBJECTS}>Mọi môn</SelectItem>
              {subjects.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1 lg:col-span-1">
          <Label className="text-xs">Chủ đề</Label>
          <TopicSelect
            subjectId={rule.subjectId || undefined}
            value={rule.topicId || undefined}
            onChange={(topicId) => onChange({ ...rule, topicId: topicId ?? "" })}
            allowAll
          />
        </div>

        <div className="flex flex-col gap-1 lg:col-span-1">
          <Label className="text-xs">Loại câu hỏi</Label>
          <Select
            value={rule.questionType || ALL_TYPES}
            onValueChange={(v) => {
              if (!v) return;
              onChange({ ...rule, questionType: v === ALL_TYPES ? "" : v });
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {(v: string) => (v === ALL_TYPES ? "Mọi loại" : QUESTION_TYPE_LABELS[v as never])}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_TYPES}>Mọi loại</SelectItem>
              {QUESTION_TYPE_OPTIONS.map((t) => (
                <SelectItem key={t} value={t}>
                  {QUESTION_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1 lg:col-span-1">
          <Label className="text-xs">Độ khó</Label>
          <Select
            value={rule.difficulty || ALL_DIFFICULTY}
            onValueChange={(v) => {
              if (!v) return;
              onChange({ ...rule, difficulty: v === ALL_DIFFICULTY ? "" : v });
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {(v: string) => (v === ALL_DIFFICULTY ? "Mọi độ khó" : DIFFICULTY_LABELS[v as never])}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_DIFFICULTY}>Mọi độ khó</SelectItem>
              {DIFFICULTY_OPTIONS.map((d) => (
                <SelectItem key={d} value={d}>
                  {DIFFICULTY_LABELS[d]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1 lg:col-span-1">
          <Label className="text-xs">Mức độ tư duy</Label>
          <Select
            value={rule.cognitiveLevel || NO_COGNITIVE}
            onValueChange={(v) => {
              if (!v) return;
              onChange({ ...rule, cognitiveLevel: v === NO_COGNITIVE ? "" : v });
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {(v: string) => (v === NO_COGNITIVE ? "Không chọn" : COGNITIVE_LEVEL_LABELS[v])}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_COGNITIVE}>Không chọn</SelectItem>
              {COGNITIVE_LEVELS.map((level) => (
                <SelectItem key={level.value} value={level.value}>
                  {level.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1 lg:col-span-1">
          <Label className="text-xs">Số lượng câu</Label>
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={1}
              value={rule.quantity}
              onChange={(e) => onChange({ ...rule, quantity: e.target.value })}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={!canRemove}
              onClick={onRemove}
              aria-label="Xoá Rule"
            >
              <Trash2 className="text-destructive size-3.5" />
            </Button>
          </div>
        </div>
      </div>
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
