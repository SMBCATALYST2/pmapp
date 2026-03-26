export default function BoardLoading() {
  return (
    <div className="flex h-full gap-4 overflow-x-auto p-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex w-72 shrink-0 flex-col gap-3">
          <div className="h-8 w-32 animate-pulse rounded bg-muted" />
          <div className="flex flex-col gap-2">
            {Array.from({ length: Math.max(1, 3 - i) }).map((_, j) => (
              <div key={j} className="h-24 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
