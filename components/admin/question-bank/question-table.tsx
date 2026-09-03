import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DifficultyBadge, QuestionStatusBadge, QuestionTypeBadge } from "./badges";
import { QuestionRowActions } from "./question-row-actions";
import type { Difficulty, QuestionStatus, QuestionType } from "@/lib/generated/prisma/enums";

export interface QuestionListRow {
  id: string;
  content: string;
  type: QuestionType;
  difficulty: Difficulty;
  status: QuestionStatus;
  source: string | null;
  year: number | null;
  createdAt: Date;
  subject: { id: string; name: string };
  topic: { id: string; name: string };
  usedInExamCount: number;
}

export function QuestionTable({ questions }: { questions: QuestionListRow[] }) {
  return (
    <>
      {/* Desktop / tablet: bảng đầy đủ */}
      <div className="hidden rounded-xl border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-64">Câu hỏi</TableHead>
              <TableHead>Loại</TableHead>
              <TableHead>Môn học</TableHead>
              <TableHead>Chủ đề</TableHead>
              <TableHead>Độ khó</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Nguồn</TableHead>
              <TableHead>Năm</TableHead>
              <TableHead>Ngày tạo</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {questions.map((q) => (
              <TableRow key={q.id}>
                <TableCell className="max-w-80 whitespace-normal">
                  <p className="line-clamp-2 text-sm">{q.content}</p>
                </TableCell>
                <TableCell>
                  <QuestionTypeBadge type={q.type} />
                </TableCell>
                <TableCell className="text-sm">{q.subject.name}</TableCell>
                <TableCell className="text-sm">{q.topic.name}</TableCell>
                <TableCell>
                  <DifficultyBadge difficulty={q.difficulty} />
                </TableCell>
                <TableCell>
                  <QuestionStatusBadge status={q.status} />
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{q.source ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{q.year ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                  {new Intl.DateTimeFormat("vi-VN").format(q.createdAt)}
                </TableCell>
                <TableCell>
                  <QuestionRowActions id={q.id} status={q.status} usedInExamCount={q.usedInExamCount} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: card list, không ép bảng rộng */}
      <div className="flex flex-col gap-3 md:hidden">
        {questions.map((q) => (
          <div key={q.id} className="bg-card flex flex-col gap-2 rounded-xl border p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="line-clamp-3 flex-1 text-sm font-medium">{q.content}</p>
              <QuestionRowActions id={q.id} status={q.status} usedInExamCount={q.usedInExamCount} />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <QuestionTypeBadge type={q.type} />
              <DifficultyBadge difficulty={q.difficulty} />
              <QuestionStatusBadge status={q.status} />
            </div>
            <p className="text-muted-foreground text-xs">
              {q.subject.name} · {q.topic.name}
              {q.source ? ` · ${q.source}` : ""}
              {q.year ? ` · ${q.year}` : ""}
            </p>
          </div>
        ))}
      </div>
    </>
  );
}
