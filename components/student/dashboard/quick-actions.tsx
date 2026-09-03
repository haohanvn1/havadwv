import Link from "next/link";
import { GraduationCap, Video } from "lucide-react";

const ACTIONS = [
  {
    label: "Xem bài giảng",
    description: "Ôn lại kiến thức trọng tâm",
    href: "/student/video-lessons",
    icon: Video,
    className: "from-primary to-[oklch(0.5_0.17_290)]",
  },
  {
    label: "Xem lớp học",
    description: "Lớp trực tiếp sắp diễn ra",
    href: "/student/live-classes",
    icon: GraduationCap,
    className: "from-accent2 to-[oklch(0.62_0.18_30)]",
  },
];

export function QuickActions() {
  return (
    <div>
      <h2 className="mb-3 text-base font-bold">Bạn muốn làm gì?</h2>
      <div className="grid grid-cols-2 gap-3">
        {ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className={`flex flex-col gap-2 rounded-3xl bg-gradient-to-br p-4 text-white transition-transform hover:-translate-y-0.5 ${action.className}`}
          >
            <action.icon className="size-6" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold">{action.label}</p>
              <p className="text-xs text-white/85">{action.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
