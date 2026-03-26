import Link from "next/link";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  heading: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  "data-testid"?: string;
}

export function EmptyState({
  icon: Icon,
  heading,
  description,
  actionLabel,
  actionHref,
  onAction,
  "data-testid": testId,
}: EmptyStateProps) {
  return (
    <div
      data-testid={testId}
      className="flex flex-col items-center justify-center gap-4 py-16 text-center"
    >
      <div className="rounded-full bg-muted p-4">
        <Icon className="h-10 w-10 text-muted-foreground" />
      </div>
      <div>
        <h3 data-testid={testId ? `${testId}-heading` : undefined} className="text-lg font-semibold">
          {heading}
        </h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      </div>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition hover:bg-primary/90"
        >
          {actionLabel}
        </Link>
      )}
      {actionLabel && onAction && !actionHref && (
        <button
          onClick={onAction}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition hover:bg-primary/90"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
