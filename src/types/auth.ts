/**
 * Authentication-related type definitions.
 * Extends NextAuth.js session types.
 */

import type { User, WorkspaceMember, Workspace } from "@prisma/client";

/** The user object available in the session (subset of User) */
export interface SessionUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

/** Extended session type for NextAuth.js */
export interface Session {
  user: SessionUser;
  expires: string;
}

/** JWT payload embedded in the token */
export interface JWTPayload {
  sub: string; // userId
  email: string;
  name: string | null;
  picture: string | null;
}

/** User with their workspace memberships */
export type UserWithWorkspaces = User & {
  workspaces: (WorkspaceMember & {
    workspace: Workspace;
  })[];
};
