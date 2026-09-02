import { requireRole } from "@/lib/auth/guards";
import { EmptyState } from "@/components/ui/empty-state";
import { getAccessibleSubjects } from "@/server/services/subjectAccessService";
import { SubjectAccessGrid } from "@/components/student/subjects/subject-access-grid";

export default async function StudentExamSetsPage() {
  const user = await requireRole("STUDENT");
  const subjects = await getAccessibleSubjects(user.id);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-bold">Bộ đề</h1>
        <p className="text-muted-foreground text-sm">Chọn một môn để xem các đề thi của Bộ đề đó.</p>
      </div>

      {subjects.length === 0 ? (
        <EmptyState
          className="bg-card rounded-3xl"
          title="Bạn chưa được cấp quyền vào Bộ đề nào."
          description="Liên hệ trung tâm để được cấp quyền vào Bộ đề của môn bạn đăng ký."
        />
      ) : (
        <SubjectAccessGrid
          subjects={subjects}
          basePath="/student/exam-sets"
          countLabel={(s) => `${s.examCount} đề thi`}
        />
      )}
    </div>
  );
}
