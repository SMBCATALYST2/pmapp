"use server";

/**
 * Workspace server actions.
 * Handles workspace CRUD, member invitation, role changes, and member removal.
 *
 * CRITIQUE APPLIED:
 * - All queries scoped to workspaceId
 * - Invite tokens use crypto.randomUUID() with 7-day expiry
 * - Slug immutability after creation
 * - Role hierarchy enforcement
 */

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
} from "@/lib/validations/workspace";
import {
  inviteMemberSchema,
  changeMemberRoleSchema,
  removeMemberSchema,
} from "@/lib/validations/member";
import {
  requireAuth,
  requireRole,
  requireWorkspaceMember,
} from "@/lib/auth/helpers";
import { errors, withErrorHandling } from "@/lib/errors";
import type { ActionResult } from "@/lib/errors";
import { generateInviteToken } from "@/lib/utils";
import { ROLE_HIERARCHY } from "@/lib/constants";
import type { Workspace, WorkspaceMember } from "@prisma/client";

/**
 * Create a new workspace. Creator becomes OWNER member.
 */
export async function createWorkspace(
  input: unknown
): Promise<ActionResult<{ workspace: Workspace }>> {
  return withErrorHandling(async () => {
    const session = await requireAuth();

    const parsed = createWorkspaceSchema.safeParse(input);
    if (!parsed.success) {
      throw errors.validation(
        parsed.error.errors[0]?.message ?? "Invalid input"
      );
    }

    const { name, slug, description } = parsed.data;

    // Check slug uniqueness
    const existingWorkspace = await db.workspace.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (existingWorkspace) {
      throw errors.conflict("This URL is already taken. Try another.");
    }

    // Create workspace + owner membership in transaction
    const workspace = await db.$transaction(async (tx) => {
      const ws = await tx.workspace.create({
        data: {
          name,
          slug,
          description,
          ownerId: session.userId,
          members: {
            create: {
              userId: session.userId,
              role: "OWNER",
            },
          },
        },
      });
      return ws;
    });

    revalidatePath("/");
    return { workspace };
  });
}

/**
 * Update workspace name, description, or image.
 * Slug is immutable after creation (per critique).
 */
export async function updateWorkspace(
  input: unknown
): Promise<ActionResult<{ workspace: Workspace }>> {
  return withErrorHandling(async () => {
    const session = await requireAuth();

    const parsed = updateWorkspaceSchema.safeParse(input);
    if (!parsed.success) {
      throw errors.validation(
        parsed.error.errors[0]?.message ?? "Invalid input"
      );
    }

    const { id, ...updateData } = parsed.data;

    // Require ADMIN+ role
    await requireRole(session.userId, id, "ADMIN");

    const workspace = await db.workspace.update({
      where: { id },
      data: updateData,
    });

    revalidatePath(`/${workspace.slug}/settings`);
    return { workspace };
  });
}

/**
 * Invite a new member to the workspace via email.
 * Creates WorkspaceInvitation with unique token and 7-day expiry.
 */
export async function inviteMember(
  input: unknown
): Promise<ActionResult<{ invitationId: string; token: string }>> {
  return withErrorHandling(async () => {
    const session = await requireAuth();

    const parsed = inviteMemberSchema.safeParse(input);
    if (!parsed.success) {
      throw errors.validation(
        parsed.error.errors[0]?.message ?? "Invalid input"
      );
    }

    const { workspaceId, email, role } = parsed.data;

    // Require ADMIN+ role to invite
    await requireRole(session.userId, workspaceId, "ADMIN");

    // Check if already a member
    const existingUser = await db.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      const existingMember = await db.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId: existingUser.id,
            workspaceId,
          },
        },
      });

      if (existingMember) {
        throw errors.conflict(
          "This person is already a member of this workspace"
        );
      }
    }

    // Check for active pending invitation
    const pendingInvite = await db.workspaceInvitation.findFirst({
      where: {
        email,
        workspaceId,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
    });

    if (pendingInvite) {
      throw errors.conflict(
        "An invitation has already been sent to this email. Revoke it to send a new one."
      );
    }

    // Create invitation with crypto.randomUUID() token and 7-day expiry
    const token = generateInviteToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invitation = await db.workspaceInvitation.create({
      data: {
        email,
        workspaceId,
        role,
        invitedById: session.userId,
        token,
        expiresAt,
      },
    });

    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: { slug: true },
    });

    revalidatePath(`/${workspace?.slug}/settings/members`);

    return { invitationId: invitation.id, token };
  });
}

/**
 * Accept a workspace invitation using the token.
 * Creates WorkspaceMember with the invited role.
 */
