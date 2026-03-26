/**
 * Project Zod validation schemas.
 * Shared between client forms and server actions.
 */

import { z } from "zod";

export const createProjectSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name too long")
    .trim(),
  prefix: z
    .string()
    .min(2, "Key must be 2-10 characters")
    .max(10, "Key must be 2-10 characters")
    .regex(/^[A-Z]+$/, "Key must be uppercase letters only"),
  description: z.string().max(1000, "Description too long").optional(),
  icon: z.string().max(4).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color")
    .optional(),
  workspaceId: z.string().cuid(),
  leadId: z.string().cuid().nullable().optional(),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(1000).optional(),
  icon: z.string().max(4).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  leadId: z.string().cuid().nullable().optional(),
  // NOTE: prefix is NOT editable after creation (immutable, embedded in issue keys)
});
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
