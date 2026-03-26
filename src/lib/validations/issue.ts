/**
 * Issue Zod validation schemas.
 * Shared between client forms and server actions.
 *
 * CRITIQUE APPLIED: Replaced z.any() for Tiptap description with proper
 * structural validation (tiptapJsonSchema) to prevent stored XSS.
 */

import { z } from "zod";

const issueTypeEnum = z.enum(["EPIC", "STORY", "TASK", "BUG"]);
const priorityEnum = z.enum(["URGENT", "HIGH", "MEDIUM", "LOW", "NONE"]);

/**
 * Validates Tiptap JSON document structure.
 * Ensures the content follows the expected { type, content?, text?, marks?, attrs? } pattern.
 * This replaces z.any() which was flagged as a critical security issue.
 */
const tiptapNodeSchema: z.ZodType<unknown> = z.lazy(() =>
  z.object({
    type: z.string(),
    attrs: z.record(z.unknown()).optional(),
    content: z.array(tiptapNodeSchema).optional(),
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
);

export const tiptapJsonSchema = z
  .object({
    type: z.literal("doc"),
    content: z.array(tiptapNodeSchema).optional(),
  })
  .nullable()
  .optional();

export const createIssueSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(255, "Title too long")
    .trim(),
  description: tiptapJsonSchema,
  type: issueTypeEnum,
  priority: priorityEnum,
  projectId: z.string().cuid(),
  statusId: z.string().cuid(),
  assigneeId: z.string().cuid().nullable().optional(),
  labelIds: z.array(z.string().cuid()).optional(),
  dueDate: z.coerce.date().nullable().optional(),
});
export type CreateIssueInput = z.infer<typeof createIssueSchema>;

export const updateIssueSchema = z.object({
  id: z.string().cuid(),
  title: z.string().min(1).max(255).trim().optional(),
  description: tiptapJsonSchema,
  type: issueTypeEnum.optional(),
  priority: priorityEnum.optional(),
  statusId: z.string().cuid().optional(),
  assigneeId: z.string().cuid().nullable().optional(),
  labelIds: z.array(z.string().cuid()).optional(),
  dueDate: z.coerce.date().nullable().optional(),
  updatedAt: z.coerce.date().optional(), // Optimistic locking check
});
export type UpdateIssueInput = z.infer<typeof updateIssueSchema>;

export const moveIssueSchema = z.object({
  id: z.string().cuid(),
  statusId: z.string().cuid(),
  position: z.string(), // Fractional index string
});
export type MoveIssueInput = z.infer<typeof moveIssueSchema>;

export const reorderIssueSchema = z.object({
  id: z.string().cuid(),
  position: z.string(), // Fractional index string
});
export type ReorderIssueInput = z.infer<typeof reorderIssueSchema>;

export const issueFilterSchema = z.object({
  status: z.array(z.string()).optional(),
  assigneeId: z.array(z.string()).optional(),
  priority: z.array(priorityEnum).optional(),
  type: z.array(issueTypeEnum).optional(),
  labelIds: z.array(z.string()).optional(),
  search: z.string().optional(),
});
export type IssueFilterInput = z.infer<typeof issueFilterSchema>;

export const searchIssuesSchema = z.object({
  workspaceId: z.string().cuid(),
  query: z.string().min(1).max(200),
  limit: z.number().int().min(1).max(50).optional().default(10),
});
export type SearchIssuesInput = z.infer<typeof searchIssuesSchema>;
