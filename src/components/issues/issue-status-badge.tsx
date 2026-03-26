import { cn } from "@/lib/utils";

interface IssueStatusBadgeProps {
  name: string;
  color: string;
  className?: string;
}

export function IssueStatusBadge({ name, color, className }: IssueStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        className
      )}
      style={{
        backgroundColor: `${color}15`,
        color: color,
      }}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      {name}
    </span>
  );
}
