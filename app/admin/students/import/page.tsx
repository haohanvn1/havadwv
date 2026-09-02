import { requireRole } from "@/lib/auth/guards";
import { listSubjectsForForm } from "@/server/services/questionService";
import { RosterImportWizard } from "@/components/admin/students/roster-import-wizard";

export default async function StudentRosterImportPage() {
  await requireRole("ADMIN");
  const subjects = await listSubjectsForForm();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Nhập học sinh từ Excel</h1>
        <p className="text-muted-foreground text-sm">
          Tải lên file danh sách học sinh theo lớp, hệ thống sẽ tự tạo tài khoản và cấp quyền vào Lớp/Bộ đề
          theo các cột môn đã đánh dấu &quot;1&quot;.
        </p>
      </div>
      <RosterImportWizard subjects={subjects} />
    </div>
  );
}
