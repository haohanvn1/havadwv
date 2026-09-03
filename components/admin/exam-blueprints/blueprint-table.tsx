import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { BlueprintStatusBadge } from "./badges";
import type { BlueprintStatus } from "@/lib/generated/prisma/enums";

export interface BlueprintListRow {
  id: string;
  name: string;
  examType: string;
  status: BlueprintStatus;
  totalQuestions: number;
  createdAt: Date;
  updatedAt: Date;
  subject: { id: string; name: string } | null;
  _count: { sections: number; exams: number };
}

export function BlueprintTable({ blueprints }: { blueprints: BlueprintListRow[] }) {
  return (
    <>
      <div className="hidden rounded-xl border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-56">Tên Blueprint</TableHead>
              <TableHead>Loại đề</TableHead>
              <TableHead>Môn học</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Số Section</TableHead>
              <TableHead>Tổng số câu</TableHead>
              <TableHead>Số đề đã sinh</TableHead>
              <TableHead>Cập nhật</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {blueprints.map((b) => (
              <TableRow key={b.id}>
                <TableCell>
                  <Link href={`/admin/exam-structures/${b.id}`} className="font-medium hover:underline">
                    {b.name}
                  </Link>
                </TableCell>
                <TableCell className="text-sm">{b.examType}</TableCell>
                <TableCell className="text-sm">{b.subject?.name ?? "Tất cả"}</TableCell>
                <TableCell>
                  <BlueprintStatusBadge status={b.status} />
                </TableCell>
                <TableCell className="text-sm">{b._count.sections}</TableCell>
                <TableCell className="text-sm">{b.totalQuestions}</TableCell>
                <TableCell className="text-sm">{b._count.exams}</TableCell>
                <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                  {new Intl.DateTimeFormat("vi-VN").format(b.updatedAt)}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" render={<Link href={`/admin/exam-structures/${b.id}`} />} nativeButton={false}>
                    Xem
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 md:hidden">
        {blueprints.map((b) => (
          <Link
            key={b.id}
            href={`/admin/exam-structures/${b.id}`}
            className="bg-card flex flex-col gap-2 rounded-xl border p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium">{b.name}</p>
              <BlueprintStatusBadge status={b.status} />
            </div>
            <p className="text-muted-foreground text-xs">
              {b.examType} · {b.subject?.name ?? "Tất cả môn"} · {b._count.sections} section ·{" "}
              {b.totalQuestions} câu · {b._count.exams} đề đã sinh
            </p>
          </Link>
        ))}
      </div>
    </>
  );
}
