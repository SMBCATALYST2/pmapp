/**
 * Label server queries.
 * Data fetching functions for Server Components.
 *
 * CRITIQUE APPLIED:
 * - All queries scoped to workspaceId
 */

import { db } from "@/lib/db";
import {
  requireAuth,
  requireWorkspaceMember,
} from "@/lib/auth/helpers";
import type { Label } from "@prisma/client";

/**
 * Get all labels for a workspace, ordered alphabetically.
 */
export async function getLabelsByWorkspace(
  workspaceId: string
): Promise<Label[]> {
  const session = await requireAuth();
  await requireWorkspaceMember(session.userId, workspaceId);

  return db.label.findMany({
    where: { workspaceId },
    orderBy: { name: "asc" },
  });
}

/**
 * Get labels used by issues in a specific project.
 * Useful for project-scoped label filters.
 */
export async function getLabelsByProject(
  workspaceId: string,
  projectId: string
): Promise<Label[]> {
  const session = await requireAuth();
  await requireWorkspaceMember(session.userId, workspaceId);

  return db.label.findMany({
    where: {
      workspaceId,
      issues: {
        some: {
          projectId,
          deletedAt: null,
        },
      },
    },
    orderBy: { name: "asc" },
  });
}
