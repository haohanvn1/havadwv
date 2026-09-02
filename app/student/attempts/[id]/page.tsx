import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { AttemptNotFoundError, getAttemptDetail } from "@/server/services/studentAttemptService";
import { AttemptRunner } from "@/components/student/attempts/attempt-runner";

export default async function StudentAttemptPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("STUDENT");
  const { id } = await params;

  let attempt;
  try {
    attempt = await getAttemptDetail(user.id, id);
  } catch (error) {
    if (error instanceof AttemptNotFoundError) notFound();
    throw error;
  }

  return <AttemptRunner initial={attempt} />;
}
