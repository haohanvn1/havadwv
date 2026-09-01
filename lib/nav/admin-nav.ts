import {
  BarChart3,
  BookOpen,
  FileText,
  LayoutDashboard,
  ListChecks,
  Radio,
  Settings,
  Users,
  Video,
  Wand2,
  type LucideIcon,
} from "lucide-react";

export interface AdminNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

/**
 * Nguồn duy nhất cho toàn bộ navigation khu vực Admin — sidebar (desktop,
 * thu gọn ở tablet, drawer ở mobile) và tiêu đề trang trên header đều đọc từ
 * đây, không lặp lại danh sách route ở nơi khác.
 */
export const adminNavGroups: AdminNavGroup[] = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Content",
    items: [
      { label: "Question Bank", href: "/admin/question-bank", icon: BookOpen },
      { label: "Video Lessons", href: "/admin/video-lessons", icon: Video },
    ],
  },
  {
    label: "Exams",
    items: [
      { label: "Exams", href: "/admin/exams", icon: FileText },
      { label: "Exam Structures", href: "/admin/exam-structures", icon: ListChecks },
      { label: "Exam Generator", href: "/admin/exam-generator", icon: Wand2 },
    ],
  },
  {
    label: "Classroom",
    items: [{ label: "Live Classes", href: "/admin/live-classes", icon: Radio }],
  },
  {
    label: "Management",
    items: [
      { label: "Students", href: "/admin/students", icon: Users },
      { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
      { label: "Settings", href: "/admin/settings", icon: Settings },
    ],
  },
];

export const adminNavItems: AdminNavItem[] = adminNavGroups.flatMap((group) => group.items);

/** "/admin/students/123" vẫn tính là active cho mục "Students" (href "/admin/students"). */
export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const EXTRA_PAGE_TITLES: Record<string, string> = {
  "/admin/profile": "Hồ sơ",
};

export function getAdminPageTitle(pathname: string): string {
  for (const [prefix, title] of Object.entries(EXTRA_PAGE_TITLES)) {
    if (isNavItemActive(pathname, prefix)) return title;
  }
  const match = adminNavItems.find((item) => isNavItemActive(pathname, item.href));
  return match?.label ?? "Admin";
}
