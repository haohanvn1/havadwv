import { requireRole } from "@/lib/auth/guards";
import { StudentForm } from "@/components/admin/students/student-form";

export default async function NewStudentPage() {
  await requireRole("ADMIN");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Thêm học sinh</h1>
        <p className="text-muted-foreground text-sm">Tạo tài khoản học sinh mới cho hệ thống.</p>
      </div>
      <StudentForm mode="create" />
    </div>
  );
}
