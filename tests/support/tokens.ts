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