export async function acceptInvite(
  token: string
): Promise<ActionResult<{ workspaceSlug: string }>> {
  return withErrorHandling(async () => {
    const session = await requireAuth();

    if (!token) {
      throw errors.badRequest("Invalid invitation token");
    }

    const invitation = await db.workspaceInvitation.findUnique({
      where: { token },
      include: {
        workspace: { select: { id: true, slug: true, name: true } },
      },
    });

    if (!invitation) {
      throw errors.notFound("Invitation");
    }

    if (invitation.status === "REVOKED") {
      throw errors.badRequest("This invitation has been revoked");
    }

    if (invitation.status === "ACCEPTED") {
      throw errors.badRequest("This invitation has already been used");
    }

    if (invitation.status === "EXPIRED" || invitation.expiresAt < new Date()) {
      // Mark as expired if not already
      if (invitation.status !== "EXPIRED") {
        await db.workspaceInvitation.update({
          where: { id: invitation.id },
          data: { status: "EXPIRED" },
        });
      }
      throw errors.badRequest(
        "This invitation has expired. Ask the workspace admin to send a new one."
      );
    }

    // Check if already a member
    const existingMember = await db.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: session.userId,
          workspaceId: invitation.workspaceId,
        },
      },
    });

    if (existingMember) {
      return { workspaceSlug: invitation.workspace.slug };
    }

    // Accept invitation in transaction
    await db.$transaction(async (tx) => {
      await tx.workspaceInvitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED" },
      });

      await tx.workspaceMember.create({
        data: {
          userId: session.userId,
          workspaceId: invitation.workspaceId,
          role: invitation.role,
        },
      });
    });

    revalidatePath(`/${invitation.workspace.slug}`);
    return { workspaceSlug: invitation.workspace.slug };
  });
}

/**
 * Change a member's role within a workspace.
 * Cannot change the OWNER role. Cannot change own role.
 */
export async function changeMemberRole(
  input: unknown
): Promise<ActionResult<{ member: WorkspaceMember }>> {
  return withErrorHandling(async () => {
    const session = await requireAuth();

    const parsed = changeMemberRoleSchema.safeParse(input);
    if (!parsed.success) {
      throw errors.validation(
        parsed.error.errors[0]?.message ?? "Invalid input"
      );
    }

    const { workspaceId, userId, role: newRole } = parsed.data;

    // Cannot change own role
    if (userId === session.userId) {
      throw errors.badRequest("Cannot change your own role");
    }

    // Require ADMIN+ to change roles
    const { role: callerRole } = await requireRole(
      session.userId,
      workspaceId,
      "ADMIN"
    );

    // Get target member's current role
    const targetMember = await db.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
    });

    if (!targetMember) {
      throw errors.notFound("Member");
    }

    // Cannot change an OWNER's role
    if (targetMember.role === "OWNER") {
      throw errors.forbidden("Cannot change the workspace owner's role");
    }

    // Admin can only manage MEMBER and VIEWER, not other ADMINs
    if (
      callerRole === "ADMIN" &&
      (targetMember.role === "ADMIN" || newRole === "ADMIN")
    ) {
      throw errors.forbidden(
        "Only the workspace owner can manage admin roles"
      );
    }

    const member = await db.workspaceMember.update({
      where: { userId_workspaceId: { userId, workspaceId } },
      data: { role: newRole },
    });

    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: { slug: true },
    });
    revalidatePath(`/${workspace?.slug}/settings/members`);

    return { member };
  });
}

/**
 * Remove a member from the workspace.
 * Unassigns all their issues in the workspace.
 * Cannot remove the workspace owner.
 */
export async function removeMember(
  input: unknown
): Promise<ActionResult<void>> {
  return withErrorHandling(async () => {
    const session = await requireAuth();

    const parsed = removeMemberSchema.safeParse(input);
    if (!parsed.success) {
      throw errors.validation(
        parsed.error.errors[0]?.message ?? "Invalid input"
      );
    }

    const { workspaceId, userId } = parsed.data;

    // Require ADMIN+ to remove members (or self-removal)
    if (userId !== session.userId) {
      const { role: callerRole } = await requireRole(
        session.userId,
        workspaceId,
        "ADMIN"
      );

      // Get target member role
      const targetMember = await db.workspaceMember.findUnique({
        where: { userId_workspaceId: { userId, workspaceId } },
      });

      if (!targetMember) {
        throw errors.notFound("Member");
      }

      // Cannot remove OWNER
      if (targetMember.role === "OWNER") {
        throw errors.forbidden("Cannot remove the workspace owner");
      }

      // Admin cannot remove another admin
      if (callerRole === "ADMIN" && targetMember.role === "ADMIN") {
        throw errors.forbidden("Only the workspace owner can remove admins");
      }
    } else {
      // Self-removal: check not the sole owner
      const { role } = await requireWorkspaceMember(userId, workspaceId);
      if (role === "OWNER") {
        throw errors.forbidden("Cannot remove yourself as the sole owner");
      }
    }

    // Remove member and unassign their issues in a transaction
    await db.$transaction(async (tx) => {
      // Unassign all issues in this workspace assigned to this user
      await tx.issue.updateMany({
        where: {
          assigneeId: userId,
          project: { workspaceId },
          deletedAt: null,
        },
        data: { assigneeId: null },
      });

      // Delete the membership
      await tx.workspaceMember.delete({
        where: { userId_workspaceId: { userId, workspaceId } },
      });
    });

    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: { slug: true },
    });
    revalidatePath(`/${workspace?.slug}/settings/members`);
  });
}
