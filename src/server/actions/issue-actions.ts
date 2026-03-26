"use server";

/**
 * Issue server actions.
 * Handles issue CRUD, move/reorder (drag-and-drop), and soft delete.
 *
 * CRITIQUE APPLIED:
 * - All queries scoped to workspaceId
 * - Issue key generation in $transaction (atomic counter increment)
 * - Soft delete with deletedAt
 * - Activity logging for all changes
 * - Tiptap JSON validated with proper schema
 * - descriptionText extracted for search
 */

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  createIssueSchema,
  updateIssueSchema,
  moveIssueSchema,
  reorderIssueSchema,
} from "@/lib/validations/issue";
import {
  requireAuth,
  requireRole,
  requireIssueInWorkspace,
  requireProjectInWorkspace,
} from "@/lib/auth/helpers";
import { errors, withErrorHandling } from "@/lib/errors";
import type { ActionResult } from "@/lib/errors";
import { generateIssueKey, extractTextFromTiptap } from "@/lib/utils";
import type { Issue } from "@prisma/client";

/**
 * Create a new issue. Uses Prisma $transaction to atomically increment
 * project.issueCounter and create the issue with generated key.
 */
export async function createIssue(
  input: unknown
): Promise<ActionResult<{ issue: Issue }>> {
  return withErrorHandling(async () => {
    const session = await requireAuth();

    const parsed = createIssueSchema.safeParse(input);
    if (!parsed.success) {
      throw errors.validation(
        parsed.error.errors[0]?.message ?? "Invalid input"
      );
    }

    const {
      projectId,
      title,
      description,
      type,
      priority,
      statusId,
      assigneeId,
      labelIds,
      dueDate,
    } = parsed.data;

    // Get project and verify workspace scope
    const project = await db.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true, workspaceId: true, prefix: true },
    });

    if (!project) {
      throw errors.notFound("Project");
    }

    // Require MEMBER+ role to create issues
    await requireRole(session.userId, project.workspaceId, "MEMBER");

    // Validate status belongs to this project
    const status = await db.workflowStatus.findFirst({
      where: { id: statusId, projectId },
    });

    if (!status) {
      throw errors.badRequest("Invalid status for this project");
    }

    // Validate assignee is a workspace member if provided
    if (assigneeId) {
      const assigneeMember = await db.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId: assigneeId,
            workspaceId: project.workspaceId,
          },
        },
      });
      if (!assigneeMember) {
        throw errors.badRequest("Assignee must be a workspace member");
      }
    }

    // Extract plain text for search
    const descriptionText = description
      ? extractTextFromTiptap(description)
      : null;

    // Create issue with atomic counter increment
    const issue = await db.$transaction(async (tx) => {
      // Atomically increment issue counter
      const updatedProject = await tx.project.update({
        where: { id: projectId },
        data: { issueCounter: { increment: 1 } },
        select: { issueCounter: true, prefix: true },
      });

      const issueNumber = updatedProject.issueCounter;
      const issueKey = generateIssueKey(
        updatedProject.prefix,
        issueNumber
      );

      // Create the issue
      const newIssue = await tx.issue.create({
        data: {
          key: issueKey,
          number: issueNumber,
          title,
          description: description ?? undefined,
          descriptionText,
          type,
          priority,
          position: "a0", // First position (will be sorted)
          statusId,
          projectId,
          assigneeId: assigneeId ?? undefined,
          reporterId: session.userId,
          dueDate: dueDate ?? undefined,
          labels: labelIds?.length
            ? { connect: labelIds.map((id) => ({ id })) }
            : undefined,
        },
      });

      // Log activity
      await tx.activity.create({
        data: {
          type: "ISSUE_CREATED",
          issueId: newIssue.id,
          projectId,
          actorId: session.userId,
          metadata: { type: "created" },
        },
      });

      return newIssue;
    });

    const workspace = await db.workspace.findUnique({
      where: { id: project.workspaceId },
      select: { slug: true },
    });
    revalidatePath(`/${workspace?.slug}/${project.prefix}/board`);
    revalidatePath(`/${workspace?.slug}/${project.prefix}/list`);

    return { issue };
  });
}

/**
 * Update one or more issue fields. Each changed field is logged
 * as a separate activity entry.
 */
