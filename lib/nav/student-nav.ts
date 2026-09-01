import {
  BarChart3,
  BookOpen,
  CalendarDays,
  GraduationCap,
  Home,
  NotebookPen,
  RotateCcw,
  Timer,
  UserRound,
  Video,
  type LucideIcon,
} from "lucide-react";
import { isNavItemActive } from "./nav-utils";

export { isNavItemActive };

export interface StudentNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Xuất hiện ở bottom nav mobile (chỉ 5 mục quan trọng nhất, không phải toàn bộ). */
  primaryMobile?: boolean;
  /** Nhãn ngắn hơn cho bottom nav — nếu không có thì dùng `label`. */
  mobileLabel?: string;
}

export interface StudentNavGroup {
  label: string;
  items: StudentNavItem[];
}

/**
 * Nguồn duy nhất cho navigation khu vực Student — sidebar đầy đủ (desktop/
 * tablet) và bottom nav (mobile, chỉ các mục `primaryMobile`) đều đọc từ
 * đây, không khai báo route ở nơi thứ hai.
 */
export const studentNavGroups: StudentNavGroup[] = [
  {
    label: "Tổng quan",
    items: [
      {
        label: "Dashboard",
        mobileLabel: "Trang chủ",
        href: "/student/dashboard",
        icon: Home,
        primaryMobile: true,
      },
    ],
  },
  {
    label: "Luyện thi",
    items: [
      { label: "Đề thi", href: "/student/exams", icon: BookOpen, primaryMobile: true },
      { label: "Ôn tập", href: "/student/exams/practice", icon: NotebookPen },
      { label: "Thi thử", href: "/student/exams/mock", icon: Timer },
      {
        label: "Lịch sử làm bài",
        mobileLabel: "Kết quả",
        href: "/student/exam-history",
        icon: BarChart3,
        primaryMobile: true,
      },
      { label: "Câu hỏi đã sai", href: "/student/question-review", icon: RotateCcw },
    ],
  },
  {
    label: "Học tập",
    items: [
      { label: "Bài giảng", href: "/student/video-lessons", icon: Video, primaryMobile: true },
      { label: "Lớp học trực tiếp", href: "/student/live-classes", icon: GraduationCap },
      { label: "Lịch học", href: "/student/calendar", icon: CalendarDays },
    ],
  },
  {
    label: "Cá nhân",
    items: [{ label: "Hồ sơ", href: "/student/profile", icon: UserRound, primaryMobile: true }],
  },
];

export const studentNavItems: StudentNavItem[] = studentNavGroups.flatMap((group) => group.items);

export const studentPrimaryMobileItems: StudentNavItem[] = studentNavItems.filter(
  (item) => item.primaryMobile,
);

export function getStudentPageTitle(pathname: string): string {
  const match = studentNavItems.find((item) => isNavItemActive(pathname, item.href));
  return match?.label ?? "Học sinh";
}
