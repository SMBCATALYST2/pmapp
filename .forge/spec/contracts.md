# Contracts & Type Definitions: PMApp (JIRA-like Project Management)

**Date:** 2026-03-26
**Author:** ContractWriter (Forge Pipeline)
**Stack:** Next.js 15 + TypeScript + PostgreSQL + Prisma + Tailwind CSS v4 + shadcn/ui + NextAuth.js

---

## Table of Contents

1. [Prisma Schema](#1-prisma-schema)
2. [Zod Validation Schemas](#2-zod-validation-schemas)
3. [Server Action Signatures](#3-server-action-signatures)
4. [TypeScript Type Definitions](#4-typescript-type-definitions)
5. [Component Interfaces](#5-component-interfaces)
6. [URL Routing Contract](#6-url-routing-contract)

---

## 1. Prisma Schema

> File: `prisma/schema.prisma`

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// =====================================================================
// ENUMS
// =====================================================================

enum Role {
  OWNER
  ADMIN
  MEMBER
  VIEWER
}

enum InvitationStatus {
  PENDING
  ACCEPTED
  EXPIRED
  REVOKED
}

enum StatusCategory {
  BACKLOG
  TODO
  IN_PROGRESS
  DONE
  CANCELLED
}

enum IssueType {
  EPIC
  STORY
  TASK
  BUG
}

enum Priority {
  URGENT  // P0
  HIGH    // P1
  MEDIUM  // P2
  LOW     // P3
  NONE    // P4
}

enum LinkType {
  BLOCKS
  IS_BLOCKED_BY
  RELATES_TO
  DUPLICATES
  IS_DUPLICATED_BY
}

enum SprintStatus {
  PLANNED
  ACTIVE
  COMPLETED
}

// =====================================================================
// AUTHENTICATION (NextAuth.js / Auth.js v5)
// =====================================================================

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?
  password      String?   // Hashed via bcryptjs (null for OAuth-only users)

  // NextAuth relations
  accounts Account[]
  sessions Session[]

  // PM app relations
  workspaces       WorkspaceMember[]
  ownedWorkspaces  Workspace[]          @relation("WorkspaceOwner")
  assignedIssues   Issue[]              @relation("Assignee")
  reportedIssues   Issue[]              @relation("Reporter")
  comments         Comment[]
  activities       Activity[]           @relation("ActivityActor")
  starredProjects  ProjectFavorite[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

// =====================================================================
// WORKSPACE (Multi-tenant boundary)
// =====================================================================

model Workspace {
  id          String  @id @default(cuid())
  name        String
  slug        String  @unique  // URL-safe: /[slug]/projects
  description String?
  image       String?
  ownerId     String
  owner       User    @relation("WorkspaceOwner", fields: [ownerId], references: [id])

  members     WorkspaceMember[]
  projects    Project[]
  invitations WorkspaceInvitation[]
  labels      Label[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([ownerId])
}

model WorkspaceMember {
  userId      String
  workspaceId String
  role        Role     @default(MEMBER)

  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  joinedAt DateTime @default(now())

  @@id([userId, workspaceId])
  @@index([workspaceId])
}

model WorkspaceInvitation {
  id          String           @id @default(cuid())
  email       String
  workspaceId String
  workspace   Workspace        @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  role        Role             @default(MEMBER)
  invitedById String
  token       String           @unique @default(cuid())
  status      InvitationStatus @default(PENDING)
  expiresAt   DateTime

  createdAt DateTime @default(now())

  @@index([email, workspaceId])
  @@index([token])
}

// =====================================================================
// PROJECT
// =====================================================================

model Project {
  id           String  @id @default(cuid())
  name         String
  prefix       String  // Issue key prefix, e.g., "PROJ" -> "PROJ-1", "PROJ-2"
  description  String?
  icon         String? // Emoji icon, e.g., "🚀"
  color        String? // Hex color, e.g., "#3B82F6"
  workspaceId  String
  workspace    Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  leadId       String?   // Project lead (workspace member)
  issueCounter Int       @default(0) // Atomic counter for issue key generation

  issues    Issue[]
  sprints   Sprint[]
  statuses  WorkflowStatus[]
  favorites ProjectFavorite[]

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime? // Soft delete

  @@unique([workspaceId, prefix])
  @@index([workspaceId])
}

model ProjectFavorite {
  userId    String
  projectId String
  user      User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@id([userId, projectId])
}

// =====================================================================
// WORKFLOW STATUS (Customizable per project)
// =====================================================================

model WorkflowStatus {
  id        String         @id @default(cuid())
  name      String         // Display name: "In Review", "QA", etc.
  category  StatusCategory // Logical grouping for board behavior
  color     String         @default("#6B7280") // Hex color
  position  Int            // Sort order for board columns (0-based)
  projectId String
  project   Project        @relation(fields: [projectId], references: [id], onDelete: Cascade)

  issues Issue[]

  @@unique([projectId, name])
  @@index([projectId, position])
}

// =====================================================================
// ISSUE
// =====================================================================

model Issue {
  id              String    @id @default(cuid())
  key             String    @unique   // Human-readable: "PROJ-123"
  number          Int                 // Auto-increment per project (e.g., 123)
  title           String    @db.VarChar(255)
  description     Json?     // Tiptap JSON content
  descriptionText String?   // Plain text extraction for search
  type            IssueType @default(TASK)
  priority        Priority  @default(MEDIUM)
  position        String    // Fractional index for ordering within column
  dueDate         DateTime?
  storyPoints     Int?      // Phase 2: Fibonacci (1,2,3,5,8,13,21)

  // Workflow
  statusId String
  status   WorkflowStatus @relation(fields: [statusId], references: [id])

  // Ownership
  projectId  String
  project    Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  assigneeId String?
  assignee   User?   @relation("Assignee", fields: [assigneeId], references: [id], onDelete: SetNull)
  reporterId String
  reporter   User    @relation("Reporter", fields: [reporterId], references: [id])

  // Sprint (Phase 2 -- schema ready now)
  sprintId String?
  sprint   Sprint? @relation(fields: [sprintId], references: [id], onDelete: SetNull)

  // Hierarchy (Phase 2 -- schema ready now)
  parentId String?
  parent   Issue?  @relation("IssueHierarchy", fields: [parentId], references: [id], onDelete: SetNull)
  children Issue[] @relation("IssueHierarchy")

  // Many-to-many
  labels     Label[]
  comments   Comment[]
  activities Activity[]

  // Issue links (Phase 2)
  linksFrom IssueLink[] @relation("LinkFrom")
  linksTo   IssueLink[] @relation("LinkTo")

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime? // Soft delete

  @@index([projectId, statusId, position])
  @@index([projectId, assigneeId])
  @@index([projectId, sprintId])
  @@index([assigneeId])
  @@index([parentId])
}

// =====================================================================
// ISSUE LINKS (Phase 2 -- schema now for forward compatibility)
// =====================================================================

model IssueLink {
  id     String   @id @default(cuid())
  type   LinkType
  fromId String
  from   Issue    @relation("LinkFrom", fields: [fromId], references: [id], onDelete: Cascade)
  toId   String
  to     Issue    @relation("LinkTo", fields: [toId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@unique([fromId, toId, type])
}

// =====================================================================
// LABELS (Workspace-scoped, shared across projects)
// =====================================================================

model Label {
  id          String    @id @default(cuid())
  name        String
  color       String    @default("#6B7280")
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  issues      Issue[]

  @@unique([workspaceId, name])
}

// =====================================================================
// SPRINT (Phase 2 -- schema now for forward compatibility)
// =====================================================================

model Sprint {
  id          String       @id @default(cuid())
  name        String       // "Sprint 14"
  goal        String?      // Sprint goal description
  projectId   String
  project     Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
  status      SprintStatus @default(PLANNED)
  startDate   DateTime?
  endDate     DateTime?
  completedAt DateTime?

  issues Issue[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([projectId, status])
}

// =====================================================================
// COMMENTS
// =====================================================================

model Comment {
  id       String @id @default(cuid())
  body     Json   // Tiptap JSON content
  bodyText String // Plain text extraction for search
  issueId  String
  issue    Issue  @relation(fields: [issueId], references: [id], onDelete: Cascade)
  authorId String
  author   User   @relation(fields: [authorId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([issueId, createdAt])
}

// =====================================================================
// ACTIVITY LOG (Append-only audit trail)
// =====================================================================

model Activity {
  id        String  @id @default(cuid())
  type      String  // "ISSUE_CREATED", "STATUS_CHANGED", "ASSIGNED", etc.
  issueId   String?
  issue     Issue?  @relation(fields: [issueId], references: [id], onDelete: SetNull)
  projectId String
  actorId   String
  actor     User    @relation("ActivityActor", fields: [actorId], references: [id])
  metadata  Json    // { field: "status", from: "TODO", to: "IN_PROGRESS" }

  createdAt DateTime @default(now())

  @@index([issueId, createdAt])
  @@index([projectId, createdAt])
  @@index([actorId])
}
```

### Default Workflow Statuses (Seed Data)

When a new project is created, seed these statuses:

| Position | Name | Category | Color |
|----------|------|----------|-------|
| 0 | Backlog | BACKLOG | #6B7280 |
| 1 | Todo | TODO | #3B82F6 |
| 2 | In Progress | IN_PROGRESS | #F59E0B |
| 3 | In Review | IN_PROGRESS | #8B5CF6 |
| 4 | Done | DONE | #10B981 |
| 5 | Cancelled | CANCELLED | #EF4444 |

### Key Schema Design Decisions

| Decision | Rationale |
|----------|-----------|
| `cuid()` for all IDs | URL-safe, collision-resistant, sortable by creation time |
| `Issue.number` + `Issue.key` | `number` is auto-increment per project (stored on `Project.issueCounter`), `key` is the composed string "PREFIX-NUMBER" |
| Fractional indexing (`position` String) | Avoids reindexing entire column on card move; uses `fractional-indexing` npm package |
| `WorkflowStatus` per project | Each project can customize its Kanban columns; `StatusCategory` enum groups them logically |
| `descriptionText` + `bodyText` mirror fields | Plain text for PostgreSQL search without parsing JSON/rich text at query time |
| `deletedAt` for soft deletes on Issue/Project | Allows undo/grace period; excluded from queries via Prisma middleware |
| Labels at workspace scope | Labels shared across all projects (consistent categorization) |
| Sprint + IssueLink in schema now | Forward-compatible for Phase 2; foreign keys are nullable, no overhead |
| Implicit many-to-many for Issue-Label | Prisma handles the junction table automatically |

---

## 2. Zod Validation Schemas

All schemas live in `src/lib/validations/` and are shared between client forms (react-hook-form) and server actions.

### Auth Schemas (`src/lib/validations/auth.ts`)

```typescript
// src/lib/validations/auth.ts
import { z } from 'zod';

export const signUpSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(50, 'Name too long'),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password too long'),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
```

### Workspace Schemas (`src/lib/validations/workspace.ts`)

```typescript
// src/lib/validations/workspace.ts
import { z } from 'zod';

export const createWorkspaceSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(50, 'Name too long'),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(30, 'Slug too long')
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens only'),
  description: z.string().max(500, 'Description too long').optional(),
});
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const updateWorkspaceSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(2).max(50).optional(),
  slug: z
    .string()
    .min(2)
    .max(30)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens only')
    .optional(),
  description: z.string().max(500).optional(),
  image: z.string().url().nullable().optional(),
});
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
```

### Project Schemas (`src/lib/validations/project.ts`)

```typescript
// src/lib/validations/project.ts
import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  prefix: z
    .string()
    .min(2, 'Key must be 2-10 characters')
    .max(10, 'Key must be 2-10 characters')
    .regex(/^[A-Z]+$/, 'Key must be uppercase letters only'),
  description: z.string().max(1000, 'Description too long').optional(),
  icon: z.string().max(4).optional(), // Emoji
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color')
    .optional(),
  workspaceId: z.string().cuid(),
  leadId: z.string().cuid().nullable().optional(),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
  icon: z.string().max(4).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  leadId: z.string().cuid().nullable().optional(),
});
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
```

### Issue Schemas (`src/lib/validations/issue.ts`)

```typescript
// src/lib/validations/issue.ts
import { z } from 'zod';

const issueTypeEnum = z.enum(['EPIC', 'STORY', 'TASK', 'BUG']);
const priorityEnum = z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE']);

export const createIssueSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title too long'),
  description: z.any().optional(), // Tiptap JSON content
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
  title: z.string().min(1).max(255).optional(),
  description: z.any().optional(), // Tiptap JSON content
  type: issueTypeEnum.optional(),
  priority: priorityEnum.optional(),
  statusId: z.string().cuid().optional(),
  assigneeId: z.string().cuid().nullable().optional(),
  labelIds: z.array(z.string().cuid()).optional(),
  dueDate: z.coerce.date().nullable().optional(),
  updatedAt: z.coerce.date(), // Optimistic locking check
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

export const bulkUpdateIssuesSchema = z.object({
  issueIds: z.array(z.string().cuid()).min(1, 'Select at least one issue'),
  statusId: z.string().cuid().optional(),
  assigneeId: z.string().cuid().nullable().optional(),
  priority: priorityEnum.optional(),
  labelIds: z.array(z.string().cuid()).optional(),
});
export type BulkUpdateIssuesInput = z.infer<typeof bulkUpdateIssuesSchema>;

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
```

### Comment Schemas (`src/lib/validations/comment.ts`)

```typescript
// src/lib/validations/comment.ts
import { z } from 'zod';

export const createCommentSchema = z.object({
  issueId: z.string().cuid(),
  body: z.any(), // Tiptap JSON content (validated as non-empty on client)
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const updateCommentSchema = z.object({
  id: z.string().cuid(),
  body: z.any(), // Tiptap JSON content
});
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;

export const deleteCommentSchema = z.object({
  id: z.string().cuid(),
});
export type DeleteCommentInput = z.infer<typeof deleteCommentSchema>;
```

### Member Schemas (`src/lib/validations/member.ts`)

```typescript
// src/lib/validations/member.ts
import { z } from 'zod';

export const inviteMemberSchema = z.object({
  workspaceId: z.string().cuid(),
  email: z.string().email('Invalid email address'),
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']), // Cannot invite as OWNER
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const changeMemberRoleSchema = z.object({
  workspaceId: z.string().cuid(),
  userId: z.string().cuid(),
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']), // Cannot change to OWNER
});
export type ChangeMemberRoleInput = z.infer<typeof changeMemberRoleSchema>;

export const removeMemberSchema = z.object({
  workspaceId: z.string().cuid(),
  userId: z.string().cuid(),
});
export type RemoveMemberInput = z.infer<typeof removeMemberSchema>;
```

### Label Schemas (`src/lib/validations/label.ts`)

```typescript
// src/lib/validations/label.ts
import { z } from 'zod';

export const createLabelSchema = z.object({
  workspaceId: z.string().cuid(),
  name: z.string().min(1, 'Name is required').max(50, 'Name too long'),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color')
    .optional()
    .default('#6B7280'),
});
export type CreateLabelInput = z.infer<typeof createLabelSchema>;

export const updateLabelSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(1).max(50).optional(),
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
```

### Status Schemas (`src/lib/validations/status.ts`)

```typescript
// src/lib/validations/status.ts
import { z } from 'zod';

const statusCategoryEnum = z.enum([
  'BACKLOG',
  'TODO',
  'IN_PROGRESS',
  'DONE',
  'CANCELLED',
]);

export const createStatusSchema = z.object({
  projectId: z.string().cuid(),
  name: z.string().min(1, 'Name is required').max(50, 'Name too long'),
  category: statusCategoryEnum,
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color')
    .optional()
    .default('#6B7280'),
});
export type CreateStatusInput = z.infer<typeof createStatusSchema>;

export const updateStatusSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(1).max(50).optional(),
  category: statusCategoryEnum.optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
});
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;

export const reorderStatusesSchema = z.object({
  projectId: z.string().cuid(),
  statusIds: z.array(z.string().cuid()).min(1, 'At least one status required'),
});
export type ReorderStatusesInput = z.infer<typeof reorderStatusesSchema>;

export const deleteStatusSchema = z.object({
  id: z.string().cuid(),
  migrateToStatusId: z.string().cuid(), // Move existing issues to this status
});
export type DeleteStatusInput = z.infer<typeof deleteStatusSchema>;
```

---

## 3. Server Action Signatures

All server actions live in `src/server/actions/`. Every action follows this contract:

```typescript
// Universal action result type
type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };
```

### Auth Actions (`src/server/actions/auth.ts`)

```typescript
'use server';

import type { SignUpInput, SignInInput } from '@/lib/validations/auth';

/**
 * Register a new user with email and password.
 * Creates User record with bcryptjs-hashed password.
 * Auto signs in via NextAuth after creation.
 * Redirects to /create-workspace for first-time onboarding.
 *
 * @errors "Email already in use" | "Validation error"
 */
export async function signUp(
  input: SignUpInput
): Promise<ActionResult<{ userId: string }>> { /* ... */ }

/**
 * Sign in with email and password via NextAuth Credentials provider.
 * Returns JWT session on success.
 *
 * @errors "Invalid credentials" | "Validation error"
 */
export async function signIn(
  input: SignInInput
): Promise<ActionResult<void>> { /* ... */ }

/**
 * Sign out the current user. Clears NextAuth session.
 * Redirects to /sign-in.
 */
export async function signOut(): Promise<void> { /* ... */ }
```

### Workspace Actions (`src/server/actions/workspace.ts`)

```typescript
'use server';

import type {
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
} from '@/lib/validations/workspace';
import type { InviteMemberInput, ChangeMemberRoleInput, RemoveMemberInput } from '@/lib/validations/member';
import type { Workspace, WorkspaceMember } from '@prisma/client';

/**
 * Create a new workspace. Creator becomes OWNER member.
 * Validates slug global uniqueness.
 * Revalidates: /create-workspace, / (root redirect)
 *
 * @auth Authenticated user
 * @errors "Slug already taken" | "Validation error"
 */
export async function createWorkspace(
  input: CreateWorkspaceInput
): Promise<ActionResult<{ workspace: Workspace }>> { /* ... */ }

/**
 * Update workspace name, slug, description, or image.
 * Validates slug uniqueness if changing.
 * Revalidates: /[workspaceSlug]/settings
 *
 * @auth ADMIN role in workspace
 * @errors "Slug already taken" | "Not authorized" | "Validation error"
 */
export async function updateWorkspace(
  input: UpdateWorkspaceInput
): Promise<ActionResult<{ workspace: Workspace }>> { /* ... */ }

/**
 * Invite a new member to the workspace via email.
 * Creates WorkspaceInvitation with unique token and 7-day expiry.
 * If user is already a member, returns error.
 * Revalidates: /[workspaceSlug]/settings/members
 *
 * @auth ADMIN role in workspace
 * @errors "User is already a member" | "Invitation already pending" | "Not authorized"
 */
export async function inviteMember(
  input: InviteMemberInput
): Promise<ActionResult<{ invitationId: string; token: string }>> { /* ... */ }

/**
 * Accept a workspace invitation using the token.
 * Creates WorkspaceMember with the invited role.
 * Marks invitation as ACCEPTED.
 *
 * @auth Authenticated user (email must match invitation email)
 * @errors "Invalid or expired invitation" | "Already a member"
 */
export async function acceptInvite(
  token: string
): Promise<ActionResult<{ workspaceSlug: string }>> { /* ... */ }

/**
 * Change a member's role within a workspace.
 * Cannot change the OWNER role (ownership transfer is separate).
 * Cannot change own role.
 * Revalidates: /[workspaceSlug]/settings/members
 *
 * @auth ADMIN role in workspace
 * @errors "Cannot change owner role" | "Cannot change own role" | "Not authorized"
 */
export async function changeMemberRole(
  input: ChangeMemberRoleInput
): Promise<ActionResult<{ member: WorkspaceMember }>> { /* ... */ }

/**
 * Remove a member from the workspace.
 * Unassigns all their issues in the workspace.
 * Cannot remove the workspace owner.
 * Revalidates: /[workspaceSlug]/settings/members
 *
 * @auth ADMIN role in workspace
 * @errors "Cannot remove workspace owner" | "Not authorized"
 */
export async function removeMember(
  input: RemoveMemberInput
): Promise<ActionResult<void>> { /* ... */ }
```

### Project Actions (`src/server/actions/project.ts`)

```typescript
'use server';

import type { CreateProjectInput, UpdateProjectInput } from '@/lib/validations/project';
import type { Project } from '@prisma/client';

/**
 * Create a new project within a workspace.
 * Validates prefix uniqueness within workspace.
 * Seeds default workflow statuses (Backlog, Todo, In Progress, In Review, Done, Cancelled).
 * Revalidates: /[workspaceSlug]/projects, sidebar
 *
 * @auth ADMIN role in workspace
 * @errors "Project key already exists" | "Not authorized" | "Validation error"
 */
export async function createProject(
  input: CreateProjectInput
): Promise<ActionResult<{ project: Project }>> { /* ... */ }

/**
 * Update project metadata (name, description, icon, color, lead).
 * Prefix is NOT editable after creation.
 * Revalidates: /[workspaceSlug]/[projectKey]/settings
 *
 * @auth ADMIN role in workspace
 * @errors "Not authorized" | "Validation error"
 */
export async function updateProject(
  input: UpdateProjectInput
): Promise<ActionResult<{ project: Project }>> { /* ... */ }

/**
 * Archive a project (soft delete via deletedAt).
 * Issues become read-only. Hidden from active project list.
 * Revalidates: /[workspaceSlug]/projects, sidebar
 *
 * @auth ADMIN role in workspace
 * @errors "Not authorized" | "Project not found"
 */
export async function archiveProject(
  projectId: string
): Promise<ActionResult<void>> { /* ... */ }

/**
 * Toggle starred/favorite status for current user.
 * Creates or deletes ProjectFavorite record.
 * Revalidates: sidebar
 *
 * @auth MEMBER role in workspace
 */
export async function toggleProjectFavorite(
  projectId: string
): Promise<ActionResult<{ isFavorite: boolean }>> { /* ... */ }
```

### Status Actions (`src/server/actions/status.ts`)

```typescript
'use server';

import type {
  CreateStatusInput,
  UpdateStatusInput,
  ReorderStatusesInput,
  DeleteStatusInput,
} from '@/lib/validations/status';
import type { WorkflowStatus } from '@prisma/client';

/**
 * Create a new workflow status for a project.
 * Appends to end of position list.
 * Revalidates: /[workspaceSlug]/[projectKey]/board, /settings
 *
 * @auth ADMIN role in workspace
 * @errors "Status name already exists in project" | "Not authorized"
 */
export async function createStatus(
  input: CreateStatusInput
): Promise<ActionResult<{ status: WorkflowStatus }>> { /* ... */ }

/**
 * Update a workflow status (name, color, category).
 * Revalidates: /[workspaceSlug]/[projectKey]/board
 *
 * @auth ADMIN role in workspace
 * @errors "Status name already exists" | "Not authorized"
 */
export async function updateStatus(
  input: UpdateStatusInput
): Promise<ActionResult<{ status: WorkflowStatus }>> { /* ... */ }

/**
 * Reorder workflow statuses by providing ordered array of status IDs.
 * Updates position field for each status.
 * Revalidates: /[workspaceSlug]/[projectKey]/board
 *
 * @auth ADMIN role in workspace
 * @errors "Not authorized" | "Invalid status IDs"
 */
export async function reorderStatuses(
  input: ReorderStatusesInput
): Promise<ActionResult<void>> { /* ... */ }

/**
 * Delete a workflow status. All issues in this status must be migrated
 * to migrateToStatusId first.
 * Revalidates: /[workspaceSlug]/[projectKey]/board
 *
 * @auth ADMIN role in workspace
 * @errors "Cannot delete: migrate issues first" | "Not authorized"
 */
export async function deleteStatus(
  input: DeleteStatusInput
): Promise<ActionResult<void>> { /* ... */ }
```

### Issue Actions (`src/server/actions/issue.ts`)

```typescript
'use server';

import type {
  CreateIssueInput,
  UpdateIssueInput,
  MoveIssueInput,
  ReorderIssueInput,
  BulkUpdateIssuesInput,
} from '@/lib/validations/issue';
import type { Issue } from '@prisma/client';

/**
 * Create a new issue. Uses Prisma $transaction to atomically increment
 * project.issueCounter and create the issue with generated key.
 * Extracts descriptionText for search.
 * Logs ISSUE_CREATED activity.
 * Revalidates: /[workspaceSlug]/[projectKey]/board, /list
 *
 * @auth MEMBER role in workspace
 * @errors "Project not found" | "Invalid status" | "Not authorized"
 */
export async function createIssue(
  input: CreateIssueInput
): Promise<ActionResult<{ issue: Issue }>> { /* ... */ }

/**
 * Update one or more issue fields. Each changed field is logged as
 * a separate activity entry. Uses optimistic locking via updatedAt check.
 * Revalidates: /[workspaceSlug]/[projectKey]/board, issue detail
 *
 * @auth MEMBER role in workspace
 * @errors "Conflict: issue was modified" (409) | "Issue not found" | "Not authorized"
 */
export async function updateIssue(
  input: UpdateIssueInput
): Promise<ActionResult<{ issue: Issue }>> { /* ... */ }

/**
 * Delete an issue (soft delete via deletedAt).
 * Members can delete their own issues; ADMIN+ can delete any.
 * Logs ISSUE_DELETED activity.
 * Revalidates: /[workspaceSlug]/[projectKey]/board, /list
 *
 * @auth MEMBER (own issues) or ADMIN (any)
 * @errors "Not authorized" | "Issue not found"
 */
export async function deleteIssue(
  issueId: string
): Promise<ActionResult<void>> { /* ... */ }

/**
 * Move an issue to a different status column and/or position (drag-and-drop).
 * Updates statusId and position atomically.
 * Logs STATUS_CHANGED activity if status differs.
 * Revalidates: /[workspaceSlug]/[projectKey]/board
 *
 * @auth MEMBER role in workspace
 * @errors "Issue not found" | "Invalid status" | "Not authorized"
 */
export async function moveIssue(
  input: MoveIssueInput
): Promise<ActionResult<void>> { /* ... */ }

/**
 * Reorder an issue within the same column (change position only).
 * Revalidates: /[workspaceSlug]/[projectKey]/board
 *
 * @auth MEMBER role in workspace
 * @errors "Issue not found" | "Not authorized"
 */
export async function reorderIssue(
  input: ReorderIssueInput
): Promise<ActionResult<void>> { /* ... */ }

/**
 * Bulk update multiple issues at once (status, assignee, priority, labels).
 * Logs activity for each changed field on each issue.
 * Revalidates: /[workspaceSlug]/[projectKey]/board, /list
 *
 * @auth MEMBER role in workspace
 * @errors "No issues found" | "Not authorized"
 */
export async function bulkUpdateIssues(
  input: BulkUpdateIssuesInput
): Promise<ActionResult<{ updatedCount: number }>> { /* ... */ }
```

### Comment Actions (`src/server/actions/comment.ts`)

```typescript
'use server';

import type {
  CreateCommentInput,
  UpdateCommentInput,
  DeleteCommentInput,
} from '@/lib/validations/comment';
import type { Comment } from '@prisma/client';

/**
 * Add a comment to an issue. Extracts bodyText for search.
 * Logs COMMENT_ADDED activity.
 * Revalidates: issue detail page
 *
 * @auth VIEWER+ role in workspace (any member can comment)
 * @errors "Issue not found" | "Not authorized"
 */
export async function createComment(
  input: CreateCommentInput
): Promise<ActionResult<{ comment: Comment }>> { /* ... */ }

/**
 * Update a comment's body. Only the original author can edit.
 * Revalidates: issue detail page
 *
 * @auth Comment author only
 * @errors "Not the author" | "Comment not found"
 */
export async function updateComment(
  input: UpdateCommentInput
): Promise<ActionResult<{ comment: Comment }>> { /* ... */ }

/**
 * Delete a comment. Author can delete their own; ADMIN can delete any.
 * Revalidates: issue detail page
 *
 * @auth Comment author or ADMIN
 * @errors "Not authorized" | "Comment not found"
 */
export async function deleteComment(
  input: DeleteCommentInput
): Promise<ActionResult<void>> { /* ... */ }
```

### Label Actions (`src/server/actions/label.ts`)

```typescript
'use server';

import type {
  CreateLabelInput,
  UpdateLabelInput,
  DeleteLabelInput,
} from '@/lib/validations/label';
import type { Label } from '@prisma/client';

/**
 * Create a new label in a workspace. Labels are shared across all projects.
 * Validates name uniqueness within workspace.
 * Revalidates: label pickers across the app
 *
 * @auth ADMIN role in workspace
 * @errors "Label name already exists" | "Not authorized"
 */
export async function createLabel(
  input: CreateLabelInput
): Promise<ActionResult<{ label: Label }>> { /* ... */ }

/**
 * Update a label's name or color.
 * Revalidates: all views showing labels
 *
 * @auth ADMIN role in workspace
 * @errors "Label name already exists" | "Not authorized" | "Label not found"
 */
export async function updateLabel(
  input: UpdateLabelInput
): Promise<ActionResult<{ label: Label }>> { /* ... */ }

/**
 * Delete a label. Removes from all associated issues.
 * Revalidates: all views showing labels
 *
 * @auth ADMIN role in workspace
 * @errors "Not authorized" | "Label not found"
 */
export async function deleteLabel(
  input: DeleteLabelInput
): Promise<ActionResult<void>> { /* ... */ }
```

### Search Action / API Route (`src/app/api/search/route.ts`)

```typescript
// This is a GET API route (not a server action) because it is called
// from the client-side cmdk command palette with debounced fetches.

import type { SearchIssuesInput } from '@/lib/validations/issue';

/**
 * GET /api/search?workspaceId=xxx&query=yyy&limit=10
 *
 * Searches issues by title and key using Prisma `contains` (case-insensitive).
 * Returns lightweight results for the command palette.
 *
 * @auth Authenticated user with workspace membership
 * @returns SearchResult[]
 */
export async function GET(request: Request): Promise<Response> { /* ... */ }
```

---

## 4. TypeScript Type Definitions

### Entity Types (`src/types/index.ts`)

These types re-export from Prisma and add relation variants.

```typescript
// src/types/index.ts

export type {
  User,
  Workspace,
  WorkspaceMember,
  WorkspaceInvitation,
  Project,
  ProjectFavorite,
  WorkflowStatus,
  Issue,
  IssueLink,
  Label,
  Sprint,
  Comment,
  Activity,
} from '@prisma/client';

export type {
  Role,
  InvitationStatus,
  StatusCategory,
  IssueType,
  Priority,
  LinkType,
  SprintStatus,
} from '@prisma/client';

// Re-export all "with relations" types
export * from './auth';
export * from './board';
export * from './api';
```

### Auth Types (`src/types/auth.ts`)

```typescript
// src/types/auth.ts
import type { User } from '@prisma/client';

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
  workspaces: (import('@prisma/client').WorkspaceMember & {
    workspace: import('@prisma/client').Workspace;
  })[];
};
```

### Board Types (`src/types/board.ts`)

```typescript
// src/types/board.ts
import type { WorkflowStatus, Issue, User, Label } from '@prisma/client';

/** Lightweight issue representation for board cards */
export interface BoardIssue {
  id: string;
  key: string;
  title: string;
  type: import('@prisma/client').IssueType;
  priority: import('@prisma/client').Priority;
  position: string;
  dueDate: Date | null;
  assignee: {
    id: string;
    name: string | null;
    image: string | null;
  } | null;
  labels: {
    id: string;
    name: string;
    color: string;
  }[];
}

/** A board column: status with its issues */
export interface BoardColumn {
  id: string;
  name: string;
  category: import('@prisma/client').StatusCategory;
  color: string;
  position: number;
  issues: BoardIssue[];
  issueCount: number; // Total count (may exceed issues.length due to pagination)
}

/** Full board data passed from server to client */
export interface BoardData {
  columns: BoardColumn[];
  project: {
    id: string;
    name: string;
    prefix: string;
  };
}

/** Data attached to a draggable item for dnd-kit */
export interface DragData {
  type: 'issue';
  issue: BoardIssue;
  columnId: string;
  index: number;
}

/** Data attached to a droppable column for dnd-kit */
export interface DropColumnData {
  type: 'column';
  columnId: string;
}

/** Describes a drag operation's result */
export interface DragResult {
  issueId: string;
  fromColumnId: string;
  toColumnId: string;
  newPosition: string; // Fractional index
}
```

### API Response Types (`src/types/api.ts`)

```typescript
// src/types/api.ts

/** Universal server action result wrapper */
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/** Paginated response for list views */
export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
  totalCount: number;
}

/** Search result for the Cmd+K command palette */
export interface SearchResult {
  id: string;
  key: string;
  title: string;
  projectName: string;
  projectPrefix: string;
  projectColor: string | null;
  status: {
    name: string;
    color: string;
  };
  assignee: {
    name: string | null;
    image: string | null;
  } | null;
}

/** Error response from API routes */
export interface ApiError {
  error: string;
  code?: string;
  details?: Record<string, string[]>; // Zod field-level errors
}
```

### "With Relations" Types (`src/types/index.ts` continued)

```typescript
// Composite types used across the application

import type {
  User,
  Workspace,
  WorkspaceMember,
  WorkspaceInvitation,
  Project,
  WorkflowStatus,
  Issue,
  Comment,
  Activity,
  Label,
} from '@prisma/client';

// ----- Issue with relations -----

/** Full issue with all relations (for detail page) */
export type IssueWithRelations = Issue & {
  status: WorkflowStatus;
  assignee: Pick<User, 'id' | 'name' | 'image'> | null;
  reporter: Pick<User, 'id' | 'name' | 'image'>;
  labels: Label[];
  project: Pick<Project, 'id' | 'name' | 'prefix' | 'workspaceId'>;
  _count: {
    comments: number;
    children: number;
  };
};

/** Issue for list view table rows */
export type IssueListItem = Issue & {
  status: Pick<WorkflowStatus, 'id' | 'name' | 'color' | 'category'>;
  assignee: Pick<User, 'id' | 'name' | 'image'> | null;
  labels: Pick<Label, 'id' | 'name' | 'color'>[];
};

// ----- Project with relations -----

/** Project with issue counts per status (for project list) */
export type ProjectWithCounts = Project & {
  _count: {
    issues: number;
  };
  isFavorite: boolean;
};

/** Project with full status configuration */
export type ProjectWithStatuses = Project & {
  statuses: WorkflowStatus[];
};

// ----- Workspace with relations -----

/** Workspace with member count (for switcher) */
export type WorkspaceWithMemberCount = Workspace & {
  _count: {
    members: number;
  };
};

/** Workspace member with user details (for member management) */
export type MemberWithUser = WorkspaceMember & {
  user: Pick<User, 'id' | 'name' | 'email' | 'image'>;
};

/** Invitation with workspace name (for invite page) */
export type InvitationWithWorkspace = WorkspaceInvitation & {
  workspace: Pick<Workspace, 'id' | 'name' | 'slug' | 'image'>;
};

// ----- Comment with relations -----

/** Comment with author info */
export type CommentWithAuthor = Comment & {
  author: Pick<User, 'id' | 'name' | 'image'>;
};

// ----- Activity with relations -----

/** Activity with actor info */
export type ActivityWithActor = Activity & {
  actor: Pick<User, 'id' | 'name' | 'image'>;
};

/** Activity metadata variants */
export type ActivityMetadata =
  | { field: 'status'; from: string; to: string }
  | { field: 'assignee'; from: string | null; to: string | null }
  | { field: 'priority'; from: string; to: string }
  | { field: 'type'; from: string; to: string }
  | { field: 'title'; from: string; to: string }
  | { field: 'description'; from: null; to: null }
  | { field: 'dueDate'; from: string | null; to: string | null }
  | { field: 'labels'; added: string[]; removed: string[] }
  | { type: 'created' }
  | { type: 'deleted' }
  | { type: 'comment_added'; commentId: string };

// ----- Sidebar navigation -----

/** Project item for sidebar display */
export type SidebarProject = Pick<Project, 'id' | 'name' | 'prefix' | 'icon' | 'color'> & {
  isFavorite: boolean;
};
```

### Constants (`src/lib/constants.ts`)

```typescript
// src/lib/constants.ts

import type { IssueType, Priority, StatusCategory } from '@prisma/client';

/** Issue type display configuration */
export const ISSUE_TYPE_CONFIG: Record<
  IssueType,
  { label: string; icon: string; color: string }
> = {
  EPIC: { label: 'Epic', icon: 'Zap', color: '#8B5CF6' },
  STORY: { label: 'Story', icon: 'BookOpen', color: '#3B82F6' },
  TASK: { label: 'Task', icon: 'CheckSquare', color: '#10B981' },
  BUG: { label: 'Bug', icon: 'Bug', color: '#EF4444' },
};

/** Priority display configuration */
export const PRIORITY_CONFIG: Record<
  Priority,
  { label: string; icon: string; color: string; level: number }
> = {
  URGENT: { label: 'Urgent', icon: 'AlertTriangle', color: '#EF4444', level: 0 },
  HIGH: { label: 'High', icon: 'ArrowUp', color: '#F97316', level: 1 },
  MEDIUM: { label: 'Medium', icon: 'Minus', color: '#F59E0B', level: 2 },
  LOW: { label: 'Low', icon: 'ArrowDown', color: '#3B82F6', level: 3 },
  NONE: { label: 'None', icon: 'Minus', color: '#6B7280', level: 4 },
};

/** Status category display configuration */
export const STATUS_CATEGORY_CONFIG: Record<
  StatusCategory,
  { label: string; icon: string }
> = {
  BACKLOG: { label: 'Backlog', icon: 'Circle' },
  TODO: { label: 'To Do', icon: 'CircleDot' },
  IN_PROGRESS: { label: 'In Progress', icon: 'Timer' },
  DONE: { label: 'Done', icon: 'CircleCheckBig' },
  CANCELLED: { label: 'Cancelled', icon: 'CircleX' },
};

/** Default colors for label creation */
export const LABEL_COLORS = [
  '#EF4444', // Red
  '#F97316', // Orange
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#3B82F6', // Blue
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#6B7280', // Gray
  '#14B8A6', // Teal
  '#A855F7', // Purple
] as const;

/** Default statuses seeded for every new project */
export const DEFAULT_STATUSES: {
  name: string;
  category: StatusCategory;
  color: string;
  position: number;
}[] = [
  { name: 'Backlog', category: 'BACKLOG', color: '#6B7280', position: 0 },
  { name: 'Todo', category: 'TODO', color: '#3B82F6', position: 1 },
  { name: 'In Progress', category: 'IN_PROGRESS', color: '#F59E0B', position: 2 },
  { name: 'In Review', category: 'IN_PROGRESS', color: '#8B5CF6', position: 3 },
  { name: 'Done', category: 'DONE', color: '#10B981', position: 4 },
  { name: 'Cancelled', category: 'CANCELLED', color: '#EF4444', position: 5 },
];

/** Role hierarchy for authorization checks */
export const ROLE_HIERARCHY: Record<string, number> = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  VIEWER: 1,
};
```

---

## 5. Component Interfaces

Props for all key components. All components use the `@/` path alias.

### Board Components (`src/components/boards/`)

```typescript
// ---- board-view.tsx ----
// 'use client' - Main board container wrapping DndContext

import type { BoardColumn, BoardData, DragResult } from '@/types/board';
import type { MemberWithUser } from '@/types';

export interface BoardViewProps {
  /** Initial board data from server (hydrated into TanStack Query) */
  initialData: BoardData;
  /** Workspace members for assignee filter/picker */
  members: MemberWithUser[];
  /** Workspace labels for filter */
  labels: { id: string; name: string; color: string }[];
  /** Project ID for query keys */
  projectId: string;
  /** Workspace slug for URL navigation */
  workspaceSlug: string;
}

// ---- board-column.tsx ----
// 'use client' - Single Kanban column with SortableContext

import type { BoardColumn as BoardColumnType, BoardIssue } from '@/types/board';

export interface BoardColumnProps {
  /** Column data (status + issues) */
  column: BoardColumnType;
  /** Whether this column is currently a drop target */
  isOver: boolean;
  /** Callback to open quick-create issue at bottom of column */
  onQuickCreate: (statusId: string) => void;
}

// ---- board-card.tsx ----
// 'use client' - Draggable issue card

import type { BoardIssue } from '@/types/board';

export interface BoardCardProps {
  /** Issue data for display */
  issue: BoardIssue;
  /** Whether this card is currently being dragged */
  isDragging: boolean;
  /** Click handler to open issue detail */
  onClick: (issueKey: string) => void;
}

// ---- board-filters.tsx ----
// 'use client' - Quick filter bar above the board

import type { MemberWithUser } from '@/types';

export interface BoardFiltersProps {
  /** Workspace members for assignee filter */
  members: MemberWithUser[];
  /** Workspace labels for label filter */
  labels: { id: string; name: string; color: string }[];
  /** Project statuses for status filter */
  statuses: { id: string; name: string; color: string }[];
  /** Count of active filters */
  activeFilterCount: number;
}

// ---- column-header.tsx ----

export interface ColumnHeaderProps {
  /** Status name */
  name: string;
  /** Status color */
  color: string;
  /** Number of issues in column */
  count: number;
  /** Total issues (may differ if paginated) */
  totalCount: number;
}

// ---- quick-create-issue.tsx ----
// 'use client' - Inline issue creation at column bottom

export interface QuickCreateIssueProps {
  /** Project ID for the new issue */
  projectId: string;
  /** Status ID (column) for the new issue */
  statusId: string;
  /** Callback after successful creation */
  onCreated: () => void;
}

// ---- drag-overlay-card.tsx ----
// 'use client' - Floating card rendered during drag

import type { BoardIssue } from '@/types/board';

export interface DragOverlayCardProps {
  /** Issue being dragged */
  issue: BoardIssue;
}
```

### Issue Components (`src/components/issues/`)

```typescript
// ---- issue-detail.tsx ----
// 'use client' - Full issue detail view

import type { IssueWithRelations, MemberWithUser, CommentWithAuthor, ActivityWithActor } from '@/types';

export interface IssueDetailProps {
  /** Full issue data with all relations */
  issue: IssueWithRelations;
  /** Project members for assignee picker */
  members: MemberWithUser[];
  /** Workspace labels for label picker */
  labels: { id: string; name: string; color: string }[];
  /** Project statuses for status picker */
  statuses: { id: string; name: string; color: string; category: string }[];
  /** Comments for the issue */
  comments: CommentWithAuthor[];
  /** Activity log entries */
  activities: ActivityWithActor[];
  /** Whether the current user can edit this issue */
  canEdit: boolean;
  /** Workspace slug for navigation */
  workspaceSlug: string;
}

// ---- issue-detail-sidebar.tsx ----
// 'use client' - Right sidebar in issue detail

export interface IssueDetailSidebarProps {
  /** Current issue values */
  issueId: string;
  statusId: string;
  assigneeId: string | null;
  priority: import('@prisma/client').Priority;
  dueDate: Date | null;
  labelIds: string[];
  reporterName: string | null;
  reporterImage: string | null;
  createdAt: Date;
  updatedAt: Date;
  /** Available options */
  statuses: { id: string; name: string; color: string; category: string }[];
  members: { id: string; name: string | null; image: string | null }[];
  labels: { id: string; name: string; color: string }[];
  /** Whether user can edit */
  canEdit: boolean;
  /** Callbacks for field changes */
  onFieldChange: (field: string, value: unknown) => void;
}

// ---- issue-title.tsx ----
// 'use client' - Inline-editable issue title

export interface IssueTitleProps {
  /** Current title value */
  title: string;
  /** Issue key for display (e.g., "PROJ-123") */
  issueKey: string;
  /** Issue type for icon */
  type: import('@prisma/client').IssueType;
  /** Whether editing is allowed */
  canEdit: boolean;
  /** Save callback (debounced) */
  onSave: (title: string) => void;
}

// ---- issue-description.tsx ----
// 'use client' - Tiptap editor wrapper for issue description

export interface IssueDescriptionProps {
  /** Current description (Tiptap JSON) */
  content: unknown;
  /** Whether editing is allowed */
  canEdit: boolean;
  /** Save callback (debounced, auto-save) */
  onSave: (content: unknown, plainText: string) => void;
}

// ---- issue-comments.tsx ----
// 'use client' - Comment list + new comment form

import type { CommentWithAuthor } from '@/types';

export interface IssueCommentsProps {
  /** Existing comments */
  comments: CommentWithAuthor[];
  /** Issue ID for creating new comments */
  issueId: string;
  /** Current user ID (to determine edit/delete permissions) */
  currentUserId: string;
  /** Whether user can add comments */
  canComment: boolean;
}

// ---- issue-comment-item.tsx ----

import type { CommentWithAuthor } from '@/types';

export interface IssueCommentItemProps {
  /** Comment data */
  comment: CommentWithAuthor;
  /** Whether the current user is the author */
  isAuthor: boolean;
  /** Callbacks */
  onUpdate: (id: string, body: unknown) => void;
  onDelete: (id: string) => void;
}

// ---- issue-activity.tsx ----
// 'use client' - Activity log feed

import type { ActivityWithActor } from '@/types';

export interface IssueActivityProps {
  /** Activity entries (sorted newest first) */
  activities: ActivityWithActor[];
}

// ---- issue-activity-item.tsx ----

import type { ActivityWithActor, ActivityMetadata } from '@/types';

export interface IssueActivityItemProps {
  /** Activity data with actor */
  activity: ActivityWithActor;
}

// ---- create-issue-dialog.tsx ----
// 'use client' - Modal for creating a new issue

import type { MemberWithUser } from '@/types';

export interface CreateIssueDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Close callback */
  onOpenChange: (open: boolean) => void;
  /** Project ID */
  projectId: string;
  /** Pre-selected status ID (e.g., from clicking "+" on a column) */
  defaultStatusId?: string;
  /** Available statuses */
  statuses: { id: string; name: string; color: string }[];
  /** Workspace members for assignee picker */
  members: MemberWithUser[];
  /** Workspace labels */
  labels: { id: string; name: string; color: string }[];
  /** Callback after successful creation */
  onCreated?: (issueKey: string) => void;
}

// ---- issue-type-icon.tsx ----

export interface IssueTypeIconProps {
  type: import('@prisma/client').IssueType;
  className?: string;
  size?: number;
}

// ---- issue-priority-icon.tsx ----

export interface IssuePriorityIconProps {
  priority: import('@prisma/client').Priority;
  className?: string;
  size?: number;
  showLabel?: boolean;
}

// ---- issue-status-badge.tsx ----

export interface IssueStatusBadgeProps {
  name: string;
  color: string;
  category: import('@prisma/client').StatusCategory;
}

// ---- issue-label-badge.tsx ----

export interface IssueLabelBadgeProps {
  name: string;
  color: string;
  onRemove?: () => void;
}

// ---- assignee-select.tsx ----
// 'use client' - Avatar picker for assigning members

export interface AssigneeSelectProps {
  value: string | null;
  onChange: (assigneeId: string | null) => void;
  members: { id: string; name: string | null; image: string | null }[];
  disabled?: boolean;
}

// ---- status-select.tsx ----

export interface StatusSelectProps {
  value: string;
  onChange: (statusId: string) => void;
  statuses: { id: string; name: string; color: string; category: string }[];
  disabled?: boolean;
}

// ---- priority-select.tsx ----

export interface PrioritySelectProps {
  value: import('@prisma/client').Priority;
  onChange: (priority: import('@prisma/client').Priority) => void;
  disabled?: boolean;
}

// ---- label-select.tsx ----

export interface LabelSelectProps {
  value: string[];
  onChange: (labelIds: string[]) => void;
  labels: { id: string; name: string; color: string }[];
  disabled?: boolean;
}

// ---- due-date-picker.tsx ----

export interface DueDatePickerProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
  disabled?: boolean;
}
```

### Layout Components (`src/components/layout/`)

```typescript
// ---- app-sidebar.tsx ----
// 'use client' - Main app sidebar

import type { SidebarProject, WorkspaceWithMemberCount } from '@/types';

export interface AppSidebarProps {
  /** Current workspace */
  workspace: WorkspaceWithMemberCount;
  /** All workspaces for switcher */
  workspaces: WorkspaceWithMemberCount[];
  /** Projects (favorites first, then all) */
  projects: SidebarProject[];
  /** Currently active project key (for highlight) */
  activeProjectKey?: string;
}

// ---- workspace-switcher.tsx ----
// 'use client'

import type { WorkspaceWithMemberCount } from '@/types';

export interface WorkspaceSwitcherProps {
  currentWorkspace: WorkspaceWithMemberCount;
  workspaces: WorkspaceWithMemberCount[];
}

// ---- project-list.tsx ----
// 'use client' - Sidebar project list

import type { SidebarProject } from '@/types';

export interface ProjectListProps {
  projects: SidebarProject[];
  workspaceSlug: string;
  activeProjectKey?: string;
}

// ---- header.tsx ----
// 'use client' - Top header bar

export interface HeaderProps {
  /** Breadcrumb segments */
  breadcrumbs: { label: string; href?: string }[];
}

// ---- user-menu.tsx ----
// 'use client'

export interface UserMenuProps {
  user: {
    name: string | null;
    email: string;
    image: string | null;
  };
}
```

### Search Components (`src/components/search/`)

```typescript
// ---- command-menu.tsx ----
// 'use client' - Cmd+K command palette

export interface CommandMenuProps {
  /** Workspace ID for scoping search */
  workspaceId: string;
  /** Workspace slug for constructing navigation URLs */
  workspaceSlug: string;
}

// ---- search-results.tsx ----

import type { SearchResult } from '@/types/api';

export interface SearchResultsProps {
  results: SearchResult[];
  isLoading: boolean;
  workspaceSlug: string;
  onSelect: (result: SearchResult) => void;
}
```

### Issues Table Components (`src/components/issues-table/`)

```typescript
// ---- issues-data-table.tsx ----
// 'use client' - TanStack Table wrapper

import type { IssueListItem, MemberWithUser } from '@/types';

export interface IssuesDataTableProps {
  /** Initial issues from server */
  initialData: {
    items: IssueListItem[];
    nextCursor: string | null;
    totalCount: number;
  };
  /** Project ID for fetching more data */
  projectId: string;
  /** Workspace slug for navigation */
  workspaceSlug: string;
  /** Project key for navigation */
  projectKey: string;
  /** Members for filter options */
  members: MemberWithUser[];
  /** Labels for filter options */
  labels: { id: string; name: string; color: string }[];
  /** Statuses for filter options */
  statuses: { id: string; name: string; color: string }[];
}

// ---- data-table-toolbar.tsx ----

export interface DataTableToolbarProps {
  /** Table instance from TanStack */
  table: import('@tanstack/react-table').Table<unknown>;
  /** Whether any filters are active */
  isFiltered: boolean;
}

// ---- data-table-pagination.tsx ----

export interface DataTablePaginationProps {
  table: import('@tanstack/react-table').Table<unknown>;
  totalCount: number;
}

// ---- data-table-faceted-filter.tsx ----

export interface DataTableFacetedFilterProps {
  column?: import('@tanstack/react-table').Column<unknown>;
  title: string;
  options: {
    label: string;
    value: string;
    icon?: React.ComponentType<{ className?: string }>;
    color?: string;
  }[];
}

// ---- data-table-view-options.tsx ----

export interface DataTableViewOptionsProps {
  table: import('@tanstack/react-table').Table<unknown>;
}
```

### Shared Components (`src/components/shared/`)

```typescript
// ---- empty-state.tsx ----

export interface EmptyStateProps {
  /** Icon name from lucide-react */
  icon?: string;
  /** Heading text */
  title: string;
  /** Description text */
  description: string;
  /** Optional action button */
  action?: {
    label: string;
    onClick: () => void;
  };
}

// ---- confirm-dialog.tsx ----

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  onConfirm: () => void;
  isLoading?: boolean;
}

// ---- page-header.tsx ----

export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}
```

---

## 6. URL Routing Contract

### Route Map

| Route | File Path | Layout Group | Auth | Params |
|-------|-----------|-------------|------|--------|
| `/` | `src/app/page.tsx` | root | Redirect | -- |
| `/sign-in` | `src/app/(auth)/sign-in/page.tsx` | `(auth)` | Public | `?callbackUrl=` |
| `/sign-up` | `src/app/(auth)/sign-up/page.tsx` | `(auth)` | Public | -- |
| `/forgot-password` | `src/app/(auth)/forgot-password/page.tsx` | `(auth)` | Public | -- |
| `/invite/[token]` | `src/app/(auth)/invite/[token]/page.tsx` | `(auth)` | Public | `token: string` |
| `/create-workspace` | `src/app/(dashboard)/create-workspace/page.tsx` | `(dashboard)` | Auth | -- |
| `/[workspaceSlug]` | `src/app/(dashboard)/[workspaceSlug]/page.tsx` | `(dashboard)` | Auth | Redirect to `/projects` |
| `/[workspaceSlug]/projects` | `src/app/(dashboard)/[workspaceSlug]/projects/page.tsx` | `(dashboard)` | Auth | -- |
| `/[workspaceSlug]/projects/new` | `src/app/(dashboard)/[workspaceSlug]/projects/new/page.tsx` | `(dashboard)` | Auth + ADMIN | -- |
| `/[workspaceSlug]/settings` | `src/app/(dashboard)/[workspaceSlug]/settings/page.tsx` | `(dashboard)` | Auth + ADMIN | -- |
| `/[workspaceSlug]/settings/members` | `src/app/(dashboard)/[workspaceSlug]/settings/members/page.tsx` | `(dashboard)` | Auth + ADMIN | -- |
| `/[workspaceSlug]/[projectKey]` | `src/app/(dashboard)/[workspaceSlug]/[projectKey]/page.tsx` | `(dashboard)` | Auth | Redirect to `/board` |
| `/[workspaceSlug]/[projectKey]/board` | `src/app/(dashboard)/[workspaceSlug]/[projectKey]/board/page.tsx` | `(dashboard)` | Auth | Filter query params |
| `/[workspaceSlug]/[projectKey]/list` | `src/app/(dashboard)/[workspaceSlug]/[projectKey]/list/page.tsx` | `(dashboard)` | Auth | Filter + pagination query params |
| `/[workspaceSlug]/[projectKey]/issues/[issueKey]` | `src/app/(dashboard)/[workspaceSlug]/[projectKey]/issues/[issueKey]/page.tsx` | `(dashboard)` | Auth | `issueKey: string` |
| `/[workspaceSlug]/[projectKey]/settings` | `src/app/(dashboard)/[workspaceSlug]/[projectKey]/settings/page.tsx` | `(dashboard)` | Auth + ADMIN | -- |

### Dynamic Route Params

| Param | Type | Source | Example | Validation |
|-------|------|--------|---------|------------|
| `workspaceSlug` | `string` | `Workspace.slug` | `"acme"` | Lookup in DB; 404 if not found or no membership |
| `projectKey` | `string` | `Project.prefix` | `"PROJ"` | Lookup within workspace; 404 if not found |
| `issueKey` | `string` | `Issue.key` | `"PROJ-123"` | Global unique lookup; 404 if not found |
| `token` | `string` | `WorkspaceInvitation.token` | CUID string | Validate status/expiry; show error if invalid |

### Query String Params (via nuqs)

#### Board View (`/[workspaceSlug]/[projectKey]/board`)

| Param | Type | Parser | Default | Example |
|-------|------|--------|---------|---------|
| `status` | `string[]` | `parseAsArrayOf(parseAsString)` | `null` (all) | `?status=in_progress,in_review` |
| `priority` | `string[]` | `parseAsArrayOf(parseAsString)` | `null` (all) | `?priority=high,urgent` |
| `assignee` | `string[]` | `parseAsArrayOf(parseAsString)` | `null` (all) | `?assignee=user123,user456` |
| `type` | `string[]` | `parseAsArrayOf(parseAsString)` | `null` (all) | `?type=bug,task` |
| `labels` | `string[]` | `parseAsArrayOf(parseAsString)` | `null` (all) | `?labels=labelId1,labelId2` |

#### List View (`/[workspaceSlug]/[projectKey]/list`)

| Param | Type | Parser | Default | Example |
|-------|------|--------|---------|---------|
| `status` | `string[]` | `parseAsArrayOf(parseAsString)` | `null` (all) | `?status=todo,in_progress` |
| `priority` | `string[]` | `parseAsArrayOf(parseAsString)` | `null` (all) | `?priority=medium` |
| `assignee` | `string[]` | `parseAsArrayOf(parseAsString)` | `null` (all) | `?assignee=user123` |
| `type` | `string[]` | `parseAsArrayOf(parseAsString)` | `null` (all) | `?type=story` |
| `labels` | `string[]` | `parseAsArrayOf(parseAsString)` | `null` (all) | `?labels=labelId1` |
| `search` | `string` | `parseAsString` | `null` | `?search=login+bug` |
| `sort` | `string` | `parseAsString` | `"createdAt"` | `?sort=priority` |
| `order` | `string` | `parseAsString` | `"desc"` | `?order=asc` |
| `cursor` | `string` | `parseAsString` | `null` | `?cursor=cuid123` |

#### Auth Pages

| Param | Type | Default | Example |
|-------|------|---------|---------|
| `callbackUrl` | `string` | `/` | `?callbackUrl=%2Facme%2FPROJ%2Fboard` |

### API Routes

| Route | Method | Purpose | Auth |
|-------|--------|---------|------|
| `/api/auth/[...nextauth]` | GET, POST | NextAuth.js handler (OAuth callbacks, CSRF, session) | Managed by NextAuth |
| `/api/search` | GET | Global issue search for Cmd+K palette | Auth required |

#### `/api/search` Query Params

| Param | Type | Required | Default | Example |
|-------|------|----------|---------|---------|
| `workspaceId` | `string` | Yes | -- | `?workspaceId=cuid123` |
| `query` | `string` | Yes | -- | `?query=login` |
| `limit` | `number` | No | `10` | `?limit=5` |

#### `/api/search` Response

```typescript
// 200 OK
{
  results: SearchResult[]; // See SearchResult type in section 4
}

// 400 Bad Request
{
  error: string;
}

// 401 Unauthorized
{
  error: "Unauthorized";
}
```

---

## Summary

This contracts document defines the complete interface layer for PMApp's MVP:

- **Prisma schema**: 16 models, 7 enums, comprehensive indexes and constraints
- **Zod schemas**: 20+ validation schemas across 7 files, all with TypeScript type exports
- **Server actions**: 25+ actions across 7 files with typed inputs, outputs, auth requirements, and error contracts
- **TypeScript types**: Entity types, relation variants, board-specific types, API response wrappers, activity metadata unions, and constants
- **Component props**: 35+ component interfaces covering boards, issues, layout, search, data tables, and shared components
- **URL routing**: 16 routes with dynamic params, 9 query string filter params, and 1 API route with defined request/response shape
