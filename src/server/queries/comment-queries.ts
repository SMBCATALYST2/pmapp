/**
 * Comment server queries.
 * Data fetching functions for Server Components.
 *
 * CRITIQUE APPLIED:
 * - All queries verify workspace membership via issue -> project chain
 */

import { db } from "@/lib/db";
import {
  requireAuth,
  requireWorkspaceMember,
} from "@/lib/auth/helpers";
import type { CommentWithAuthor, ActivityWithActor } from "@/types";

/**
 * Get all comments for an issue, ordered by creation date.
 * Verifies workspace membership.
 */
export async function getCommentsByIssue(
  issueId: string,
  workspaceId: string
): Promise<CommentWithAuthor[]> {
  const session = await requireAuth();
  await requireWorkspaceMember(session.userId, workspaceId);

  // Verify the issue belongs to this workspace
  const issue = await db.issue.findFirst({
    where: {
      id: issueId,
      deletedAt: null,
      project: {
        workspaceId,
        deletedAt: null,
      },
    },
    select: { id: true },
  });

  if (!issue) return [];

  return db.comment.findMany({
    where: { issueId },
    include: {
      author: {
        select: { id: true, name: true, image: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Get activity log entries for an issue, ordered by creation date (newest first).
 */
export async function getActivitiesByIssue(
  issueId: string,
  workspaceId: string
): Promise<ActivityWithActor[]> {
  const session = await requireAuth();
  await requireWorkspaceMember(session.userId, workspaceId);

  // Verify the issue belongs to this workspace
  const issue = await db.issue.findFirst({
    where: {
      id: issueId,
      deletedAt: null,
      project: {
        workspaceId,
        deletedAt: null,
      },
    },
    select: { id: true },
  });

  if (!issue) return [];

  return db.activity.findMany({
    where: { issueId },
    include: {
      actor: {
        select: { id: true, name: true, image: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}
