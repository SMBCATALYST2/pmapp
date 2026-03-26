/**
 * Application-wide constants.
 * Defines display configuration for issue types, priorities, statuses,
 * default workflow statuses seeded per project, and role hierarchy.
 */

import type { IssueType, Priority, StatusCategory } from "@prisma/client";

/** Issue type display configuration */
export const ISSUE_TYPE_CONFIG: Record<
  IssueType,
  { label: string; icon: string; color: string }
> = {
  EPIC: { label: "Epic", icon: "Zap", color: "#8B5CF6" },
  STORY: { label: "Story", icon: "BookOpen", color: "#3B82F6" },
  TASK: { label: "Task", icon: "CheckSquare", color: "#10B981" },
  BUG: { label: "Bug", icon: "Bug", color: "#EF4444" },
};

/** Priority display configuration */
export const PRIORITY_CONFIG: Record<
  Priority,
  { label: string; icon: string; color: string; level: number }
> = {
  URGENT: { label: "Urgent", icon: "AlertTriangle", color: "#EF4444", level: 0 },
  HIGH: { label: "High", icon: "ArrowUp", color: "#F97316", level: 1 },
  MEDIUM: { label: "Medium", icon: "Minus", color: "#F59E0B", level: 2 },
  LOW: { label: "Low", icon: "ArrowDown", color: "#3B82F6", level: 3 },
  NONE: { label: "None", icon: "Minus", color: "#6B7280", level: 4 },
};

/** Status category display configuration */
export const STATUS_CATEGORY_CONFIG: Record<
  StatusCategory,
  { label: string; icon: string }
> = {
  BACKLOG: { label: "Backlog", icon: "Circle" },
  TODO: { label: "To Do", icon: "CircleDot" },
  IN_PROGRESS: { label: "In Progress", icon: "Timer" },
  DONE: { label: "Done", icon: "CircleCheckBig" },
  CANCELLED: { label: "Cancelled", icon: "CircleX" },
};

/** Default colors for label creation */
export const LABEL_COLORS = [
  "#EF4444", // Red
  "#F97316", // Orange
  "#F59E0B", // Amber
  "#10B981", // Emerald
  "#3B82F6", // Blue
  "#8B5CF6", // Violet
  "#EC4899", // Pink
  "#6B7280", // Gray
  "#14B8A6", // Teal
  "#A855F7", // Purple
] as const;

/** Default statuses seeded for every new project */
export const DEFAULT_STATUSES: {
  name: string;
  category: StatusCategory;
  color: string;
  position: number;
}[] = [
  { name: "Backlog", category: "BACKLOG", color: "#6B7280", position: 0 },
  { name: "Todo", category: "TODO", color: "#3B82F6", position: 1 },
  { name: "In Progress", category: "IN_PROGRESS", color: "#F59E0B", position: 2 },
  { name: "In Review", category: "IN_PROGRESS", color: "#8B5CF6", position: 3 },
  { name: "Done", category: "DONE", color: "#10B981", position: 4 },
  { name: "Cancelled", category: "CANCELLED", color: "#EF4444", position: 5 },
];

/** Role hierarchy for authorization checks (higher number = more privileges) */
export const ROLE_HIERARCHY: Record<string, number> = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  VIEWER: 1,
};

/** Reserved workspace slugs that cannot be used */
export const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "auth",
  "settings",
  "create-workspace",
  "invite",
  "sign-in",
  "sign-up",
  "app",
  "dashboard",
  "help",
  "support",
  "billing",
  "pricing",
  "docs",
  "blog",
]);

/** Project color palette (predefined options for project creation) */
export const PROJECT_COLORS = [
  "#EF4444", "#F97316", "#F59E0B", "#84CC16",
  "#10B981", "#06B6D4", "#3B82F6", "#6366F1",
  "#8B5CF6", "#A855F7", "#EC4899", "#F43F5E",
  "#14B8A6", "#0EA5E9", "#D946EF", "#78716C",
] as const;
