/**
 * Label Zod validation schemas.
 * Shared between client forms and server actions.
 */

import { z } from "zod";

export const createLabelSchema = z.object({
  workspaceId: z.string().cuid(),
  name: z
    .string()
    .min(1, "Name is required")
    .max(50, "Name too long")
    .trim(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color")
    .optional()
    .default("#6B7280"),
});
export type CreateLabelInput = z.infer<typeof createLabelSchema>;

export const updateLabelSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(1).max(50).trim().optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
});
export type UpdateLabelInput = z.infer<typeof updateLabelSchema>;

export const deleteLabelSchema = z.object({
  id: z.string().cuid(),
});
export type DeleteLabelInput = z.infer<typeof deleteLabelSchema>;
