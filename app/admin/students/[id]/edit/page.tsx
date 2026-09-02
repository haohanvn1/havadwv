import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { StudentForm } from "@/components/admin/students/student-form";
import { getStudentDetail } from "@/server/services/studentService";

export default async function EditStudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("ADMIN");
  const { id } = await params;

  const student = await getStudentDetail(id);
  if (!student) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Chỉnh sửa học sinh</h1>
        <p className="text-muted-foreground text-sm">Tên đăng nhập: {student.username} (không thể đổi).</p>
      </div>
      <StudentForm
        mode="edit"
        studentId={student.id}
        initialData={{
          fullName: student.fullName,
          email: student.email,
          phone: student.phone,
          class: student.studentProfile?.class ?? null,
          school: student.studentProfile?.school ?? null,
          targetExamType: student.studentProfile?.targetExamType ?? null,
        }}
      />
    </div>
  );
}
