import { requireRole } from "@/lib/auth/guards";
import { EmptyState } from "@/components/ui/empty-state";
import { getAccessibleSubjects } from "@/server/services/subjectAccessService";
import { SubjectAccessGrid } from "@/components/student/subjects/subject-access-grid";

export default async function StudentVideoLessonsPage() {
  const user = await requireRole("STUDENT");
  const subjects = await getAccessibleSubjects(user.id);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-bold">Lớp</h1>
        <p className="text-muted-foreground text-sm">Chọn một môn để xem bài giảng của Lớp đó.</p>
      </div>

      {subjects.length === 0 ? (
        <EmptyState
          className="bg-card rounded-3xl"
          title="Bạn chưa được cấp quyền vào Lớp nào."
          description="Liên hệ trung tâm để được cấp quyền vào Lớp của môn bạn đăng ký."
        />
      ) : (
        <SubjectAccessGrid
          subjects={subjects}
          basePath="/student/video-lessons"
          countLabel={(s) => `${s.videoLessonCount} bài giảng`}
        />
      )}
    </div>
  );
}
