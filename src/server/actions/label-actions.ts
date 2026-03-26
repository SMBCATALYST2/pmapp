"use server";

/**
 * Label server actions.
 * Handles label CRUD (workspace-scoped).
 * Labels are shared across all projects in a workspace.
 *
 * CRITIQUE APPLIED:
 * - All queries scoped to workspaceId
 * - Name uniqueness enforced within workspace
 */

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  createLabelSchema,
  updateLabelSchema,
  deleteLabelSchema,
} from "@/lib/validations/label";
import { requireAuth, requireRole } from "@/lib/auth/helpers";
import { errors, withErrorHandling } from "@/lib/errors";
import type { ActionResult } from "@/lib/errors";
import type { Label } from "@prisma/client";

/**
 * Create a new label in a workspace.
 * Validates name uniqueness within workspace.
 */
export async function createLabel(
  input: unknown
): Promise<ActionResult<{ label: Label }>> {
  return withErrorHandling(async () => {
    const session = await requireAuth();

    const parsed = createLabelSchema.safeParse(input);
    if (!parsed.success) {
      throw errors.validation(
        parsed.error.errors[0]?.message ?? "Invalid input"
      );
    }

    const { workspaceId, name, color } = parsed.data;

    // Require ADMIN+ role
    await requireRole(session.userId, workspaceId, "ADMIN");

    // Check name uniqueness within workspace
    const existing = await db.label.findFirst({
      where: {
        workspaceId,
        name: { equals: name, mode: "insensitive" },
      },
    });

    if (existing) {
      throw errors.conflict(
        "A label with this name already exists in the workspace"
      );
    }

    const label = await db.label.create({
      data: {
        name,
        color,
        workspaceId,
      },
    });

    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: { slug: true },
    });
    revalidatePath(`/${workspace?.slug}`);

    return { label };
  });
}

/**
 * Update a label's name or color.
 */
export async function updateLabel(
  input: unknown
): Promise<ActionResult<{ label: Label }>> {
  return withErrorHandling(async () => {
    const session = await requireAuth();

    const parsed = updateLabelSchema.safeParse(input);
    if (!parsed.success) {
      throw errors.validation(
        parsed.error.errors[0]?.message ?? "Invalid input"
      );
    }

    const { id, name, color } = parsed.data;

    // Get label with workspace scope
    const existing = await db.label.findFirst({
      where: { id },
      select: { workspaceId: true },
    });

    if (!existing) {
      throw errors.notFound("Label");
    }

    // Require ADMIN+ role
    await requireRole(session.userId, existing.workspaceId, "ADMIN");

    // Check name uniqueness if name is being changed
    if (name) {
      const duplicate = await db.label.findFirst({
        where: {
          workspaceId: existing.workspaceId,
          name: { equals: name, mode: "insensitive" },
          id: { not: id },
        },
      });

      if (duplicate) {
        throw errors.conflict(
          "A label with this name already exists in the workspace"
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (color !== undefined) updateData.color = color;

    const label = await db.label.update({
      where: { id },
      data: updateData,
    });

    const workspace = await db.workspace.findUnique({
      where: { id: existing.workspaceId },
      select: { slug: true },
    });
    revalidatePath(`/${workspace?.slug}`);

    return { label };
  });
}

/**
 * Delete a label. Removes from all associated issues.
 */
export async function deleteLabel(
  input: unknown
): Promise<ActionResult<void>> {
  return withErrorHandling(async () => {
    const session = await requireAuth();

    const parsed = deleteLabelSchema.safeParse(input);
    if (!parsed.success) {
      throw errors.validation(
        parsed.error.errors[0]?.message ?? "Invalid input"
      );
    }

    const { id } = parsed.data;

    // Get label with workspace scope
    const existing = await db.label.findFirst({
      where: { id },
      select: { workspaceId: true },
    });

    if (!existing) {
      throw errors.notFound("Label");
    }

    // Require ADMIN+ role
    await requireRole(session.userId, existing.workspaceId, "ADMIN");

    // Delete label (Prisma handles disconnecting from issues due to implicit M:M)
    await db.label.delete({ where: { id } });

    const workspace = await db.workspace.findUnique({
      where: { id: existing.workspaceId },
      select: { slug: true },
    });
    revalidatePath(`/${workspace?.slug}`);
  });
}
