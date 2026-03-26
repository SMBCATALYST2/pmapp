// src/lib/db/workspace-scope.ts
// Helper for workspace-scoped queries (addresses critique: workspace isolation)
//
// Every database query that touches workspace data MUST be scoped to the
// current user's workspace. This helper provides type-safe wrappers to
// enforce that constraint.

import { prisma } from './index';
import type { Prisma } from '../../../generated/prisma';

/**
 * Creates a workspace-scoped query helper.
 * All queries through this helper automatically include workspaceId filtering.
 *
 * Usage:
 * ```ts
 * const ws = withWorkspace(workspaceId);
 * const projects = await ws.project.findMany();
 * const labels = await ws.label.findMany();
 * ```
 */
export function withWorkspace(workspaceId: string) {
  return {
    /**
     * Workspace-scoped Project queries
     */
    project: {
      findMany: (args?: Omit<Prisma.ProjectFindManyArgs, 'where'> & { where?: Prisma.ProjectWhereInput }) => {
        return prisma.project.findMany({
          ...args,
          where: {
            ...args?.where,
            workspaceId,
          },
        });
      },

      findFirst: (args?: Omit<Prisma.ProjectFindFirstArgs, 'where'> & { where?: Prisma.ProjectWhereInput }) => {
        return prisma.project.findFirst({
          ...args,
          where: {
            ...args?.where,
            workspaceId,
          },
        });
      },

      findByPrefix: (prefix: string) => {
        return prisma.project.findFirst({
          where: {
            workspaceId,
            prefix,
            deletedAt: null,
          },
        });
      },

      create: (data: Omit<Prisma.ProjectCreateInput, 'workspace'> & Record<string, unknown>) => {
        return prisma.project.create({
          data: {
            ...data,
            workspace: { connect: { id: workspaceId } },
          } as Prisma.ProjectCreateInput,
        });
      },

      count: (args?: { where?: Prisma.ProjectWhereInput }) => {
        return prisma.project.count({
          where: {
            ...args?.where,
            workspaceId,
          },
        });
      },
    },

    /**
     * Workspace-scoped Label queries
     */
    label: {
      findMany: (args?: Omit<Prisma.LabelFindManyArgs, 'where'> & { where?: Prisma.LabelWhereInput }) => {
        return prisma.label.findMany({
          ...args,
          where: {
            ...args?.where,
            workspaceId,
          },
        });
      },

      create: (data: { name: string; color?: string }) => {
        return prisma.label.create({
          data: {
            ...data,
            workspace: { connect: { id: workspaceId } },
          },
        });
      },

      createMany: (labels: Array<{ name: string; color: string }>) => {
        return prisma.label.createMany({
          data: labels.map((label) => ({
            ...label,
            workspaceId,
          })),
          skipDuplicates: true,
        });
      },
    },

    /**
     * Workspace-scoped Member queries
     */
    member: {
      findMany: (args?: Omit<Prisma.WorkspaceMemberFindManyArgs, 'where'> & { where?: Prisma.WorkspaceMemberWhereInput }) => {
        return prisma.workspaceMember.findMany({
          ...args,
          where: {
            ...args?.where,
            workspaceId,
          },
        });
      },

      findByUserId: (userId: string) => {
        return prisma.workspaceMember.findUnique({
          where: {
            userId_workspaceId: {
              userId,
              workspaceId,
            },
          },
        });
      },

      isMember: async (userId: string): Promise<boolean> => {
        const member = await prisma.workspaceMember.findUnique({
          where: {
            userId_workspaceId: {
              userId,
              workspaceId,
            },
          },
          select: { userId: true },
        });
        return member !== null;
      },

      hasRole: async (userId: string, roles: Array<'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'>): Promise<boolean> => {
        const member = await prisma.workspaceMember.findUnique({
          where: {
            userId_workspaceId: {
              userId,
              workspaceId,
            },
          },
          select: { role: true },
        });
        return member !== null && roles.includes(member.role);
      },
    },

    /**
     * Workspace-scoped Invitation queries
     */
    invitation: {
      findMany: (args?: Omit<Prisma.WorkspaceInvitationFindManyArgs, 'where'> & { where?: Prisma.WorkspaceInvitationWhereInput }) => {
        return prisma.workspaceInvitation.findMany({
          ...args,
          where: {
            ...args?.where,
            workspaceId,
          },
        });
      },

      findPending: () => {
        return prisma.workspaceInvitation.findMany({
          where: {
            workspaceId,
            status: 'PENDING',
            expiresAt: { gt: new Date() },
          },
          orderBy: { createdAt: 'desc' },
        });
      },
    },

    /**
     * Access the raw workspaceId for custom queries
     */
    workspaceId,
  };
}

/**
 * Validates that a user is a member of the given workspace.
 * Throws an error if the user is not a member.
 *
 * Usage in server actions:
 * ```ts
 * await requireWorkspaceMember(userId, workspaceId);
 * // ... proceed with workspace-scoped operations
 * ```
 */
export async function requireWorkspaceMember(
  userId: string,
  workspaceId: string
): Promise<{ role: string }> {
  const member = await prisma.workspaceMember.findUnique({
    where: {
      userId_workspaceId: {
        userId,
        workspaceId,
      },
    },
    select: { role: true },
  });

  if (!member) {
    throw new Error('Access denied: not a workspace member');
  }

  return member;
}

/**
 * Validates that a user has one of the specified roles in the workspace.
 * Throws an error if the user doesn't have the required role.
 */
export async function requireWorkspaceRole(
  userId: string,
  workspaceId: string,
  roles: Array<'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'>
): Promise<{ role: string }> {
  const member = await requireWorkspaceMember(userId, workspaceId);

  if (!roles.includes(member.role as 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER')) {
    throw new Error(`Access denied: requires one of [${roles.join(', ')}] role`);
  }

  return member;
}