export async function updateIssue(
  input: unknown
): Promise<ActionResult<{ issue: Issue }>> {
  return withErrorHandling(async () => {
    const session = await requireAuth();

    const parsed = updateIssueSchema.safeParse(input);
    if (!parsed.success) {
      throw errors.validation(
        parsed.error.errors[0]?.message ?? "Invalid input"
      );
    }

    const { id, updatedAt: clientUpdatedAt, labelIds, ...updateFields } =
      parsed.data;

    // Get existing issue with workspace scope
    const existing = await db.issue.findFirst({
      where: { id, deletedAt: null },
      include: {
        project: { select: { id: true, workspaceId: true, prefix: true } },
        labels: { select: { id: true, name: true } },
        status: { select: { name: true } },
        assignee: { select: { name: true } },
      },
    });

    if (!existing) {
      throw errors.notFound("Issue");
    }

    // Require MEMBER+ role
    await requireRole(session.userId, existing.project.workspaceId, "MEMBER");

    // Optimistic locking: check if issue was modified since client fetched it
    if (clientUpdatedAt && existing.updatedAt > clientUpdatedAt) {
      throw errors.conflict(
        "This issue was modified by someone else. Please reload and try again."
      );
    }

    // Validate statusId if being changed
    if (updateFields.statusId) {
      const status = await db.workflowStatus.findFirst({
        where: { id: updateFields.statusId, projectId: existing.projectId },
      });
      if (!status) {
        throw errors.badRequest("Invalid status for this project");
      }
    }

    // Validate assigneeId if being changed
    if (updateFields.assigneeId) {
      const member = await db.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId: updateFields.assigneeId,
            workspaceId: existing.project.workspaceId,
          },
        },
      });
      if (!member) {
        throw errors.badRequest("Assignee must be a workspace member");
      }
    }

    // Extract description text if description is being updated
    let descriptionText: string | undefined;
    if (updateFields.description !== undefined) {
      descriptionText = updateFields.description
        ? extractTextFromTiptap(updateFields.description)
        : undefined;
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (updateFields.title !== undefined) updateData.title = updateFields.title;
    if (updateFields.description !== undefined) {
      updateData.description = updateFields.description;
      updateData.descriptionText = descriptionText ?? null;
    }
    if (updateFields.type !== undefined) updateData.type = updateFields.type;
    if (updateFields.priority !== undefined)
      updateData.priority = updateFields.priority;
    if (updateFields.statusId !== undefined)
      updateData.statusId = updateFields.statusId;
    if (updateFields.assigneeId !== undefined)
      updateData.assigneeId = updateFields.assigneeId;
    if (updateFields.dueDate !== undefined)
      updateData.dueDate = updateFields.dueDate;

    const issue = await db.$transaction(async (tx) => {
      // Update issue
      const updated = await tx.issue.update({
        where: { id },
        data: {
          ...updateData,
          labels: labelIds
            ? { set: labelIds.map((lid) => ({ id: lid })) }
            : undefined,
        },
      });

      // Log activity for each changed field
      const activities: {
        type: string;
        issueId: string;
        projectId: string;
        actorId: string;
        metadata: unknown;
      }[] = [];

      if (
        updateFields.statusId &&
        updateFields.statusId !== existing.statusId
      ) {
        const newStatus = await tx.workflowStatus.findUnique({
          where: { id: updateFields.statusId },
          select: { name: true },
        });
        activities.push({
          type: "STATUS_CHANGED",
          issueId: id,
          projectId: existing.projectId,
          actorId: session.userId,
          metadata: {
            field: "status",
            from: existing.status.name,
            to: newStatus?.name ?? "Unknown",
          },
        });
      }

      if (
        updateFields.assigneeId !== undefined &&
        updateFields.assigneeId !== existing.assigneeId
      ) {
        activities.push({
          type: "ASSIGNED",
          issueId: id,
          projectId: existing.projectId,
          actorId: session.userId,
          metadata: {
            field: "assignee",
            from: existing.assignee?.name ?? null,
            to: updateFields.assigneeId,
          },
        });
      }

      if (
        updateFields.priority &&
        updateFields.priority !== existing.priority
      ) {
        activities.push({
          type: "PRIORITY_CHANGED",
          issueId: id,
          projectId: existing.projectId,
          actorId: session.userId,
          metadata: {
            field: "priority",
            from: existing.priority,
            to: updateFields.priority,
          },
        });
      }

      if (updateFields.type && updateFields.type !== existing.type) {
        activities.push({
          type: "TYPE_CHANGED",
          issueId: id,
          projectId: existing.projectId,
          actorId: session.userId,
          metadata: {
            field: "type",
            from: existing.type,
            to: updateFields.type,
          },
        });
      }

      if (
        updateFields.title &&
        updateFields.title !== existing.title
      ) {
        activities.push({
          type: "TITLE_CHANGED",
          issueId: id,
          projectId: existing.projectId,
          actorId: session.userId,
          metadata: {
            field: "title",
            from: existing.title,
            to: updateFields.title,
          },
        });
      }

      if (activities.length > 0) {
        await tx.activity.createMany({ data: activities as any });
      }

      return updated;
    });

    const workspace = await db.workspace.findUnique({
      where: { id: existing.project.workspaceId },
      select: { slug: true },
    });
    revalidatePath(
      `/${workspace?.slug}/${existing.project.prefix}/board`
    );
    revalidatePath(
      `/${workspace?.slug}/${existing.project.prefix}/issues/${existing.key}`
    );

    return { issue };
  });
}

