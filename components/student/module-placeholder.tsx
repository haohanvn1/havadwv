export function StudentModulePlaceholder({ title }: { title: string }) {
  return (
    <div className="border-border bg-card flex flex-col items-center justify-center gap-2 rounded-3xl border border-dashed p-16 text-center">
      <div className="bg-primary/10 mb-2 flex size-12 items-center justify-center rounded-2xl text-2xl">
        🚧
      </div>
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="text-muted-foreground max-w-sm text-sm">
        Chức năng đang được phát triển — quay lại sau nhé, mình sẽ báo ngay khi sẵn sàng!
      </p>
    </div>
  );
}
