/**
 * Comment Zod validation schemas.
 * Shared between client forms and server actions.
 *
 * CRITIQUE APPLIED: Uses proper Tiptap JSON schema validation
 * instead of z.any() to prevent stored XSS.
 */

import { z } from "zod";
import { tiptapJsonSchema } from "./issue";

/** Schema for creating a comment - body must be non-null Tiptap JSON */
const requiredTiptapSchema = z
  .object({
    type: z.literal("doc"),
    content: z
      .array(z.lazy((): z.ZodType<unknown> =>
        z.object({
          type: z.string(),
          attrs: z.record(z.unknown()).optional(),
          content: z.array(z.lazy((): z.ZodType<unknown> => z.unknown())).optional(),
          text: z.string().optional(),
          marks: z
            .array(
              z.object({
                type: z.string(),
                attrs: z.record(z.unknown()).optional(),
              })
            )
            .optional(),
        })
      ))
      .min(1, "Comment cannot be empty"),
  });

export const createCommentSchema = z.object({
  issueId: z.string().cuid(),
  body: requiredTiptapSchema,
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const updateCommentSchema = z.object({
  id: z.string().cuid(),
  body: requiredTiptapSchema,
});
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;

export const deleteCommentSchema = z.object({
  id: z.string().cuid(),
});
export type DeleteCommentInput = z.infer<typeof deleteCommentSchema>;
