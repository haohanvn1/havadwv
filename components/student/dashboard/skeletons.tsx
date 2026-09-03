import { Skeleton } from "@/components/ui/skeleton";

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="bg-card border-border rounded-3xl border p-5">
      <Skeleton className="mb-4 h-5 w-32 rounded-full" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export function StatGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-card border-border rounded-2xl border p-4">
          <Skeleton className="mb-2 h-3 w-16 rounded-full" />
          <Skeleton className="h-6 w-12 rounded-full" />
        </div>
      ))}
    </div>
  );
}
