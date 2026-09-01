"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AdminNavList } from "./admin-nav-list";

export function AdminMobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Mở menu điều hướng" className="md:hidden">
            <Menu className="size-5" aria-hidden="true" />
          </Button>
        }
      />
      <SheetContent side="left" className="w-64 p-3">
        <SheetHeader className="px-0">
          <SheetTitle>HavaEdu Admin</SheetTitle>
        </SheetHeader>
        <div className="mt-2">
          <AdminNavList onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
