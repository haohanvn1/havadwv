import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { getVideoLessonForStudent } from "@/server/services/videoLessonService";
import { SubjectAccessDeniedError } from "@/server/services/subjectAccessService";

export default async function VideoLessonWatchPage({
  params,
}: {
  params: Promise<{ subjectId: string; lessonId: string }>;
}) {
  const user = await requireRole("STUDENT");
  const { subjectId, lessonId } = await params;

  let lesson;
  try {
    lesson = await getVideoLessonForStudent(user.id, lessonId);
  } catch (error) {
    if (error instanceof SubjectAccessDeniedError) notFound();
    throw error;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href={`/student/video-lessons/${subjectId}`} className="text-muted-foreground text-xs hover:underline">
          ← Quay lại Lớp {lesson.subjectName}
        </Link>
        <h1 className="text-lg font-bold">{lesson.title}</h1>
      </div>

      <div className="aspect-video w-full overflow-hidden rounded-3xl bg-black">
        <iframe
          className="size-full"
          src={`https://www.youtube.com/embed/${lesson.youtubeVideoId}`}
          title={lesson.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>

      {lesson.description ? (
        <div className="bg-card border-border rounded-3xl border p-4">
          <p className="text-sm whitespace-pre-line">{lesson.description}</p>
        </div>
      ) : null}
    </div>
  );
}
