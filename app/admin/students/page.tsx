import Link from "next/link";
import { Plus, Upload } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { listStudents } from "@/server/services/studentService";
import { StudentSearch } from "@/components/admin/students/student-search";
import { StudentTable } from "@/components/admin/students/student-table";

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("ADMIN");

  const resolvedParams = await searchParams;
  const search = typeof resolvedParams.search === "string" ? resolvedParams.search : undefined;
  const students = await listStudents(search);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Học sinh</h1>
          <p className="text-muted-foreground text-sm">Quản lý tài khoản học sinh trong hệ thống.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            render={<Link href="/admin/students/import" />}
            nativeButton={false}
          >
            <Upload className="size-4" />
            Nhập từ Excel
          </Button>
          <Button render={<Link href="/admin/students/new" />} nativeButton={false}>
            <Plus className="size-4" />
            Thêm học sinh
          </Button>
        </div>
      </div>

      <StudentSearch />

      {students.length === 0 ? (
        <EmptyState
          title={search ? "Không tìm thấy học sinh phù hợp." : "Chưa có học sinh nào."}
          description={search ? "Thử từ khoá khác." : "Bắt đầu bằng cách tạo tài khoản học sinh đầu tiên."}
          action={
            !search ? (
              <Button render={<Link href="/admin/students/new" />} nativeButton={false} size="sm">
                <Plus className="size-4" />
                Thêm học sinh
              </Button>
            ) : undefined
          }
        />
      ) : (
        <StudentTable students={students} />
      )}
    </div>
  );
}
