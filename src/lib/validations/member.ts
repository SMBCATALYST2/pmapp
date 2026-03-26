/**
 * Member/Invitation Zod validation schemas.
 * Shared between client forms and server actions.
 */

import { z } from "zod";

export const inviteMemberSchema = z.object({
  workspaceId: z.string().cuid(),
  email: z
    .string()
    .email("Invalid email address")
    .transform((e) => e.toLowerCase().trim()),
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]), // Cannot invite as OWNER
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const changeMemberRoleSchema = z.object({
  workspaceId: z.string().cuid(),
  userId: z.string().cuid(),
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]), // Cannot change to OWNER
});
export type ChangeMemberRoleInput = z.infer<typeof changeMemberRoleSchema>;

export const removeMemberSchema = z.object({
  workspaceId: z.string().cuid(),
  userId: z.string().cuid(),
});
export type RemoveMemberInput = z.infer<typeof removeMemberSchema>;
