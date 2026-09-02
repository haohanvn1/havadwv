import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, PlayCircle } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { EmptyState } from "@/components/ui/empty-state";
import { listVideoLessonsForSubject } from "@/server/services/videoLessonService";
import { SubjectAccessDeniedError } from "@/server/services/subjectAccessService";

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "";
  const minutes = Math.round(seconds / 60);
  return `${minutes} phút`;
}

export default async function VideoLessonsBySubjectPage({
  params,
}: {
  params: Promise<{ subjectId: string }>;
}) {
  const user = await requireRole("STUDENT");
  const { subjectId } = await params;

  let data;
  try {
    data = await listVideoLessonsForSubject(user.id, subjectId);
  } catch (error) {
    if (error instanceof SubjectAccessDeniedError) notFound();
    throw error;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/student/video-lessons" className="text-muted-foreground text-xs hover:underline">
          ← Quay lại danh sách Lớp
        </Link>
        <h1 className="text-lg font-bold">Lớp {data.subjectName}</h1>
      </div>

      {data.lessons.length === 0 ? (
        <EmptyState className="bg-card rounded-3xl" title="Lớp này chưa có bài giảng nào." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.lessons.map((lesson) => (
            <Link
              key={lesson.id}
              href={`/student/video-lessons/${subjectId}/${lesson.id}`}
              className="bg-card border-border hover:border-primary/40 flex flex-col gap-2.5 rounded-3xl border p-4 transition-colors"
            >
              <div className="flex items-center justify-between">
                <PlayCircle className="text-primary size-5" />
                {lesson.completed ? <CheckCircle2 className="size-4 text-emerald-600" /> : null}
              </div>
              <span className="text-sm font-semibold">{lesson.title}</span>
              {lesson.durationSeconds != null ? (
                <span className="text-muted-foreground text-xs">{formatDuration(lesson.durationSeconds)}</span>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
