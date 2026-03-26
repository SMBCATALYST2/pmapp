/**
 * Workspace server queries.
 * Data fetching functions for Server Components.
 *
 * CRITIQUE APPLIED:
 * - All queries scoped to workspaceId / userId membership
 */

import { cache } from "react";
import { db } from "@/lib/db";
import { requireAuth, requireWorkspaceMember } from "@/lib/auth/helpers";
import type {
  WorkspaceWithMemberCount,
  MemberWithUser,
  InvitationWithWorkspace,
} from "@/types";

/**
 * Get all workspaces the current user is a member of.
 * Used for the workspace switcher.
 */
export async function getUserWorkspaces(): Promise<WorkspaceWithMemberCount[]> {
  const session = await requireAuth();

  const memberships = await db.workspaceMember.findMany({
    where: { userId: session.userId },
    include: {
      workspace: {
        include: {
          _count: { select: { members: true } },
        },
      },
    },
    orderBy: { workspace: { name: "asc" } },
  });

  return memberships.map((m) => ({
    ...m.workspace,
    _count: m.workspace._count,
  }));
}

/**
 * Get a single workspace by slug with member count.
 * Verifies the current user is a member.
 */
export const getWorkspace = cache(async function getWorkspace(
  slug: string
): Promise<
  | (WorkspaceWithMemberCount & { currentUserRole: string })
  | null
> {
  const session = await requireAuth();

  const workspace = await db.workspace.findUnique({
    where: { slug },
    include: {
      _count: { select: { members: true } },
    },
  });

  if (!workspace) return null;

  const membership = await db.workspaceMember.findUnique({
    where: {
      userId_workspaceId: {
        userId: session.userId,
        workspaceId: workspace.id,
      },
    },
  });

  if (!membership) return null;

  return {
    ...workspace,
    currentUserRole: membership.role,
  };
});

/**
 * Get all members of a workspace with user details.
 */
export async function getWorkspaceMembers(
  workspaceId: string
): Promise<MemberWithUser[]> {
  const session = await requireAuth();
  await requireWorkspaceMember(session.userId, workspaceId);

  return db.workspaceMember.findMany({
    where: { workspaceId },
    include: {
      user: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
    orderBy: [
      { role: "asc" }, // OWNER first
      { joinedAt: "asc" },
    ],
  });
}

/**
 * Get pending invitations for a workspace.
 */
export async function getWorkspaceInvitations(
  workspaceId: string
): Promise<InvitationWithWorkspace[]> {
  const session = await requireAuth();
  await requireWorkspaceMember(session.userId, workspaceId);

  return db.workspaceInvitation.findMany({
    where: {
      workspaceId,
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    include: {
      workspace: {
        select: { id: true, name: true, slug: true, image: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Check if a workspace slug is available (for real-time validation).
 */
export async function checkSlugAvailability(
  slug: string
): Promise<boolean> {
  await requireAuth();
  const existing = await db.workspace.findUnique({
    where: { slug },
    select: { id: true },
  });

  return !existing;
}
