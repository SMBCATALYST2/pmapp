export default function ListLoading() {
  return (
    <div className="p-6">
      <div className="mb-4 h-10 w-full animate-pulse rounded-lg bg-muted" />
      <div className="space-y-1 rounded-lg border">
        <div className="h-10 animate-pulse bg-muted/50" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse border-t bg-muted/20" />
        ))}
      </div>
    </div>
  );
}
