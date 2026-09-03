import { Skeleton } from "@/components/ui/skeleton";
import { CardSkeleton, StatGridSkeleton } from "@/components/student/dashboard/skeletons";

export default function StudentDashboardLoading() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-7">
      <Skeleton className="h-40 w-full rounded-3xl" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-20 rounded-3xl" />
        <Skeleton className="h-20 rounded-3xl" />
      </div>
      <CardSkeleton lines={1} />
      <CardSkeleton lines={2} />
      <StatGridSkeleton />
    </div>
  );
}
