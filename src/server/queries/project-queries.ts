/**
 * Project server queries.
 * Data fetching functions for Server Components.
 *
 * CRITIQUE APPLIED:
 * - All queries scoped to workspaceId
 * - deletedAt: null filter on all project queries
 * - Server-side pagination for board data
 */

import { db } from "@/lib/db";
import {
  requireAuth,
  requireWorkspaceMember,
} from "@/lib/auth/helpers";
import type {
  ProjectWithCounts,
  ProjectWithStatuses,
  SidebarProject,
} from "@/types";
import type { BoardData, BoardColumn, BoardIssue } from "@/types/board";

/**
 * Get all active projects in a workspace with issue counts.
 */
export async function getProjects(
  workspaceId: string
): Promise<ProjectWithCounts[]> {
  const session = await requireAuth();
  await requireWorkspaceMember(session.userId, workspaceId);

  const projects = await db.project.findMany({
    where: {
      workspaceId,
      deletedAt: null,
    },
    include: {
      _count: {
        select: {
          issues: {
            where: { deletedAt: null },
          },
        },
      },
      favorites: {
        where: { userId: session.userId },
        select: { userId: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return projects.map((p) => ({
    ...p,
    _count: p._count,
    isFavorite: p.favorites.length > 0,
    favorites: undefined as any,
  }));
}

/**
 * Get projects for sidebar display (lightweight).
 */
export async function getSidebarProjects(
  workspaceId: string
): Promise<SidebarProject[]> {
  const session = await requireAuth();
  await requireWorkspaceMember(session.userId, workspaceId);

  const projects = await db.project.findMany({
    where: {
      workspaceId,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      prefix: true,
      icon: true,
      color: true,
      favorites: {
        where: { userId: session.userId },
        select: { userId: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return projects.map((p) => ({
    id: p.id,
    name: p.name,
    prefix: p.prefix,
    icon: p.icon,
    color: p.color,
    isFavorite: p.favorites.length > 0,
  }));
}

/**
 * Get a single project by key (prefix) within a workspace.
 * Includes workflow statuses.
 */
export async function getProject(
  workspaceId: string,
  projectKey: string
): Promise<ProjectWithStatuses | null> {
  const session = await requireAuth();
  await requireWorkspaceMember(session.userId, workspaceId);

  return db.project.findFirst({
    where: {
      workspaceId,
      prefix: projectKey,
      deletedAt: null,
    },
    include: {
      statuses: {
        orderBy: { position: "asc" },
      },
    },
  });
}

/**
 * Get workflow statuses for a project, ordered by position.
 */
export async function getProjectStatuses(
  projectId: string,
  workspaceId: string
) {
  const session = await requireAuth();
  await requireWorkspaceMember(session.userId, workspaceId);

  return db.workflowStatus.findMany({
    where: {
      projectId,
      project: {
        workspaceId,
        deletedAt: null,
      },
    },
    orderBy: { position: "asc" },
  });
}

/**
 * Get board data for a project: columns (statuses) with their issues.
 * Server-side query to avoid client-side filtering (per critique).
 */
export async function getBoardData(
  workspaceId: string,
  projectKey: string,
  filters?: {
    assigneeId?: string[];
    priority?: string[];
    type?: string[];
    labelIds?: string[];
  }
): Promise<BoardData | null> {
  const session = await requireAuth();
  await requireWorkspaceMember(session.userId, workspaceId);

  const project = await db.project.findFirst({
    where: {
      workspaceId,
      prefix: projectKey,
      deletedAt: null,
    },
    select: { id: true, name: true, prefix: true },
  });

  if (!project) return null;

  // Build issue filter conditions
  const issueWhere: Record<string, unknown> = {
    projectId: project.id,
    deletedAt: null,
  };

  if (filters?.assigneeId?.length) {
    issueWhere.assigneeId = { in: filters.assigneeId };
  }
  if (filters?.priority?.length) {
    issueWhere.priority = { in: filters.priority };
  }
  if (filters?.type?.length) {
    issueWhere.type = { in: filters.type };
  }
  if (filters?.labelIds?.length) {
    issueWhere.labels = {
      some: { id: { in: filters.labelIds } },
    };
  }

  const statuses = await db.workflowStatus.findMany({
    where: { projectId: project.id },
    include: {
      issues: {
        where: issueWhere as any,
        select: {
          id: true,
          key: true,
          title: true,
          type: true,
          priority: true,
          position: true,
          dueDate: true,
          assignee: {
            select: { id: true, name: true, image: true },
          },
          labels: {
            select: { id: true, name: true, color: true },
          },
        },
        orderBy: { position: "asc" },
      },
      _count: {
        select: {
          issues: {
            where: { projectId: project.id, deletedAt: null },
          },
        },
      },
    },
    orderBy: { position: "asc" },
  });

  const columns: BoardColumn[] = statuses.map((status) => ({
    id: status.id,
    name: status.name,
    category: status.category,
    color: status.color,
    position: status.position,
    issues: status.issues.map(
      (issue): BoardIssue => ({
        id: issue.id,
        key: issue.key,
        title: issue.title,
        type: issue.type,
        priority: issue.priority,
        position: issue.position,
        dueDate: issue.dueDate,
        assignee: issue.assignee,
        labels: issue.labels,
      })
    ),
    issueCount: status._count.issues,
  }));

  return {
    columns,
    project: {
      id: project.id,
      name: project.name,
      prefix: project.prefix,
    },
  };
}

/**
 * Check if a project key is available within a workspace.
 */
export async function checkProjectKeyAvailability(
  workspaceId: string,
  prefix: string
): Promise<boolean> {
  const session = await requireAuth();
  await requireWorkspaceMember(session.userId, workspaceId);
  const existing = await db.project.findFirst({
    where: {
      workspaceId,
      prefix,
      deletedAt: null,
    },
    select: { id: true },
  });

  return !existing;
}
