import { Suspense } from "react";
import { requireRole } from "@/lib/auth/guards";
import { WelcomeHero } from "@/components/student/dashboard/welcome-hero";
import { QuickActions } from "@/components/student/dashboard/quick-actions";
import { ContinueLearning } from "@/components/student/dashboard/continue-learning";
import { UpcomingClasses } from "@/components/student/dashboard/upcoming-classes";
import { AvailableExams } from "@/components/student/dashboard/available-exams";
import { LearningProgress } from "@/components/student/dashboard/learning-progress";
import { RecentResults } from "@/components/student/dashboard/recent-results";
import { CardSkeleton, StatGridSkeleton } from "@/components/student/dashboard/skeletons";

export default async function StudentDashboardPage() {
  const user = await requireRole("STUDENT");

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-7">
      <WelcomeHero fullName={user.fullName} />

      <QuickActions />

      <div>
        <h2 className="mb-3 text-base font-bold">Tiếp tục học</h2>
        <Suspense fallback={<CardSkeleton lines={1} />}>
          <ContinueLearning studentId={user.id} />
        </Suspense>
      </div>

      <Suspense fallback={<CardSkeleton lines={2} />}>
        <UpcomingClasses studentId={user.id} />
      </Suspense>

      <Suspense fallback={<CardSkeleton lines={3} />}>
        <AvailableExams studentId={user.id} />
      </Suspense>

      <Suspense fallback={<StatGridSkeleton />}>
        <LearningProgress studentId={user.id} />
      </Suspense>

      <Suspense fallback={<CardSkeleton lines={2} />}>
        <RecentResults studentId={user.id} />
      </Suspense>
    </div>
  );
}
