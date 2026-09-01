import { GraduationCap, HelpCircle, FileText, Radio } from "lucide-react";
import { StatCard } from "./stat-card";
import { ErrorState } from "@/components/ui/error-state";
import { getDashboardOverview } from "@/server/services/dashboardService";

export async function DashboardStats() {
  let overview;
  try {
    overview = await getDashboardOverview();
  } catch {
    return <ErrorState message="Không thể tải số liệu tổng quan." />;
  }

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard
        label="Students"
        value={overview.studentCount}
        icon={<GraduationCap className="text-muted-foreground size-4" aria-hidden="true" />}
      />
      <StatCard
        label="Questions"
        value={overview.questionCount}
        icon={<HelpCircle className="text-muted-foreground size-4" aria-hidden="true" />}
      />
      <StatCard
        label="Exams"
        value={overview.examCount}
        icon={<FileText className="text-muted-foreground size-4" aria-hidden="true" />}
      />
      <StatCard
        label="Upcoming Classes"
        value={overview.upcomingClassCount}
        icon={<Radio className="text-muted-foreground size-4" aria-hidden="true" />}
      />
    </div>
  );
}
