import { StudentStatusBadge } from "./badges";
import { StudentRowActions } from "./student-row-actions";
import type { UserStatus } from "@/lib/generated/prisma/enums";

interface StudentRow {
  id: string;
  fullName: string;
  username: string;
  email: string | null;
  status: UserStatus;
  studentProfile: { class: string | null } | null;
  _count: { attempts: number };
}

export function StudentTable({ students }: { students: StudentRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-muted-foreground text-left">
          <tr>
            <th className="px-3 py-2 font-medium">Họ tên</th>
            <th className="px-3 py-2 font-medium">Tên đăng nhập</th>
            <th className="px-3 py-2 font-medium">Email</th>
            <th className="px-3 py-2 font-medium">Lớp</th>
            <th className="px-3 py-2 font-medium">Trạng thái</th>
            <th className="px-3 py-2 font-medium text-right">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {students.map((student) => (
            <tr key={student.id} className="border-t">
              <td className="px-3 py-2">{student.fullName}</td>
              <td className="px-3 py-2">{student.username}</td>
              <td className="px-3 py-2">{student.email ?? "—"}</td>
              <td className="px-3 py-2">{student.studentProfile?.class ?? "—"}</td>
              <td className="px-3 py-2">
                <StudentStatusBadge status={student.status} />
              </td>
              <td className="px-3 py-2">
                <StudentRowActions id={student.id} status={student.status} hasAttempts={student._count.attempts > 0} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
