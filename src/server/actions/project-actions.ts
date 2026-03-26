"use server";

/**
 * Project server actions.
 * Handles project CRUD, archival, and favorite toggling.
 *
 * CRITIQUE APPLIED:
 * - All queries scoped to workspaceId
 * - Project prefix immutable after creation
 * - Default workflow statuses seeded on project creation
 * - Soft delete (deletedAt) for archive
 */

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  createProjectSchema,
  updateProjectSchema,
} from "@/lib/validations/project";
import {
  requireAuth,
  requireRole,
  requireProjectInWorkspace,
  requireWorkspaceMember,
} from "@/lib/auth/helpers";
import { errors, withErrorHandling } from "@/lib/errors";
import type { ActionResult } from "@/lib/errors";
import { DEFAULT_STATUSES } from "@/lib/constants";
import type { Project } from "@prisma/client";

/**
 * Create a new project within a workspace.
 * Validates prefix uniqueness within workspace.
 * Seeds default workflow statuses.
 */
export async function createProject(
  input: unknown
): Promise<ActionResult<{ project: Project }>> {
  return withErrorHandling(async () => {
    const session = await requireAuth();

    const parsed = createProjectSchema.safeParse(input);
    if (!parsed.success) {
      throw errors.validation(
        parsed.error.errors[0]?.message ?? "Invalid input"
      );
    }

    const { workspaceId, name, prefix, description, icon, color, leadId } =
      parsed.data;

    // Require ADMIN+ role to create projects
    await requireRole(session.userId, workspaceId, "ADMIN");

    // Check prefix uniqueness within workspace
    const existingProject = await db.project.findFirst({
      where: {
        workspaceId,
        prefix,
        deletedAt: null,
      },
    });

    if (existingProject) {
      throw errors.conflict("This project key is already in use");
    }

    // Validate leadId is a workspace member if provided
    if (leadId) {
      const leadMember = await db.workspaceMember.findUnique({
        where: {
          userId_workspaceId: { userId: leadId, workspaceId },
        },
      });
      if (!leadMember) {
        throw errors.badRequest(
          "Project lead must be a member of the workspace"
        );
      }
    }

    // Create project with default workflow statuses in transaction
    const project = await db.$transaction(async (tx) => {
      const proj = await tx.project.create({
        data: {
          name,
          prefix,
          description,
          icon,
          color,
          workspaceId,
          leadId,
          issueCounter: 0,
        },
      });

      // Seed default workflow statuses
      await tx.workflowStatus.createMany({
        data: DEFAULT_STATUSES.map((status) => ({
          ...status,
          projectId: proj.id,
        })),
      });

      return proj;
    });

    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: { slug: true },
    });
    revalidatePath(`/${workspace?.slug}/projects`);

    return { project };
  });
}

/**
 * Update project metadata (name, description, icon, color, lead).
 * Prefix is NOT editable after creation.
 */
export async function updateProject(
  input: unknown
): Promise<ActionResult<{ project: Project }>> {
  return withErrorHandling(async () => {
    const session = await requireAuth();

    const parsed = updateProjectSchema.safeParse(input);
    if (!parsed.success) {
      throw errors.validation(
        parsed.error.errors[0]?.message ?? "Invalid input"
      );
    }

    const { id, ...updateData } = parsed.data;

    // Get project and verify workspace scope
    const existingProject = await db.project.findFirst({
      where: { id, deletedAt: null },
      select: { workspaceId: true, prefix: true },
    });

    if (!existingProject) {
      throw errors.notFound("Project");
    }

    // Require ADMIN+ role
    await requireRole(session.userId, existingProject.workspaceId, "ADMIN");

    // Validate leadId is a workspace member if provided
    if (updateData.leadId) {
      const leadMember = await db.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId: updateData.leadId,
            workspaceId: existingProject.workspaceId,
          },
        },
      });
      if (!leadMember) {
        throw errors.badRequest(
          "Project lead must be a member of the workspace"
        );
      }
    }

    const project = await db.project.update({
      where: { id },
      data: updateData,
    });

    const workspace = await db.workspace.findUnique({
      where: { id: existingProject.workspaceId },
      select: { slug: true },
    });
    revalidatePath(`/${workspace?.slug}/${existingProject.prefix}/settings`);

    return { project };
  });
}

/**
 * Archive a project (soft delete via deletedAt).
 * Issues become read-only. Hidden from active project list.
 */
export async function archiveProject(
  projectId: string
): Promise<ActionResult<void>> {
  return withErrorHandling(async () => {
    const session = await requireAuth();

    if (!projectId) {
      throw errors.badRequest("Project ID is required");
    }

    const project = await db.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { workspaceId: true, prefix: true },
    });

    if (!project) {
      throw errors.notFound("Project");
    }

    // Require ADMIN+ role
    await requireRole(session.userId, project.workspaceId, "ADMIN");

    await db.project.update({
      where: { id: projectId },
      data: { deletedAt: new Date() },
    });

    const workspace = await db.workspace.findUnique({
      where: { id: project.workspaceId },
      select: { slug: true },
    });
    revalidatePath(`/${workspace?.slug}/projects`);
  });
}

/**
 * Toggle starred/favorite status for current user.
 * Creates or deletes ProjectFavorite record.
 */
export async function toggleProjectFavorite(
  projectId: string
): Promise<ActionResult<{ isFavorite: boolean }>> {
  return withErrorHandling(async () => {
    const session = await requireAuth();

    if (!projectId) {
      throw errors.badRequest("Project ID is required");
    }

    const project = await db.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { workspaceId: true },
    });

    if (!project) {
      throw errors.notFound("Project");
    }

    // Require at least VIEWER membership
    await requireWorkspaceMember(session.userId, project.workspaceId);

    // Check if already favorited
    const existingFavorite = await db.projectFavorite.findUnique({
      where: {
        userId_projectId: {
          userId: session.userId,
          projectId,
        },
      },
    });

    if (existingFavorite) {
      await db.projectFavorite.delete({
        where: {
          userId_projectId: {
            userId: session.userId,
            projectId,
          },
        },
      });

      const workspace = await db.workspace.findUnique({
        where: { id: project.workspaceId },
        select: { slug: true },
      });
      revalidatePath(`/${workspace?.slug}`);
      return { isFavorite: false };
    } else {
      await db.projectFavorite.create({
        data: {
          userId: session.userId,
          projectId,
        },
      });

      const workspace = await db.workspace.findUnique({
        where: { id: project.workspaceId },
        select: { slug: true },
      });
      revalidatePath(`/${workspace?.slug}`);
      return { isFavorite: true };
    }
  });
}
