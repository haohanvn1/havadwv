export function ModulePlaceholder({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-16 text-center">
      <h1 className="text-lg font-medium">{title}</h1>
      <p className="text-muted-foreground text-sm">Module đang được phát triển.</p>
    </div>
  );
}
