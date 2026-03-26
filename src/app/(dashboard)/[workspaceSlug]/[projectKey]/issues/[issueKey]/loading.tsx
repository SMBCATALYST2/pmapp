export default function IssueLoading() {
  return (
    <div className="flex h-full gap-6 p-6" data-testid="issue-detail-skeleton">
      {/* Main content skeleton */}
      <div className="flex-1 space-y-4">
        <div className="h-8 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-40 animate-pulse rounded-lg bg-muted" />
        <div className="space-y-2">
          <div className="h-4 w-1/4 animate-pulse rounded bg-muted" />
          <div className="h-20 animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
      {/* Sidebar skeleton */}
      <div className="w-72 space-y-4 border-l pl-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-1">
            <div className="h-3 w-16 animate-pulse rounded bg-muted" />
            <div className="h-8 w-full animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
