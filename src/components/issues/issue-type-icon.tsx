import { Zap, BookOpen, CheckSquare, Bug } from "lucide-react";
import { cn } from "@/lib/utils";
import { ISSUE_TYPE_CONFIG } from "@/lib/constants";

interface IssueTypeIconProps {
  type: string;
  className?: string;
}

const iconComponents: Record<string, typeof Zap> = {
  Zap,
  BookOpen,
  CheckSquare,
  Bug,
};

export function IssueTypeIcon({ type, className }: IssueTypeIconProps) {
  const config = ISSUE_TYPE_CONFIG[type as keyof typeof ISSUE_TYPE_CONFIG];
  if (!config) return null;

  const Icon = iconComponents[config.icon];
  if (!Icon) return null;

  return (
    <Icon
      className={cn("h-4 w-4", className)}
      style={{ color: config.color }}
      aria-label={`Type: ${config.label}`}
    />
  );
}
