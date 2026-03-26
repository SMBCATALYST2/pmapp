/**
 * Central type re-exports.
 * All shared types from Prisma and custom relation types.
 */

// Re-export Prisma model types
export type {
  User,
  Workspace,
  WorkspaceMember,
  WorkspaceInvitation,
  Project,
  ProjectFavorite,
  WorkflowStatus,
  Issue,
  IssueLink,
  Label,
  Sprint,
  Comment,
  Activity,
} from "@prisma/client";

// Re-export Prisma enum types
export type {
  Role,
  InvitationStatus,
  StatusCategory,
  IssueType,
  Priority,
  LinkType,
  SprintStatus,
} from "@prisma/client";

// Re-export custom types
export * from "./auth";
export * from "./board";
export * from "./api";

// ============================================================================
// Composite "with relations" types used across the application
// ============================================================================

import type {
  User,
  Workspace,
  WorkspaceMember,
  WorkspaceInvitation,
  Project,
  WorkflowStatus,
  Issue,
  Comment,
  Activity,
  Label,
} from "@prisma/client";

// ----- Issue with relations -----

/** Full issue with all relations (for detail page) */
export type IssueWithRelations = Issue & {
  status: WorkflowStatus;
  assignee: Pick<User, "id" | "name" | "image"> | null;
  reporter: Pick<User, "id" | "name" | "image">;
  labels: Label[];
  project: Pick<Project, "id" | "name" | "prefix" | "workspaceId">;
  _count: {
    comments: number;
    children: number;
  };
};

/** Issue for list view table rows */
export type IssueListItem = Issue & {
  status: Pick<WorkflowStatus, "id" | "name" | "color" | "category">;
  assignee: Pick<User, "id" | "name" | "image"> | null;
  labels: Pick<Label, "id" | "name" | "color">[];
};

// ----- Project with relations -----

/** Project with issue counts per status (for project list) */
export type ProjectWithCounts = Project & {
  _count: {
    issues: number;
  };
  isFavorite: boolean;
};

/** Project with full status configuration */
export type ProjectWithStatuses = Project & {
  statuses: WorkflowStatus[];
};

// ----- Workspace with relations -----

/** Workspace with member count (for switcher) */
export type WorkspaceWithMemberCount = Workspace & {
  _count: {
    members: number;
  };
};

/** Workspace member with user details (for member management) */
export type MemberWithUser = WorkspaceMember & {
  user: Pick<User, "id" | "name" | "email" | "image">;
};

/** Invitation with workspace name (for invite page) */
export type InvitationWithWorkspace = WorkspaceInvitation & {
  workspace: Pick<Workspace, "id" | "name" | "slug" | "image">;
};

// ----- Comment with relations -----

/** Comment with author info */
export type CommentWithAuthor = Comment & {
  author: Pick<User, "id" | "name" | "image">;
};

// ----- Activity with relations -----

/** Activity with actor info */
export type ActivityWithActor = Activity & {
  actor: Pick<User, "id" | "name" | "image">;
};

/** Activity metadata variants */
export type ActivityMetadata =
  | { field: "status"; from: string; to: string }
  | { field: "assignee"; from: string | null; to: string | null }
  | { field: "priority"; from: string; to: string }
  | { field: "type"; from: string; to: string }
  | { field: "title"; from: string; to: string }
  | { field: "description"; from: null; to: null }
  | { field: "dueDate"; from: string | null; to: string | null }
  | { field: "labels"; added: string[]; removed: string[] }
  | { type: "created" }
  | { type: "deleted" }
  | { type: "comment_added"; commentId: string };

// ----- Sidebar navigation -----

/** Project item for sidebar display */
export type SidebarProject = Pick<
  Project,
  "id" | "name" | "prefix" | "icon" | "color"
> & {
  isFavorite: boolean;
};
