"use server";

/**
 * Comment server actions.
 * Handles comment CRUD with workspace-scoped authorization.
 *
 * CRITIQUE APPLIED:
 * - Tiptap JSON body validated with proper schema
 * - bodyText extracted for search
 * - Workspace isolation via issue -> project -> workspaceId chain
 */

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  createCommentSchema,
  updateCommentSchema,
  deleteCommentSchema,
} from "@/lib/validations/comment";
import {
  requireAuth,
  requireRole,
  requireWorkspaceMember,
} from "@/lib/auth/helpers";
import { errors, withErrorHandling } from "@/lib/errors";
import type { ActionResult } from "@/lib/errors";
import { extractTextFromTiptap } from "@/lib/utils";
import type { Comment } from "@prisma/client";
import { getCommentsByIssue, getActivitiesByIssue } from "@/server/queries/comment-queries";
import type { CommentWithAuthor, ActivityWithActor } from "@/types";

/**
 * Add a comment to an issue. Extracts bodyText for search.
 * Logs COMMENT_ADDED activity.
 * Any workspace member (VIEWER+) can comment.
 */
export async function createComment(
  input: unknown
): Promise<ActionResult<{ comment: Comment }>> {
  return withErrorHandling(async () => {
    const session = await requireAuth();

    const parsed = createCommentSchema.safeParse(input);
    if (!parsed.success) {
      throw errors.validation(
        parsed.error.errors[0]?.message ?? "Invalid input"
      );
    }

    const { issueId, body } = parsed.data;

    // Get issue with workspace scope
    const issue = await db.issue.findFirst({
      where: { id: issueId, deletedAt: null },
      include: {
        project: {
          select: { id: true, workspaceId: true, prefix: true },
        },
      },
    });

    if (!issue) {
      throw errors.notFound("Issue");
    }

    // Any workspace member can comment (VIEWER+)
    await requireWorkspaceMember(session.userId, issue.project.workspaceId);

    const bodyText = extractTextFromTiptap(body);

    const comment = await db.$transaction(async (tx) => {
      const newComment = await tx.comment.create({
        data: {
          body,
          bodyText,
          issueId,
          authorId: session.userId,
        },
      });

      // Log activity
      await tx.activity.create({
        data: {
          type: "COMMENT_ADDED",
          issueId,
          projectId: issue.projectId,
          actorId: session.userId,
          metadata: { type: "comment_added", commentId: newComment.id },
        },
      });

      return newComment;
    });

    const workspace = await db.workspace.findUnique({
      where: { id: issue.project.workspaceId },
      select: { slug: true },
    });
    revalidatePath(
      `/${workspace?.slug}/${issue.project.prefix}/issues/${issue.key}`
    );

    return { comment };
  });
}

/**
 * Update a comment's body. Only the original author can edit.
 */
export async function updateComment(
  input: unknown
): Promise<ActionResult<{ comment: Comment }>> {
  return withErrorHandling(async () => {
    const session = await requireAuth();

    const parsed = updateCommentSchema.safeParse(input);
    if (!parsed.success) {
      throw errors.validation(
        parsed.error.errors[0]?.message ?? "Invalid input"
      );
    }

    const { id, body } = parsed.data;

    // Get comment with issue -> project chain for workspace scope
    const existing = await db.comment.findFirst({
      where: { id },
      include: {
        issue: {
          select: {
            key: true,
            project: {
              select: { workspaceId: true, prefix: true },
            },
          },
        },
      },
    });

    if (!existing) {
      throw errors.notFound("Comment");
    }

    // Verify workspace membership
    await requireWorkspaceMember(
      session.userId,
      existing.issue.project.workspaceId
    );

    // Only the author can edit their comment
    if (existing.authorId !== session.userId) {
      throw errors.forbidden("You can only edit your own comments");
    }

    const bodyText = extractTextFromTiptap(body);

    const comment = await db.comment.update({
      where: { id },
      data: { body, bodyText },
    });

    const workspace = await db.workspace.findUnique({
      where: { id: existing.issue.project.workspaceId },
      select: { slug: true },
    });
    revalidatePath(
      `/${workspace?.slug}/${existing.issue.project.prefix}/issues/${existing.issue.key}`
    );

    return { comment };
  });
}

/**
 * Delete a comment. Author can delete their own; ADMIN+ can delete any.
 */
export async function deleteComment(
  input: unknown
): Promise<ActionResult<void>> {
  return withErrorHandling(async () => {
    const session = await requireAuth();

    const parsed = deleteCommentSchema.safeParse(input);
    if (!parsed.success) {
      throw errors.validation(
        parsed.error.errors[0]?.message ?? "Invalid input"
      );
    }

    const { id } = parsed.data;

    // Get comment with workspace scope chain
    const existing = await db.comment.findFirst({
      where: { id },
      include: {
        issue: {
          select: {
            key: true,
            project: {
              select: { workspaceId: true, prefix: true },
            },
          },
        },
      },
    });

    if (!existing) {
      throw errors.notFound("Comment");
    }

    const { role } = await requireWorkspaceMember(
      session.userId,
      existing.issue.project.workspaceId
    );

    // Author can delete their own; ADMIN+ can delete any
    if (
      existing.authorId !== session.userId &&
      role !== "ADMIN" &&
      role !== "OWNER"
    ) {
      throw errors.forbidden(
        "You can only delete your own comments"
      );
    }

    await db.comment.delete({ where: { id } });

    const workspace = await db.workspace.findUnique({
      where: { id: existing.issue.project.workspaceId },
      select: { slug: true },
    });
    revalidatePath(
      `/${workspace?.slug}/${existing.issue.project.prefix}/issues/${existing.issue.key}`
    );
  });
}
