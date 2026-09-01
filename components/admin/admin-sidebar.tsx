import { AdminNavList } from "./admin-nav-list";

/**
 * Desktop (lg+): sidebar đầy đủ nhãn, rộng 240px.
 * Tablet (md-lg): thu gọn còn icon, nhãn vẫn có trong DOM (sr-only) để giữ
 * accessible name — không phải hai bộ nav khác nhau, chỉ khác CSS.
 */
export function AdminSidebar() {
  return (
    <aside className="bg-sidebar hidden shrink-0 border-r md:flex md:w-16 md:flex-col md:p-2 lg:w-60 lg:p-3">
      <div className="md:hidden lg:block">
        <AdminNavList />
      </div>
      <div className="hidden md:block lg:hidden">
        <AdminNavList collapsedLabels />
      </div>
    </aside>
  );
}
