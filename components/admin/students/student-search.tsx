"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function StudentSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const searchFromUrl = searchParams.get("search") ?? "";
  const [search, setSearch] = useState(searchFromUrl);
  const [syncedSearch, setSyncedSearch] = useState(searchFromUrl);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (searchFromUrl !== syncedSearch) {
    setSyncedSearch(searchFromUrl);
    setSearch(searchFromUrl);
  }

  function updateSearch(next: string) {
    setSearch(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (next) params.set("search", next);
      else params.delete("search");
      router.push(`${pathname}?${params.toString()}`);
    }, 350);
  }

  return (
    <div className="relative max-w-sm">
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
      <Input
        value={search}
        onChange={(e) => updateSearch(e.target.value)}
        placeholder="Tìm theo tên, tên đăng nhập hoặc email..."
        className="pl-8"
      />
      {search ? (
        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute top-1/2 right-1 -translate-y-1/2"
          aria-label="Xoá tìm kiếm"
          onClick={() => updateSearch("")}
        >
          <X className="size-3.5" />
        </Button>
      ) : null}
    </div>
  );
}
