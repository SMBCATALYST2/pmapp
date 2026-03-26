import { cn } from "@/lib/utils";

interface IssueLabelBadgeProps {
  name: string;
  color: string;
  className?: string;
}

export function IssueLabelBadge({ name, color, className }: IssueLabelBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        className
      )}
      style={{
        backgroundColor: `${color}20`,
        color: color,
        borderColor: `${color}40`,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {name}
    </span>
  );
}
