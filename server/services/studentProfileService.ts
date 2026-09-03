import "server-only";
import { prisma } from "@/lib/prisma";

export async function getStudentProfileDetails(userId: string) {
  return prisma.studentProfile.findUnique({
    where: { userId },
    select: { class: true, school: true, targetExamType: true },
  });
}
