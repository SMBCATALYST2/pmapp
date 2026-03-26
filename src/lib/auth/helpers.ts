/**
 * Auth helper utilities for server actions and queries.
 * Provides requireAuth, requireWorkspaceMember, requireRole wrappers.
 */

import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { errors, AppError } from "@/lib/errors";
import { ROLE_HIERARCHY } from "@/lib/constants";
import type { Role } from "@prisma/client";

export interface AuthSession {
  userId: string;
  email: string;
  name: string | null;
}

/**
 * Verifies the user is authenticated. Throws if not.
 * Called at the start of every server action (defense in depth).
 */
export async function requireAuth(): Promise<AuthSession> {
  const session = await auth();

  if (!session?.user?.id || !session.user.email) {
    throw errors.unauthorized();
  }

  return {
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name ?? null,
  };
}

/**
 * Verifies the user is a member of the given workspace and returns their role.
 * Throws FORBIDDEN if not a member.
 */
export async function requireWorkspaceMember(
  userId: string,
  workspaceId: string
): Promise<{ role: Role }> {
  const membership = await db.workspaceMember.findUnique({
    where: {
      userId_workspaceId: { userId, workspaceId },
    },
    select: { role: true },
  });

  if (!membership) {
    throw errors.forbidden("You are not a member of this workspace");
  }

  return { role: membership.role };
}

/**
 * Verifies the user has at least the specified role in the workspace.
 * Uses ROLE_HIERARCHY for comparison.
 * Throws FORBIDDEN if the user's role is insufficient.
 */
export async function requireRole(
  userId: string,
  workspaceId: string,
  minimumRole: Role
): Promise<{ role: Role }> {
  const { role } = await requireWorkspaceMember(userId, workspaceId);

  const userLevel = ROLE_HIERARCHY[role] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[minimumRole] ?? 0;

  if (userLevel < requiredLevel) {
    throw errors.forbidden(
      `This action requires ${minimumRole} role or higher`
    );
  }

  return { role };
}

/**
 * Verifies that a project belongs to the given workspace.
 * Returns the project if found. Throws NOT_FOUND otherwise.
 */
export async function requireProjectInWorkspace(
  projectId: string,
  workspaceId: string
) {
  const project = await db.project.findFirst({
    where: {
      id: projectId,
      workspaceId,
      deletedAt: null,
    },
  });

  if (!project) {
    throw errors.notFound("Project");
  }

  return project;
}

/**
 * Verifies that an issue belongs to a project in the given workspace.
 * Returns the issue if found. Throws NOT_FOUND otherwise.
 */
export async function requireIssueInWorkspace(
  issueId: string,
  workspaceId: string
) {
  const issue = await db.issue.findFirst({
    where: {
      id: issueId,
      deletedAt: null,
      project: {
        workspaceId,
        deletedAt: null,
      },
    },
    include: {
      project: { select: { id: true, workspaceId: true, prefix: true } },
    },
  });

  if (!issue) {
    throw errors.notFound("Issue");
  }

  return issue;
}

/**
 * Simple in-memory rate limiter for auth endpoints.
 * Tracks attempts per key (e.g., IP or email) with a sliding window.
 *
 * NOTE: For production, use a Redis-based solution like @upstash/ratelimit.
 * This in-memory implementation works for single-instance deployments only.
 */
const rateLimitStore = new Map<
  string,
  { count: number; resetAt: number }
>();

export function checkRateLimit(
  key: string,
  maxAttempts: number = 5,
  windowMs: number = 15 * 60 * 1000 // 15 minutes
): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  // Clean up expired entries periodically
  if (rateLimitStore.size > 10000) {
    for (const [k, v] of rateLimitStore) {
      if (v.resetAt < now) rateLimitStore.delete(k);
    }
  }

  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return true; // allowed
  }

  if (entry.count >= maxAttempts) {
    return false; // rate limited
  }

  entry.count++;
  return true; // allowed
}
