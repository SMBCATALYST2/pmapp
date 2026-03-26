/**
 * Workspace Zod validation schemas.
 * Shared between client forms and server actions.
 *
 * CRITIQUE APPLIED: Slug validation includes reserved slug check,
 * must start with letter, no consecutive hyphens, no trailing hyphen.
 */

import { z } from "zod";
import { RESERVED_SLUGS } from "@/lib/constants";

const slugSchema = z
  .string()
  .min(3, "Slug must be at least 3 characters")
  .max(48, "Slug must be at most 48 characters")
  .regex(/^[a-z][a-z0-9-]*$/, "Must start with a letter and contain only lowercase letters, numbers, and hyphens")
  .refine((s) => !s.endsWith("-"), "Must not end with a hyphen")
  .refine((s) => !s.includes("--"), "Must not contain consecutive hyphens")
  .refine((s) => !RESERVED_SLUGS.has(s), "This URL is reserved");

export const createWorkspaceSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name too long")
    .trim(),
  slug: slugSchema,
  description: z.string().max(500, "Description too long").optional(),
});
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const updateWorkspaceSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(2).max(50).trim().optional(),
  description: z.string().max(500).optional(),
  image: z.string().url().nullable().optional(),
  // NOTE: Slug is immutable after creation per critique (prevents link breakage)
});
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
