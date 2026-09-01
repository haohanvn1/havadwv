import Link from "next/link";
import { UserPlus, FilePlus, ListChecks, Upload, VideoIcon, CalendarPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const ACTIONS = [
  { label: "Add Student", href: "/admin/students", icon: UserPlus },
  { label: "Add Question", href: "/admin/question-bank", icon: FilePlus },
  { label: "Create Exam", href: "/admin/exams", icon: ListChecks },
  { label: "Import Exam Structure", href: "/admin/exam-structures", icon: Upload },
  { label: "Add Video", href: "/admin/video-lessons", icon: VideoIcon },
  { label: "Schedule Live Class", href: "/admin/live-classes", icon: CalendarPlus },
];

export function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ACTIONS.map((action) => (
            <Button
              key={action.href}
              variant="outline"
              nativeButton={false}
              className="h-auto flex-col gap-1.5 py-3"
              render={<Link href={action.href} />}
            >
              <action.icon className="size-4" aria-hidden="true" />
              <span className="text-xs font-medium">{action.label}</span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
