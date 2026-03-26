import { ChevronsUp, ChevronUp, Minus, ChevronDown, AlertTriangle, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRIORITY_CONFIG } from "@/lib/constants";

interface IssuePriorityIconProps {
  priority: string;
  className?: string;
  showLabel?: boolean;
}

const iconComponents: Record<string, typeof Minus> = {
  ChevronsUp,
  ChevronUp,
  Minus,
  ChevronDown,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
};

export function IssuePriorityIcon({ priority, className, showLabel }: IssuePriorityIconProps) {
  const config = PRIORITY_CONFIG[priority as keyof typeof PRIORITY_CONFIG];
  if (!config) return null;

  const Icon = iconComponents[config.icon];
  if (!Icon) return null;

  return (
    <span className="inline-flex items-center gap-1" aria-label={`Priority: ${config.label}`}>
      <Icon
        className={cn("h-4 w-4", className)}
        style={{ color: config.color }}
      />
      {showLabel && (
        <span className="text-xs" style={{ color: config.color }}>
          {config.label}
        </span>
      )}
    </span>
  );
}
