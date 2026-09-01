import { Suspense } from "react";
import { requireRole } from "@/lib/auth/guards";
import { DashboardStats } from "@/components/admin/dashboard/dashboard-stats";
import { QuestionBankSummary } from "@/components/admin/dashboard/question-bank-summary";
import { ExamSummary } from "@/components/admin/dashboard/exam-summary";
import { UpcomingClasses } from "@/components/admin/dashboard/upcoming-classes";
import { RecentActivity } from "@/components/admin/dashboard/recent-activity";
import { QuickActions } from "@/components/admin/dashboard/quick-actions";
import { StatCardsSkeleton, ListSkeleton } from "@/components/admin/dashboard/skeletons";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function CardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent>
        <ListSkeleton rows={3} />
      </CardContent>
    </Card>
  );
}

export default async function AdminDashboardPage() {
  const user = await requireRole("ADMIN");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">Chào, {user.fullName}</h2>
        <p className="text-muted-foreground text-sm">Tổng quan hệ thống HavaEdu.</p>
      </div>

      <Suspense fallback={<StatCardsSkeleton />}>
        <DashboardStats />
      </Suspense>

      <div className="grid gap-4 lg:grid-cols-2">
        <Suspense fallback={<CardSkeleton />}>
          <QuestionBankSummary />
        </Suspense>
        <Suspense fallback={<CardSkeleton />}>
          <ExamSummary />
        </Suspense>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Suspense fallback={<CardSkeleton />}>
          <UpcomingClasses />
        </Suspense>
        <Suspense fallback={<CardSkeleton />}>
          <RecentActivity />
        </Suspense>
      </div>

      <QuickActions />
    </div>
  );
}
