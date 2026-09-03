import type { ReactNode } from "react";
import type { AuthUser } from "@/lib/auth/guards";
import { StudentSidebar } from "./student-sidebar";
import { StudentHeader } from "./student-header";
import { StudentBottomNav } from "./student-bottom-nav";

export function StudentShell({ user, children }: { user: AuthUser; children: ReactNode }) {
  return (
    <div className="student-theme bg-background text-foreground flex min-h-svh">
      <StudentSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <StudentHeader user={user} />
        {/*
          KHÔNG đặt overflow-x-hidden ở đây (hay bất kỳ ancestor nào của
          children) — theo spec CSS Overflow, overflow-x khác "visible" luôn
          buộc trình duyệt tự tính overflow-y thành "auto" cho trục còn lại,
          kể cả khi khai báo overflow-y-visible tường minh (không override
          được). Vì main/wrapper ở đây cao không giới hạn (chỉ min-h-svh ở
          khung ngoài cùng), bị áp overflow-y:auto ngoài ý muốn sẽ biến nó
          thành sticky-positioning containing block, khiến mọi
          `position: sticky` bên trong children (vd sidebar câu hỏi ở trang
          làm bài, Phase 9C) không bao giờ dính đúng vị trí so với viewport
          thật. Chống tràn ngang phải làm ở đúng phần tử rộng cụ thể (table,
          code block, ...) bằng overflow-x-auto trên chính nó — đúng pattern
          đã dùng nhất quán ở Admin, không chặn overflow ở tầng layout dùng
          chung cho mọi trang.
        */}
        <main className="min-w-0 flex-1 p-4 pb-20 md:p-6 md:pb-6">{children}</main>
      </div>
      <StudentBottomNav />
    </div>
  );
}
