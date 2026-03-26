/**
 * Issue server queries.
 * Data fetching functions for Server Components.
 *
 * CRITIQUE APPLIED:
 * - All queries scoped to workspaceId
 * - deletedAt: null filter on all issue queries
 * - Server-side filtering and pagination
 */

import { db } from "@/lib/db";
import {
  requireAuth,
  requireWorkspaceMember,
} from "@/lib/auth/helpers";
import type {
  IssueWithRelations,
  IssueListItem,
  PaginatedResponse,
} from "@/types";

/**
 * Get full issue detail by key (e.g., "PROJ-123").
 * Includes status, assignee, reporter, labels, and counts.
 */
export async function getIssue(
  workspaceId: string,
  issueKey: string
): Promise<IssueWithRelations | null> {
  const session = await requireAuth();
  await requireWorkspaceMember(session.userId, workspaceId);

  return db.issue.findFirst({
    where: {
      key: issueKey,
      deletedAt: null,
      project: {
        workspaceId,
        deletedAt: null,
      },
    },
    include: {
      status: true,
      assignee: {
        select: { id: true, name: true, image: true },
      },
      reporter: {
        select: { id: true, name: true, image: true },
      },
      labels: true,
      project: {
        select: { id: true, name: true, prefix: true, workspaceId: true },
      },
      _count: {
        select: { comments: true, children: true },
      },
    },
  }) as Promise<IssueWithRelations | null>;
}

/**
 * Get issues for a project list view with pagination.
 * Supports filtering by status, assignee, priority, type, labels.
 */
export async function getIssuesByProject(
  workspaceId: string,
  projectId: string,
  options?: {
    cursor?: string;
    limit?: number;
    filters?: {
      status?: string[];
      assigneeId?: string[];
      priority?: string[];
      type?: string[];
      labelIds?: string[];
      search?: string;
    };
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }
): Promise<PaginatedResponse<IssueListItem>> {
  const session = await requireAuth();
  await requireWorkspaceMember(session.userId, workspaceId);

  const limit = options?.limit ?? 50;
  const filters = options?.filters;

  // Build where clause
  const where: Record<string, unknown> = {
    projectId,
    deletedAt: null,
    project: {
      workspaceId,
      deletedAt: null,
    },
  };

  if (filters?.status?.length) {
    where.statusId = { in: filters.status };
  }
  if (filters?.assigneeId?.length) {
    where.assigneeId = { in: filters.assigneeId };
  }
  if (filters?.priority?.length) {
    where.priority = { in: filters.priority };
  }
  if (filters?.type?.length) {
    where.type = { in: filters.type };
  }
  if (filters?.labelIds?.length) {
    where.labels = {
      some: { id: { in: filters.labelIds } },
    };
  }
  if (filters?.search) {
    where.OR = [
      { title: { contains: filters.search, mode: "insensitive" } },
      { key: { contains: filters.search, mode: "insensitive" } },
      { descriptionText: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  // Determine sort
  const sortField = options?.sortBy ?? "createdAt";
  const sortOrder = options?.sortOrder ?? "desc";

  const [items, totalCount] = await Promise.all([
    db.issue.findMany({
      where: where as any,
      include: {
        status: {
          select: { id: true, name: true, color: true, category: true },
        },
        assignee: {
          select: { id: true, name: true, image: true },
        },
        labels: {
          select: { id: true, name: true, color: true },
        },
      },
      orderBy: { [sortField]: sortOrder },
      take: limit + 1, // Fetch one extra to determine if there's a next page
      ...(options?.cursor
        ? {
            cursor: { id: options.cursor },
            skip: 1,
          }
        : {}),
    }) as Promise<IssueListItem[]>,
    db.issue.count({ where: where as any }),
  ]);

  const hasMore = items.length > limit;
  const resultItems = hasMore ? items.slice(0, limit) : items;

  return {
    items: resultItems,
    nextCursor: hasMore ? resultItems[resultItems.length - 1]?.id ?? null : null,
    totalCount,
  };
}

/**
 * Get issues grouped by status for a project.
 * Used for the board view initial data load.
 */
export async function getIssuesByStatus(
  workspaceId: string,
  projectId: string,
  statusId: string
): Promise<IssueListItem[]> {
  const session = await requireAuth();
  await requireWorkspaceMember(session.userId, workspaceId);

  return db.issue.findMany({
    where: {
      projectId,
      statusId,
      deletedAt: null,
      project: {
        workspaceId,
        deletedAt: null,
      },
    },
    include: {
      status: {
        select: { id: true, name: true, color: true, category: true },
      },
      assignee: {
        select: { id: true, name: true, image: true },
      },
      labels: {
        select: { id: true, name: true, color: true },
      },
    },
    orderBy: { position: "asc" },
  }) as Promise<IssueListItem[]>;
}

/**
 * Search issues across a workspace by title, key, or description.
 * Used for the Cmd+K command palette.
 */
export async function searchIssues(
  workspaceId: string,
  query: string,
  limit: number = 10
) {
  const session = await requireAuth();
  await requireWorkspaceMember(session.userId, workspaceId);

  return db.issue.findMany({
    where: {
      deletedAt: null,
      project: {
        workspaceId,
        deletedAt: null,
      },
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { key: { contains: query, mode: "insensitive" } },
        { descriptionText: { contains: query, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      key: true,
      title: true,
      status: {
        select: { name: true, color: true },
      },
      assignee: {
        select: { name: true, image: true },
      },
      project: {
        select: {
          name: true,
          prefix: true,
          color: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
}
