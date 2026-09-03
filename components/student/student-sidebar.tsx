import { StudentNavList } from "./student-nav-list";

/**
 * Desktop (lg+): sidebar đầy nhãn. Tablet (md-lg): thu gọn còn icon — cùng
 * cơ chế đã dùng cho Admin. Ẩn hoàn toàn ở mobile vì mobile dùng
 * StudentBottomNav thay vì drawer.
 */
export function StudentSidebar() {
  return (
    <aside className="bg-card hidden shrink-0 border-r md:flex md:w-[76px] md:flex-col md:p-2.5 lg:w-64 lg:p-4">
      <div className="md:hidden lg:block">
        <StudentNavList />
      </div>
      <div className="hidden md:block lg:hidden">
        <StudentNavList collapsedLabels />
      </div>
    </aside>
  );
}
