import { prisma } from "@/lib/prisma";
import { signSession } from "@/lib/auth/session";

export async function getAdminCookie(): Promise<string> {
  const admin = await prisma.user.findUniqueOrThrow({ where: { username: "admin" } });
  const token = await signSession({ sub: admin.id, role: "ADMIN", username: admin.username });
  return `session=${token}`;
}

export async function getStudentCookie(): Promise<string> {
  const student = await prisma.user.findUniqueOrThrow({ where: { username: "student1" } });
  const token = await signSession({
    sub: student.id,
    role: "STUDENT",
    username: student.username,
  });
  return `session=${token}`;
}

/** Student thứ hai — dùng cho test authorization "Student A không truy cập được resource của Student B". */
export async function getStudentBCookie(): Promise<string> {
  const student = await prisma.user.findUniqueOrThrow({ where: { username: "student2" } });
  const token = await signSession({
    sub: student.id,
    role: "STUDENT",
    username: student.username,
  });
  return `session=${token}`;
}
