import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Danh sách học sinh tối thiểu cho placeholder "Quản lý học sinh" — chưa có
 * create/update/delete/pagination, sẽ xây đầy đủ ở phase Student management.
 */
export async function listStudents() {
  return prisma.user.findMany({
    where: { role: "STUDENT" },
    select: {
      id: true,
      username: true,
      fullName: true,
      email: true,
      status: true,
      createdAt: true,
      studentProfile: { select: { class: true, school: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}
