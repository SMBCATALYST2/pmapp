/**
 * Dashboard server queries.
 * Aggregation queries for workspace-level dashboards.
 *
 * CRITIQUE APPLIED:
 * - All queries scoped to workspaceId
 * - deletedAt: null on all issue counts
 */

import { db } from "@/lib/db";
import {
  requireAuth,
  requireWorkspaceMember,
} from "@/lib/auth/helpers";
import type { Priority, IssueType, StatusCategory } from "@prisma/client";

export interface DashboardData {
  /** Issue counts by status category across all projects */
  issuesByStatusCategory: Record<StatusCategory, number>;
  /** Issue counts by priority across all projects */
  issuesByPriority: Record<Priority, number>;
  /** Issue counts by type across all projects */
  issuesByType: Record<IssueType, number>;
  /** Total active issues */
  totalIssues: number;
  /** Issues assigned to current user */
  myIssuesCount: number;
  /** Recent activity items */
  recentActivity: {
    id: string;
    type: string;
    metadata: unknown;
    createdAt: Date;
    actor: { id: string; name: string | null; image: string | null };
    issue: { key: string; title: string } | null;
  }[];
}

/**
 * Get aggregated dashboard data for a workspace.
 * Returns issue counts by status category, priority, and type.
 */
export async function getDashboardData(
  workspaceId: string
): Promise<DashboardData> {
  const session = await requireAuth();
  await requireWorkspaceMember(session.userId, workspaceId);

  // Get all active issues in workspace
  const baseWhere = {
    deletedAt: null as Date | null,
    project: {
      workspaceId,
      deletedAt: null as Date | null,
    },
  };

  // Pre-fetch project IDs for activity query (avoids inline await in Promise.all)
  const projectIds = await db.project
    .findMany({
      where: { workspaceId, deletedAt: null },
      select: { id: true },
    })
    .then((ps) => ps.map((p) => p.id));

  const [
    totalIssues,
    myIssuesCount,
    issuesByPriorityRaw,
    issuesByTypeRaw,
    issuesByCategoryRaw,
    recentActivity,
  ] = await Promise.all([
    // Total issues
    db.issue.count({ where: baseWhere }),

    // My issues
    db.issue.count({
      where: {
        ...baseWhere,
        assigneeId: session.userId,
      },
    }),

    // Issues by priority
    db.issue.groupBy({
      by: ["priority"],
      where: baseWhere,
      _count: { id: true },
    }),

    // Issues by type
    db.issue.groupBy({
      by: ["type"],
      where: baseWhere,
      _count: { id: true },
    }),

    // Issues by status category — use raw SQL for aggregation instead of loading all issues
    db.$queryRaw<{ category: string; count: bigint }[]>`
      SELECT ws."category", COUNT(i."id") as count
      FROM "Issue" i
      JOIN "WorkflowStatus" ws ON i."statusId" = ws."id"
      JOIN "Project" p ON i."projectId" = p."id"
      WHERE i."deletedAt" IS NULL
        AND p."workspaceId" = ${workspaceId}
        AND p."deletedAt" IS NULL
      GROUP BY ws."category"
    `,

    // Recent activity (last 20)
    db.activity.findMany({
      where: {
        projectId: { in: projectIds },
      },
      include: {
        actor: { select: { id: true, name: true, image: true } },
        issue: { select: { key: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  // Aggregate priority counts
  const issuesByPriority: Record<Priority, number> = {
    URGENT: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    NONE: 0,
  };
  for (const row of issuesByPriorityRaw) {
    issuesByPriority[row.priority] = row._count.id;
  }

  // Aggregate type counts
  const issuesByType: Record<IssueType, number> = {
    EPIC: 0,
    STORY: 0,
    TASK: 0,
    BUG: 0,
  };
  for (const row of issuesByTypeRaw) {
    issuesByType[row.type] = row._count.id;
  }

  // Aggregate status category counts from raw SQL result
  const issuesByStatusCategory: Record<StatusCategory, number> = {
    BACKLOG: 0,
    TODO: 0,
    IN_PROGRESS: 0,
    DONE: 0,
    CANCELLED: 0,
  };
  for (const row of issuesByCategoryRaw) {
    const category = row.category as StatusCategory;
    if (category in issuesByStatusCategory) {
      issuesByStatusCategory[category] = Number(row.count);
    }
  }

  return {
    issuesByStatusCategory,
    issuesByPriority,
    issuesByType,
    totalIssues,
    myIssuesCount,
    recentActivity,
  };
}
