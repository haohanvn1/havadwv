import { requireRole } from "@/lib/auth/guards";
import { listStudents } from "@/server/services/studentService";

export default async function AdminStudentsPage() {
  await requireRole("ADMIN");
  const students = await listStudents();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Học sinh</h1>
        <p className="text-muted-foreground text-sm">
          Placeholder — chỉ xem danh sách. CRUD đầy đủ sẽ xây ở phase Student management.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Họ tên</th>
              <th className="px-3 py-2 font-medium">Tên đăng nhập</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Lớp</th>
              <th className="px-3 py-2 font-medium">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr key={student.id} className="border-t">
                <td className="px-3 py-2">{student.fullName}</td>
                <td className="px-3 py-2">{student.username}</td>
                <td className="px-3 py-2">{student.email ?? "—"}</td>
                <td className="px-3 py-2">{student.studentProfile?.class ?? "—"}</td>
                <td className="px-3 py-2">{student.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