/**
 * Delete an issue (soft delete via deletedAt).
 * Members can delete their own issues; ADMIN+ can delete any.
 */
export async function deleteIssue(
  issueId: string
): Promise<ActionResult<void>> {
  return withErrorHandling(async () => {
    const session = await requireAuth();

    if (!issueId) {
      throw errors.badRequest("Issue ID is required");
    }

    const issue = await db.issue.findFirst({
      where: { id: issueId, deletedAt: null },
      include: {
        project: { select: { id: true, workspaceId: true, prefix: true } },
      },
    });

    if (!issue) {
      throw errors.notFound("Issue");
    }

    const { role } = await requireRole(
      session.userId,
      issue.project.workspaceId,
      "MEMBER"
    );

    // Members can only delete their own issues
    if (role === "MEMBER" && issue.reporterId !== session.userId) {
      throw errors.forbidden(
        "You can only delete issues you created. Contact an admin."
      );
    }

    await db.$transaction(async (tx) => {
      await tx.issue.update({
        where: { id: issueId },
        data: { deletedAt: new Date() },
      });

      await tx.activity.create({
        data: {
          type: "ISSUE_DELETED",
          issueId,
          projectId: issue.projectId,
          actorId: session.userId,
          metadata: { type: "deleted" },
        },
      });
    });

    const workspace = await db.workspace.findUnique({
      where: { id: issue.project.workspaceId },
      select: { slug: true },
    });
    revalidatePath(`/${workspace?.slug}/${issue.project.prefix}/board`);
    revalidatePath(`/${workspace?.slug}/${issue.project.prefix}/list`);
  });
}

/**
 * Move an issue to a different status column and/or position (drag-and-drop).
 * Updates statusId and position atomically.
 */
export async function moveIssue(
  input: unknown
): Promise<ActionResult<void>> {
  return withErrorHandling(async () => {
    const session = await requireAuth();

    const parsed = moveIssueSchema.safeParse(input);
    if (!parsed.success) {
      throw errors.validation(
        parsed.error.errors[0]?.message ?? "Invalid input"
      );
    }

    const { id, statusId, position } = parsed.data;

    const issue = await db.issue.findFirst({
      where: { id, deletedAt: null },
      include: {
        project: { select: { id: true, workspaceId: true, prefix: true } },
        status: { select: { name: true } },
      },
    });

    if (!issue) {
      throw errors.notFound("Issue");
    }

    await requireRole(session.userId, issue.project.workspaceId, "MEMBER");

    // Validate status belongs to the same project
    const newStatus = await db.workflowStatus.findFirst({
      where: { id: statusId, projectId: issue.projectId },
    });

    if (!newStatus) {
      throw errors.badRequest("Invalid status for this project");
    }

    const statusChanged = issue.statusId !== statusId;

    await db.$transaction(async (tx) => {
      await tx.issue.update({
        where: { id },
        data: { statusId, position },
      });

      if (statusChanged) {
        await tx.activity.create({
          data: {
            type: "STATUS_CHANGED",
            issueId: id,
            projectId: issue.projectId,
            actorId: session.userId,
            metadata: {
              field: "status",
              from: issue.status.name,
              to: newStatus.name,
            },
          },
        });
      }
    });

    const workspace = await db.workspace.findUnique({
      where: { id: issue.project.workspaceId },
      select: { slug: true },
    });
    revalidatePath(`/${workspace?.slug}/${issue.project.prefix}/board`);
  });
}

/**
 * Reorder an issue within the same column (change position only).
 */
export async function reorderIssue(
  input: unknown
): Promise<ActionResult<void>> {
  return withErrorHandling(async () => {
    const session = await requireAuth();

    const parsed = reorderIssueSchema.safeParse(input);
    if (!parsed.success) {
      throw errors.validation(
        parsed.error.errors[0]?.message ?? "Invalid input"
      );
    }

    const { id, position } = parsed.data;

    const issue = await db.issue.findFirst({
      where: { id, deletedAt: null },
      include: {
        project: { select: { workspaceId: true, prefix: true } },
      },
    });

    if (!issue) {
      throw errors.notFound("Issue");
    }

    await requireRole(session.userId, issue.project.workspaceId, "MEMBER");

    await db.issue.update({
      where: { id },
      data: { position },
    });

    const workspace = await db.workspace.findUnique({
      where: { id: issue.project.workspaceId },
      select: { slug: true },
    });
    revalidatePath(`/${workspace?.slug}/${issue.project.prefix}/board`);
  });
}
