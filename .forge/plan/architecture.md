# System Architecture — PMApp (JIRA-like Project Management)

**Project:** /home/vidit/projects/pmapp
**Stack:** Next.js 15 + TypeScript + PostgreSQL + Prisma + Tailwind CSS v4 + shadcn/ui + NextAuth.js (Auth.js v5)
**Author:** Architect (Forge Pipeline)
**Date:** 2026-03-26

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [Data Models (Prisma Schema)](#2-data-models-prisma-schema)
3. [API Design](#3-api-design)
4. [State Management](#4-state-management)
5. [Authentication & Authorization Flow](#5-authentication--authorization-flow)
6. [Component Architecture](#6-component-architecture)
7. [Routing & URL Design](#7-routing--url-design)
8. [Performance & Caching Strategy](#8-performance--caching-strategy)
9. [Key Libraries & Dependencies](#9-key-libraries--dependencies)
10. [Database Indexing Strategy](#10-database-indexing-strategy)

---

## 1. Project Structure

```
pmapp/
├── .forge/                              # Forge pipeline metadata (not deployed)
├── .github/
│   └── workflows/                       # CI/CD pipelines
├── prisma/
│   ├── schema.prisma                    # Database schema (single source of truth)
│   ├── migrations/                      # Prisma migration history
│   └── seed.ts                          # Database seed script (default statuses, demo data)
├── public/                              # Static assets (favicons, images)
├── src/
│   ├── app/                             # Next.js 15 App Router
│   │   ├── layout.tsx                   # Root layout (providers, fonts, metadata)
│   │   ├── page.tsx                     # Landing redirect (-> first workspace or /sign-in)
│   │   ├── globals.css                  # Tailwind v4 directives + CSS variables
│   │   │
│   │   ├── (auth)/                      # Auth route group (unauthenticated layout)
│   │   │   ├── layout.tsx               # Centered auth card layout
│   │   │   ├── sign-in/
│   │   │   │   └── page.tsx             # Sign in (email/password + OAuth)
│   │   │   ├── sign-up/
│   │   │   │   └── page.tsx             # Sign up (email/password + OAuth)
│   │   │   ├── forgot-password/
│   │   │   │   └── page.tsx             # Forgot password form
│   │   │   └── invite/
│   │   │       └── [token]/
│   │   │           └── page.tsx         # Accept workspace invite
│   │   │
│   │   ├── (dashboard)/                 # Main app route group (authenticated layout)
│   │   │   ├── layout.tsx               # App shell: sidebar + header + main content
│   │   │   ├── page.tsx                 # Dashboard home (redirect to first workspace)
│   │   │   ├── create-workspace/
│   │   │   │   └── page.tsx             # Workspace creation (post-signup onboarding)
│   │   │   └── [workspaceSlug]/         # Workspace-scoped routes
│   │   │       ├── layout.tsx           # Workspace layout (loads workspace context)
│   │   │       ├── page.tsx             # Workspace home (redirect to projects)
│   │   │       ├── projects/
│   │   │       │   ├── page.tsx         # Project list
│   │   │       │   └── new/
│   │   │       │       └── page.tsx     # Create new project
│   │   │       ├── settings/
│   │   │       │   ├── page.tsx         # Workspace settings (general)
│   │   │       │   └── members/
│   │   │       │       └── page.tsx     # Member management + invites
│   │   │       └── [projectKey]/        # Project-scoped routes (by project prefix)
│   │   │           ├── layout.tsx       # Project layout (loads project context, sub-nav)
│   │   │           ├── page.tsx         # Redirect to board view
│   │   │           ├── board/
│   │   │           │   └── page.tsx     # Kanban board view
│   │   │           ├── list/
│   │   │           │   └── page.tsx     # List/table view
│   │   │           ├── issues/
│   │   │           │   └── [issueKey]/
│   │   │           │       └── page.tsx # Full-page issue detail view
│   │   │           └── settings/
│   │   │               └── page.tsx     # Project settings (statuses, labels, etc.)
│   │   │
│   │   └── api/                         # API routes (only where Server Actions won't work)
│   │       ├── auth/
│   │       │   └── [...nextauth]/
│   │       │       └── route.ts         # NextAuth.js catch-all route handler
│   │       ├── uploadthing/
│   │       │   └── route.ts             # File upload endpoint (Phase 2)
│   │       └── search/
│   │           └── route.ts             # Global search endpoint (GET, for Cmd+K)
│   │
│   ├── components/
│   │   ├── ui/                          # shadcn/ui components (auto-generated)
│   │   │   ├── button.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── command.tsx              # Command palette (cmdk)
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── select.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── avatar.tsx
│   │   │   ├── table.tsx
│   │   │   ├── tooltip.tsx
│   │   │   ├── popover.tsx
│   │   │   ├── calendar.tsx
│   │   │   ├── sheet.tsx                # Slide-over panel
│   │   │   ├── tabs.tsx
│   │   │   ├── textarea.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   ├── separator.tsx
│   │   │   ├── skeleton.tsx
│   │   │   └── ... (other shadcn/ui)
│   │   │
│   │   ├── layout/                      # App shell components
│   │   │   ├── app-sidebar.tsx          # Main sidebar (workspace switcher, projects, nav)
│   │   │   ├── sidebar-nav.tsx          # Sidebar navigation items
│   │   │   ├── workspace-switcher.tsx   # Workspace dropdown selector
│   │   │   ├── project-list.tsx         # Sidebar project list with stars
│   │   │   ├── header.tsx               # Top header bar (breadcrumbs, search, user menu)
│   │   │   ├── breadcrumbs.tsx          # Dynamic breadcrumb navigation
│   │   │   ├── user-menu.tsx            # User avatar dropdown (settings, sign out)
│   │   │   └── theme-toggle.tsx         # Dark/light mode toggle
│   │   │
│   │   ├── boards/                      # Kanban board components
│   │   │   ├── board-view.tsx           # Main board container (Client Component)
│   │   │   ├── board-column.tsx         # Single status column
│   │   │   ├── board-card.tsx           # Issue card on the board
│   │   │   ├── board-card-skeleton.tsx  # Loading skeleton for cards
│   │   │   ├── board-filters.tsx        # Quick filter bar (assignee, priority, label, type)
│   │   │   ├── board-header.tsx         # Board title + view switcher (board/list)
│   │   │   ├── column-header.tsx        # Column title + issue count badge
│   │   │   ├── quick-create-issue.tsx   # Inline issue creation at column bottom
│   │   │   └── drag-overlay-card.tsx    # Floating card during drag operation
│   │   │
│   │   ├── issues/                      # Issue-related components
│   │   │   ├── issue-detail.tsx         # Full issue detail view (Client Component)
│   │   │   ├── issue-detail-sidebar.tsx # Right sidebar: status, assignee, priority, etc.
│   │   │   ├── issue-title.tsx          # Editable inline title
│   │   │   ├── issue-description.tsx    # Tiptap rich text editor wrapper
│   │   │   ├── issue-comments.tsx       # Comment list + new comment form
│   │   │   ├── issue-comment-item.tsx   # Single comment display
│   │   │   ├── issue-activity.tsx       # Activity log feed
│   │   │   ├── issue-activity-item.tsx  # Single activity entry
│   │   │   ├── create-issue-dialog.tsx  # Modal for creating a new issue
│   │   │   ├── issue-type-icon.tsx      # Icon for Bug/Task/Story/Epic
│   │   │   ├── issue-priority-icon.tsx  # Priority level indicator
│   │   │   ├── issue-status-badge.tsx   # Status badge with color
│   │   │   ├── issue-label-badge.tsx    # Label tag with color
│   │   │   ├── assignee-select.tsx      # Member avatar picker for assignment
│   │   │   ├── status-select.tsx        # Status dropdown selector
│   │   │   ├── priority-select.tsx      # Priority dropdown selector
│   │   │   ├── label-select.tsx         # Multi-select label picker
│   │   │   └── due-date-picker.tsx      # Date picker for due dates
│   │   │
│   │   ├── issues-table/               # List view components
│   │   │   ├── issues-data-table.tsx    # TanStack Table wrapper (Client Component)
│   │   │   ├── columns.tsx              # Column definitions
│   │   │   ├── data-table-toolbar.tsx   # Filter/search toolbar above table
│   │   │   ├── data-table-pagination.tsx # Pagination controls
│   │   │   ├── data-table-faceted-filter.tsx # Faceted filter popover
│   │   │   └── data-table-view-options.tsx   # Column visibility toggle
│   │   │
│   │   ├── projects/                    # Project components
│   │   │   ├── project-card.tsx         # Project card in project list
│   │   │   ├── create-project-form.tsx  # New project form (name, key, icon, color)
│   │   │   ├── project-settings-form.tsx # Project settings form
│   │   │   ├── project-icon.tsx         # Emoji icon display
│   │   │   └── star-project-button.tsx  # Favorite/star toggle button
│   │   │
│   │   ├── workspace/                   # Workspace components
│   │   │   ├── create-workspace-form.tsx # New workspace form
│   │   │   ├── workspace-settings-form.tsx # Workspace general settings
│   │   │   ├── members-table.tsx        # Member list with role management
│   │   │   ├── invite-member-dialog.tsx # Email invite modal
│   │   │   └── role-badge.tsx           # Role display badge
│   │   │
│   │   ├── editor/                      # Rich text editor components
│   │   │   ├── tiptap-editor.tsx        # Tiptap editor instance + toolbar
│   │   │   ├── editor-toolbar.tsx       # Formatting toolbar (bold, italic, lists, etc.)
│   │   │   └── editor-content.tsx       # Read-only rendered Tiptap content
│   │   │
│   │   ├── search/                      # Search components
│   │   │   ├── command-menu.tsx         # Cmd+K command palette (Client Component)
│   │   │   └── search-results.tsx       # Search result items
│   │   │
│   │   └── shared/                      # Shared/generic components
│   │       ├── empty-state.tsx          # Empty state illustration + CTA
│   │       ├── loading-spinner.tsx      # Spinner indicator
│   │       ├── confirm-dialog.tsx       # Generic confirmation dialog
│   │       ├── error-boundary.tsx       # Error boundary wrapper
│   │       └── page-header.tsx          # Page title + actions bar
│   │
│   ├── hooks/                           # Custom React hooks
│   │   ├── use-current-user.ts          # Get current session user
│   │   ├── use-current-workspace.ts     # Get current workspace from URL params
│   │   ├── use-current-project.ts       # Get current project from URL params
│   │   ├── use-debounce.ts              # Debounce hook for search/save
│   │   ├── use-keyboard-shortcut.ts     # Register keyboard shortcuts
│   │   └── use-media-query.ts           # Responsive breakpoint detection
│   │
│   ├── stores/                          # Zustand stores (client-side UI state)
│   │   ├── sidebar-store.ts             # Sidebar open/collapsed state
│   │   ├── command-menu-store.ts        # Command palette open/close state
│   │   ├── board-filter-store.ts        # Active board filters (synced with URL via nuqs)
│   │   └── issue-detail-store.ts        # Issue detail panel open/close + selected issue
│   │
│   ├── lib/                             # Shared utilities & configuration
│   │   ├── utils.ts                     # cn() helper, generic utils
│   │   ├── constants.ts                 # App-wide constants (priorities, types, colors)
│   │   ├── providers.tsx                # Root providers wrapper (Session, Query, Theme)
│   │   ├── auth/
│   │   │   ├── config.ts                # NextAuth.js v5 configuration (providers, callbacks)
│   │   │   └── helpers.ts               # Auth utility functions (requireAuth, requireRole)
│   │   ├── db/
│   │   │   └── client.ts                # Prisma client singleton
│   │   └── validations/                 # Zod schemas (shared client + server)
│   │       ├── auth.ts                  # Sign-in, sign-up, forgot-password schemas
│   │       ├── workspace.ts             # Workspace CRUD schemas
│   │       ├── project.ts               # Project CRUD schemas
│   │       ├── issue.ts                 # Issue CRUD, move, filter schemas
│   │       ├── comment.ts               # Comment CRUD schemas
│   │       └── member.ts                # Invite, role change schemas
│   │
│   ├── server/                          # Server-side logic (runs only on server)
│   │   ├── actions/                     # Server Actions (mutations)
│   │   │   ├── auth.ts                  # Sign-up, sign-in credential actions
│   │   │   ├── workspace.ts             # Create, update workspace; manage invites
│   │   │   ├── project.ts               # Create, update, star/unstar project
│   │   │   ├── issue.ts                 # Create, update, move, delete issue
│   │   │   ├── comment.ts               # Create, update, delete comment
│   │   │   ├── member.ts               # Invite, change role, remove member
│   │   │   ├── label.ts                 # Create, update, delete label
│   │   │   └── status.ts                # Create, update, reorder workflow statuses
│   │   └── queries/                     # Data fetching functions (for Server Components)
│   │       ├── workspace.ts             # Get workspace, list workspaces for user
│   │       ├── project.ts               # Get project, list projects, get board data
│   │       ├── issue.ts                 # Get issue detail, list issues, search issues
│   │       ├── member.ts                # List members, check permissions
│   │       ├── activity.ts              # Get issue activities
│   │       └── label.ts                 # List labels for workspace
│   │
│   ├── types/                           # TypeScript types (not generated by Prisma)
│   │   ├── index.ts                     # Re-exports
│   │   ├── auth.ts                      # Extended session types, JWT payload
│   │   ├── board.ts                     # Board view types (ColumnWithIssues, DragData)
│   │   └── api.ts                       # API response wrappers, error types
│   │
│   ├── middleware.ts                     # Next.js middleware (auth route protection)
│   └── env.ts                           # Type-safe environment variable validation (zod)
│
├── eslint.config.mjs                    # ESLint flat config
├── postcss.config.mjs                   # PostCSS (Tailwind v4)
├── tailwind.config.ts                   # Tailwind configuration (theme, colors)
├── tsconfig.json                        # TypeScript config (strict, path aliases)
├── next.config.ts                       # Next.js config
├── components.json                      # shadcn/ui configuration
├── package.json                         # Dependencies and scripts
└── .env.local                           # Environment variables (not committed)
```

### Directory Responsibility Matrix

| Directory | Responsibility | Rendering |
|-----------|---------------|-----------|
| `src/app/` | Routing, layouts, pages | Server Components (default) |
| `src/components/ui/` | shadcn/ui primitives | Mixed (as needed) |
| `src/components/layout/` | App shell (sidebar, header) | Client Components (interactive) |
| `src/components/boards/` | Kanban board UI | Client Components (DnD) |
| `src/components/issues/` | Issue CRUD UI | Mixed |
| `src/components/issues-table/` | List view with TanStack Table | Client Components |
| `src/server/actions/` | Mutations (write operations) | Server only |
| `src/server/queries/` | Data fetching (read operations) | Server only |
| `src/hooks/` | Reusable client-side logic | Client only |
| `src/stores/` | Zustand UI state | Client only |
| `src/lib/validations/` | Zod schemas | Shared (client + server) |
| `src/types/` | TypeScript types | Shared |

---

## 2. Data Models (Prisma Schema)

### Entity Relationship Overview

```
User ──< WorkspaceMember >── Workspace
                                │
                    ┌───────────┼───────────────┐
                    │           │               │
                 Project     Label    WorkspaceInvitation
                    │
        ┌───────────┼───────────┐
        │           │           │
  WorkflowStatus  Sprint      Issue
        │                   /  │  \
        └──────────────────┘   │   └── Label (M:M)
                               │
                    ┌──────────┼──────────┐
                    │          │          │
                 Comment   Activity   IssueLink
```

### Complete Prisma Schema

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

enum Role {
  OWNER
  ADMIN
  MEMBER
  VIEWER
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

enum InvitationStatus {
  PENDING
  ACCEPTED
  EXPIRED
  REVOKED
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

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
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

enum StatusCategory {
  BACKLOG
  TODO
  IN_PROGRESS
  DONE
  CANCELLED
}

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

model Issue {
  id              String    @id @default(cuid())
  key             String    @unique   // Human-readable: "PROJ-123"
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

  // Sprint (Phase 2 — schema ready now)
  sprintId String?
  sprint   Sprint? @relation(fields: [sprintId], references: [id], onDelete: SetNull)

  // Hierarchy (Phase 2 — schema ready now)
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
// ISSUE LINKS (Phase 2 — schema now for forward compatibility)
// =====================================================================

enum LinkType {
  BLOCKS
  IS_BLOCKED_BY
  RELATES_TO
  DUPLICATES
  IS_DUPLICATED_BY
}

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
// SPRINT (Phase 2 — schema now for forward compatibility)
// =====================================================================

enum SprintStatus {
  PLANNED
  ACTIVE
  COMPLETED
}

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
  id        String @id @default(cuid())
  type      String // "ISSUE_CREATED", "STATUS_CHANGED", "ASSIGNED", "PRIORITY_CHANGED", etc.
  issueId   String?
  issue     Issue? @relation(fields: [issueId], references: [id], onDelete: SetNull)
  projectId String
  actorId   String
  actor     User   @relation("ActivityActor", fields: [actorId], references: [id])
  metadata  Json   // { field: "status", from: "TODO", to: "IN_PROGRESS" }

  createdAt DateTime @default(now())

  @@index([issueId, createdAt])
  @@index([projectId, createdAt])
  @@index([actorId])
}
```

### Key Schema Design Decisions

| Decision | Rationale |
|----------|-----------|
| `cuid()` for all IDs | URL-safe, collision-resistant, sortable by creation time |
| Fractional indexing (`position` String) | Avoids reindexing entire column on card move; uses `fractional-indexing` npm package |
| `WorkflowStatus` per project | Each project can customize its Kanban columns; `StatusCategory` enum groups them logically |
| `descriptionText` + `bodyText` mirror fields | Plain text for PostgreSQL search without parsing JSON/rich text at query time |
| `deletedAt` for soft deletes on Issue/Project | Allows undo/grace period; excluded from queries via Prisma middleware |
| Labels at workspace scope | Labels shared across all projects (consistent categorization) |
| Sprint + IssueLink in schema now | Forward-compatible for Phase 2; foreign keys are nullable, no overhead |
| `ProjectFavorite` join table | Per-user starred projects; composite PK avoids duplicates |
| `issueCounter` on Project | Atomic increment via `$transaction` for race-safe issue key generation |
| Append-only `Activity` table | Never updated or deleted; immutable audit log with JSON metadata |

### Default Workflow Statuses (Seed Data)

Every new project is seeded with these default statuses:

| Position | Name | Category | Color |
|----------|------|----------|-------|
| 0 | Backlog | BACKLOG | #6B7280 |
| 1 | Todo | TODO | #3B82F6 |
| 2 | In Progress | IN_PROGRESS | #F59E0B |
| 3 | In Review | IN_PROGRESS | #8B5CF6 |
| 4 | Done | DONE | #10B981 |
| 5 | Cancelled | CANCELLED | #EF4444 |

---

## 3. API Design

### Philosophy

- **Server Actions for all mutations** (create, update, delete operations)
- **Server Component data fetching** via `src/server/queries/` (no REST endpoints for reads)
- **API routes only when necessary**: NextAuth handler, file upload, global search (GET endpoint for Cmd+K)
- **Zod validation at every Server Action boundary**

### Server Actions (Mutations)

All Server Actions follow this pattern:

```
1. Authenticate (get session)
2. Validate input (Zod schema)
3. Authorize (check workspace membership + role)
4. Execute mutation (Prisma transaction if multi-step)
5. Log activity (append to Activity table)
6. Revalidate cache (revalidatePath or revalidateTag)
7. Return result
```

#### Auth Actions (`src/server/actions/auth.ts`)

| Action | Input | Role Required | Notes |
|--------|-------|---------------|-------|
| `signUp` | email, password, name | None (public) | Creates User, hashes password with bcryptjs |
| `signIn` | email, password | None (public) | Validates via NextAuth Credentials provider |

#### Workspace Actions (`src/server/actions/workspace.ts`)

| Action | Input | Role Required | Notes |
|--------|-------|---------------|-------|
| `createWorkspace` | name, slug, description? | Authenticated | Creator becomes OWNER |
| `updateWorkspace` | id, name?, slug?, description?, image? | ADMIN | Validates slug uniqueness |
| `inviteMember` | workspaceId, email, role | ADMIN | Creates WorkspaceInvitation, generates token |
| `acceptInvite` | token | Authenticated | Validates token, creates WorkspaceMember |
| `changeMemberRole` | workspaceId, userId, newRole | ADMIN | Cannot change OWNER role (only transfer) |
| `removeMember` | workspaceId, userId | ADMIN | Unassigns from all issues in workspace |

#### Project Actions (`src/server/actions/project.ts`)

| Action | Input | Role Required | Notes |
|--------|-------|---------------|-------|
| `createProject` | name, prefix, description?, icon?, color?, workspaceId | ADMIN | Validates prefix uniqueness, seeds default statuses |
| `updateProject` | id, name?, description?, icon?, color?, leadId? | ADMIN | Prefix not editable after creation |
| `toggleProjectFavorite` | projectId | MEMBER | Toggle starred status per user |

#### Issue Actions (`src/server/actions/issue.ts`)

| Action | Input | Role Required | Notes |
|--------|-------|---------------|-------|
| `createIssue` | title, type, priority, statusId, projectId, assigneeId?, description?, labels?, dueDate? | MEMBER | Atomic issueCounter increment in transaction |
| `updateIssue` | id, title?, description?, type?, priority?, statusId?, assigneeId?, dueDate?, labels? | MEMBER | Optimistic locking via `updatedAt` check; logs activity for each changed field |
| `moveIssue` | id, statusId, position | MEMBER | For drag-and-drop; updates status + position |
| `reorderIssue` | id, position | MEMBER | For within-column reorder; updates position only |
| `deleteIssue` | id | MEMBER (own) / ADMIN | Soft delete (sets `deletedAt`) |

#### Comment Actions (`src/server/actions/comment.ts`)

| Action | Input | Role Required | Notes |
|--------|-------|---------------|-------|
| `createComment` | issueId, body (Tiptap JSON) | VIEWER+ | Extracts bodyText for search; logs activity |
| `updateComment` | id, body | Author only | Only comment author can edit |
| `deleteComment` | id | Author / ADMIN | Soft or hard delete |

#### Label Actions (`src/server/actions/label.ts`)

| Action | Input | Role Required | Notes |
|--------|-------|---------------|-------|
| `createLabel` | workspaceId, name, color | ADMIN | Validates name uniqueness in workspace |
| `updateLabel` | id, name?, color? | ADMIN | |
| `deleteLabel` | id | ADMIN | Removes label from all issues |

#### Status Actions (`src/server/actions/status.ts`)

| Action | Input | Role Required | Notes |
|--------|-------|---------------|-------|
| `createStatus` | projectId, name, category, color | ADMIN | Appends to end of position list |
| `updateStatus` | id, name?, color?, category? | ADMIN | |
| `reorderStatuses` | projectId, statusIds[] | ADMIN | Bulk update positions |
| `deleteStatus` | id, migrateToStatusId | ADMIN | Must migrate existing issues to another status first |

### Server Queries (Data Fetching)

Called directly in Server Components; no API routes needed.

#### Workspace Queries (`src/server/queries/workspace.ts`)

| Function | Returns | Notes |
|----------|---------|-------|
| `getWorkspacesForUser(userId)` | Workspace[] with member count | For workspace switcher |
| `getWorkspaceBySlug(slug, userId)` | Workspace with membership | Validates access |
| `getWorkspaceMembers(workspaceId)` | WorkspaceMember[] with user details | For member management page |
| `getPendingInvitations(workspaceId)` | WorkspaceInvitation[] | For invite management |

#### Project Queries (`src/server/queries/project.ts`)

| Function | Returns | Notes |
|----------|---------|-------|
| `getProjectsForWorkspace(workspaceId, userId)` | Project[] with issue counts | Sidebar + project list |
| `getProjectByKey(workspaceId, prefix)` | Project with statuses | Project context |
| `getBoardData(projectId, filters?)` | WorkflowStatus[] with paginated issues | Kanban board; 50 issues/column max |
| `getFavoriteProjects(userId, workspaceId)` | Project[] | Sidebar favorites |

#### Issue Queries (`src/server/queries/issue.ts`)

| Function | Returns | Notes |
|----------|---------|-------|
| `getIssueByKey(key)` | Issue with all relations | Full issue detail page |
| `getIssuesList(projectId, filters, pagination)` | Issue[] with cursor + total | List view with TanStack Table |
| `searchIssues(workspaceId, query, limit)` | Issue[] (key, title, project, status) | Cmd+K search; Prisma `contains` for MVP |

#### Activity Queries (`src/server/queries/activity.ts`)

| Function | Returns | Notes |
|----------|---------|-------|
| `getIssueActivities(issueId, cursor?)` | Activity[] with actor | Issue detail activity tab |

#### Label Queries (`src/server/queries/label.ts`)

| Function | Returns | Notes |
|----------|---------|-------|
| `getWorkspaceLabels(workspaceId)` | Label[] | For label pickers across the app |

### API Routes (Only Where Required)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/auth/[...nextauth]` | GET, POST | NextAuth.js handler (OAuth callbacks, CSRF) |
| `/api/search` | GET | Global search endpoint for Cmd+K (returns JSON, used by client-side cmdk) |

### Zod Validation Schemas

All schemas live in `src/lib/validations/` and are shared between client forms and server actions.

```typescript
// src/lib/validations/issue.ts
import { z } from 'zod';

export const createIssueSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title too long'),
  description: z.any().optional(),              // Tiptap JSON
  type: z.enum(['EPIC', 'STORY', 'TASK', 'BUG']),
  priority: z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE']),
  projectId: z.string().cuid(),
  statusId: z.string().cuid(),
  assigneeId: z.string().cuid().nullable().optional(),
  labelIds: z.array(z.string().cuid()).optional(),
  dueDate: z.coerce.date().nullable().optional(),
});

export const updateIssueSchema = z.object({
  id: z.string().cuid(),
  title: z.string().min(1).max(255).optional(),
  description: z.any().optional(),
  type: z.enum(['EPIC', 'STORY', 'TASK', 'BUG']).optional(),
  priority: z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE']).optional(),
  statusId: z.string().cuid().optional(),
  assigneeId: z.string().cuid().nullable().optional(),
  labelIds: z.array(z.string().cuid()).optional(),
  dueDate: z.coerce.date().nullable().optional(),
  updatedAt: z.coerce.date(),                   // Optimistic locking
});

export const moveIssueSchema = z.object({
  id: z.string().cuid(),
  statusId: z.string().cuid(),
  position: z.string(),                          // Fractional index string
});

export const issueFilterSchema = z.object({
  status: z.array(z.string()).optional(),
  assigneeId: z.array(z.string()).optional(),
  priority: z.array(z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE'])).optional(),
  type: z.array(z.enum(['EPIC', 'STORY', 'TASK', 'BUG'])).optional(),
  labelIds: z.array(z.string()).optional(),
  search: z.string().optional(),
});

// src/lib/validations/workspace.ts
export const createWorkspaceSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(50),
  slug: z.string()
    .min(2)
    .max(30)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(500).optional(),
});

// src/lib/validations/project.ts
export const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  prefix: z.string()
    .min(2, 'Key must be 2-10 characters')
    .max(10)
    .regex(/^[A-Z]+$/, 'Key must be uppercase letters only'),
  description: z.string().max(1000).optional(),
  icon: z.string().max(4).optional(),           // Emoji
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  workspaceId: z.string().cuid(),
  leadId: z.string().cuid().nullable().optional(),
});

// src/lib/validations/auth.ts
export const signUpSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

// src/lib/validations/comment.ts
export const createCommentSchema = z.object({
  issueId: z.string().cuid(),
  body: z.any(),                                 // Tiptap JSON
});

// src/lib/validations/member.ts
export const inviteMemberSchema = z.object({
  workspaceId: z.string().cuid(),
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']),  // Cannot invite as OWNER
});
```

---

## 4. State Management

### Three-Layer Strategy

```
┌─────────────────────────────────────────────────┐
│  URL State (nuqs)                               │
│  Filters, pagination, active view               │
│  Shareable, bookmark-able, SSR-compatible        │
├─────────────────────────────────────────────────┤
│  Server State (React Server Components +        │
│  TanStack Query for client-side cache)          │
│  Issues, projects, members, board data           │
│  Revalidation via Server Actions                 │
├─────────────────────────────────────────────────┤
│  UI State (Zustand)                             │
│  Sidebar collapsed, modal open, theme            │
│  Ephemeral, not persisted to server              │
└─────────────────────────────────────────────────┘
```

### Layer 1: Server State

**Primary pattern:** Server Components fetch data via `src/server/queries/` using Prisma directly. Data flows as props to Client Components.

**When TanStack Query is needed:** For client-side interactivity that requires:
- Optimistic updates (board drag-and-drop)
- Background refetching (board polling every 30s)
- Mutations with cache invalidation

```typescript
// src/lib/providers.tsx
'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from 'next-themes';
import { useState } from 'react';

export function Providers({ children, session }: { children: React.ReactNode; session: any }) {
  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 30 * 1000,        // 30 seconds
          refetchOnWindowFocus: true,
        },
      },
    })
  );

  return (
    <SessionProvider session={session}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
```

**Board data uses TanStack Query for optimistic drag-and-drop:**

```typescript
// In board-view.tsx (Client Component)
// Initial data provided by Server Component parent, hydrated into Query cache
const { data: columns } = useQuery({
  queryKey: ['board', projectId, filters],
  queryFn: () => fetchBoardData(projectId, filters),  // API call
  initialData: serverColumns,                          // From Server Component
  refetchInterval: 30_000,                             // Poll every 30s
});

// Mutation with optimistic update
const moveIssueMutation = useMutation({
  mutationFn: moveIssueAction,
  onMutate: async (variables) => {
    await queryClient.cancelQueries({ queryKey: ['board', projectId] });
    const previousColumns = queryClient.getQueryData(['board', projectId, filters]);
    // Optimistically update the board
    queryClient.setQueryData(['board', projectId, filters], (old) => {
      return moveIssueInColumns(old, variables);
    });
    return { previousColumns };
  },
  onError: (err, variables, context) => {
    // Rollback on error
    queryClient.setQueryData(['board', projectId, filters], context?.previousColumns);
    toast.error('Failed to move issue');
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['board', projectId] });
  },
});
```

### Layer 2: URL State (nuqs)

All filter and view state is stored in URL search params using `nuqs`:

```typescript
// Board/list filters encoded in URL:
// /acme/PROJ/board?status=in_progress,in_review&priority=high,urgent&assignee=user123

import { useQueryState, parseAsArrayOf, parseAsString } from 'nuqs';

function useBoardFilters() {
  const [status, setStatus] = useQueryState('status', parseAsArrayOf(parseAsString));
  const [priority, setPriority] = useQueryState('priority', parseAsArrayOf(parseAsString));
  const [assignee, setAssignee] = useQueryState('assignee', parseAsArrayOf(parseAsString));
  const [type, setType] = useQueryState('type', parseAsArrayOf(parseAsString));
  const [labels, setLabels] = useQueryState('labels', parseAsArrayOf(parseAsString));

  return {
    filters: { status, priority, assignee, type, labels },
    setters: { setStatus, setPriority, setAssignee, setType, setLabels },
    clearAll: () => { /* reset all to null */ },
  };
}
```

### Layer 3: UI State (Zustand)

Ephemeral UI state that does not belong in URL or server:

```typescript
// src/stores/sidebar-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SidebarStore {
  isCollapsed: boolean;
  toggle: () => void;
  setCollapsed: (collapsed: boolean) => void;
}

export const useSidebarStore = create<SidebarStore>()(
  persist(
    (set) => ({
      isCollapsed: false,
      toggle: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
      setCollapsed: (collapsed) => set({ isCollapsed: collapsed }),
    }),
    { name: 'sidebar-state' }
  )
);

// src/stores/command-menu-store.ts
interface CommandMenuStore {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

export const useCommandMenuStore = create<CommandMenuStore>()((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
}));

// src/stores/issue-detail-store.ts
interface IssueDetailStore {
  isOpen: boolean;
  selectedIssueKey: string | null;
  openIssue: (key: string) => void;
  closeIssue: () => void;
}

export const useIssueDetailStore = create<IssueDetailStore>()((set) => ({
  isOpen: false,
  selectedIssueKey: null,
  openIssue: (key) => set({ isOpen: true, selectedIssueKey: key }),
  closeIssue: () => set({ isOpen: false, selectedIssueKey: null }),
}));
```

---

## 5. Authentication & Authorization Flow

### Auth.js v5 Configuration

```
src/lib/auth/config.ts    # NextAuth configuration
src/middleware.ts          # Route protection
src/lib/auth/helpers.ts    # requireAuth(), requireRole() utilities
```

#### Providers

| Provider | Type | Notes |
|----------|------|-------|
| Credentials | email + password | bcryptjs hashed; custom sign-up action |
| Google OAuth | OAuth 2.0 | `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` |
| GitHub OAuth | OAuth 2.0 | `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET` |

#### Session Strategy

- **JWT strategy** (not database sessions) for edge runtime compatibility with middleware
- User ID embedded in JWT token via `jwt` callback
- Extended `session.user.id` via `session` callback
- Token refresh handled by Auth.js automatically

#### Auth Flow Diagram

```
Sign-Up Flow:
  1. User fills sign-up form
  2. Server Action validates input (Zod)
  3. Check email uniqueness
  4. Hash password with bcryptjs (12 rounds)
  5. Create User record
  6. Auto sign-in via NextAuth
  7. Redirect to /create-workspace (first-time flow)

Sign-In Flow:
  1. User fills sign-in form (or clicks OAuth button)
  2. NextAuth handles validation / OAuth redirect
  3. JWT issued with userId
  4. Middleware allows access to (dashboard) routes
  5. Redirect to last workspace or /create-workspace

OAuth Flow:
  1. User clicks "Continue with Google/GitHub"
  2. Redirect to provider's auth page
  3. Callback to /api/auth/callback/[provider]
  4. Auth.js creates/links Account + User
  5. JWT issued, redirect to app
```

#### Middleware Route Protection

```typescript
// src/middleware.ts
import { auth } from '@/lib/auth/config';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  // Public routes
  const isAuthPage = pathname.startsWith('/sign-in') ||
                     pathname.startsWith('/sign-up') ||
                     pathname.startsWith('/forgot-password');
  const isInvitePage = pathname.startsWith('/invite');
  const isPublicRoute = isAuthPage || isInvitePage;

  // Redirect logged-in users away from auth pages
  if (isAuthPage && isLoggedIn) {
    return NextResponse.redirect(new URL('/', req.nextUrl));
  }

  // Protect all non-public routes
  if (!isPublicRoute && !isLoggedIn) {
    const callbackUrl = encodeURIComponent(pathname);
    return NextResponse.redirect(new URL(`/sign-in?callbackUrl=${callbackUrl}`, req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
};
```

#### RBAC Authorization

Authorization is enforced at the Server Action level using helper functions:

```typescript
// src/lib/auth/helpers.ts
import { auth } from './config';
import { prisma } from '@/lib/db/client';
import { Role } from '@prisma/client';

const ROLE_HIERARCHY: Record<Role, number> = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  VIEWER: 1,
};

export async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }
  return session.user;
}

export async function requireWorkspaceMember(workspaceId: string, requiredRole: Role = 'VIEWER') {
  const user = await requireAuth();

  const member = await prisma.workspaceMember.findUnique({
    where: {
      userId_workspaceId: { userId: user.id, workspaceId },
    },
  });

  if (!member) {
    throw new Error('Not a member of this workspace');
  }

  if (ROLE_HIERARCHY[member.role] < ROLE_HIERARCHY[requiredRole]) {
    throw new Error('Insufficient permissions');
  }

  return { user, member };
}
```

#### Authorization Matrix

| Action | OWNER | ADMIN | MEMBER | VIEWER |
|--------|-------|-------|--------|--------|
| Manage workspace settings | Yes | Yes | No | No |
| Manage members/invites | Yes | Yes | No | No |
| Create/delete projects | Yes | Yes | No | No |
| Edit project settings | Yes | Yes | Lead only | No |
| Create/edit issues | Yes | Yes | Yes | No |
| Delete issues | Yes | Yes | Own only | No |
| View issues/boards | Yes | Yes | Yes | Yes |
| Comment on issues | Yes | Yes | Yes | Yes |
| Manage labels | Yes | Yes | No | No |
| Manage workflow statuses | Yes | Yes | No | No |

---

## 6. Component Architecture

### Rendering Strategy

```
Server Component (default)
  ├── Fetches data via src/server/queries/
  ├── Passes data as props to Client Components
  └── No JavaScript shipped to client

Client Component ('use client')
  ├── Interactive UI (forms, drag-and-drop, modals)
  ├── Uses hooks, event handlers, browser APIs
  └── Leaf nodes in the component tree (pushed down)
```

### Component Hierarchy for Key Pages

#### Kanban Board Page

```
[Server] /[workspaceSlug]/[projectKey]/board/page.tsx
  │  Fetches: board data (statuses + issues), project context
  │
  └── [Server] BoardHeader
  │     └── [Client] ViewSwitcher (board/list toggle)
  │     └── [Client] BoardFilters (assignee, priority, label, type dropdowns)
  │
  └── [Client] BoardView (DndContext provider)
        │  Receives: initialColumns, project, members
        │  Uses: TanStack Query (optimistic updates), @dnd-kit
        │
        ├── BoardColumn (per status)
        │   ├── ColumnHeader (name, count badge)
        │   ├── SortableContext (within column)
        │   │   └── BoardCard[] (draggable issue cards)
        │   │       ├── IssueTypeIcon
        │   │       ├── IssuePriorityIcon
        │   │       ├── LabelBadge[]
        │   │       └── Avatar (assignee)
        │   └── QuickCreateIssue (inline at bottom)
        │
        └── DragOverlay
            └── DragOverlayCard (floating card while dragging)
```

#### Issue Detail Page

```
[Server] /[workspaceSlug]/[projectKey]/issues/[issueKey]/page.tsx
  │  Fetches: full issue with relations, comments, activities
  │
  └── [Client] IssueDetail
        │  Uses: react-hook-form, TanStack Query mutations
        │
        ├── IssueHeader
        │   ├── IssueTypeIcon + Key ("PROJ-123")
        │   └── IssuePriorityIcon
        │
        ├── IssueTitle (inline editable, debounced save)
        │
        ├── IssueDetailSidebar (right side)
        │   ├── StatusSelect
        │   ├── AssigneeSelect
        │   ├── PrioritySelect
        │   ├── LabelSelect (multi)
        │   ├── DueDatePicker
        │   └── Metadata (created, updated, reporter)
        │
        ├── IssueDescription (Tiptap editor)
        │   └── TiptapEditor (debounced auto-save)
        │
        └── Tabs: Comments | Activity
            ├── IssueComments
            │   ├── CommentItem[] (body, author, timestamp)
            │   └── NewCommentForm (Tiptap editor)
            └── IssueActivity
                └── ActivityItem[] (icon, description, timestamp)
```

#### List View Page

```
[Server] /[workspaceSlug]/[projectKey]/list/page.tsx
  │  Fetches: paginated issues with filters
  │
  └── [Client] IssuesDataTable
        │  Uses: @tanstack/react-table, nuqs (URL filters)
        │
        ├── DataTableToolbar
        │   ├── SearchInput
        │   ├── FacetedFilter (status)
        │   ├── FacetedFilter (priority)
        │   ├── FacetedFilter (assignee)
        │   └── ViewOptions (column visibility)
        │
        ├── Table (shadcn/ui)
        │   └── TableRow[] (click -> navigate to issue detail)
        │
        └── DataTablePagination (cursor-based)
```

#### App Shell Layout

```
[Server] (dashboard)/layout.tsx
  │
  └── [Client] Providers (Session, QueryClient, Theme)
        │
        ├── [Client] AppSidebar
        │   ├── WorkspaceSwitcher (dropdown)
        │   ├── Navigation (dashboard, projects, settings)
        │   ├── ProjectList (starred first, then all)
        │   │   └── ProjectItem (icon, name, star button)
        │   └── SidebarFooter (collapse toggle)
        │
        ├── MainContent
        │   ├── [Client] Header
        │   │   ├── Breadcrumbs
        │   │   ├── SearchTrigger (opens Cmd+K)
        │   │   ├── ThemeToggle
        │   │   └── UserMenu (avatar, dropdown)
        │   │
        │   └── {children} (page content)
        │
        └── [Client] CommandMenu (Cmd+K, global search)
```

### Component Design Patterns

| Pattern | Usage | Example |
|---------|-------|---------|
| **Compound Components** | Complex UI with shared state | `Board > Column > Card` (share DnD context) |
| **Render Props / Slots** | Flexible composition | `DataTable` accepts column definitions |
| **Controlled + Server Action** | Forms | `react-hook-form` + Zod + Server Action on submit |
| **Optimistic UI** | Mutations needing instant feedback | Board drag-and-drop, status toggle |
| **Skeleton Loading** | Progressive loading states | `BoardCardSkeleton`, `Skeleton` from shadcn |
| **Error Boundary** | Graceful error handling | Wrap each page section |
| **Empty State** | Zero-data states | Custom illustrations + CTA per context |

---

## 7. Routing & URL Design

### URL Structure

```
/                                         -> Redirect to first workspace or /sign-in
/sign-in                                  -> Sign in page
/sign-up                                  -> Sign up page
/forgot-password                          -> Forgot password
/invite/[token]                           -> Accept workspace invitation

/create-workspace                         -> New workspace (post-signup onboarding)

/[workspaceSlug]                          -> Redirect to /[workspaceSlug]/projects
/[workspaceSlug]/projects                 -> Project list
/[workspaceSlug]/projects/new             -> Create new project
/[workspaceSlug]/settings                 -> Workspace general settings
/[workspaceSlug]/settings/members         -> Member management

/[workspaceSlug]/[projectKey]             -> Redirect to board view
/[workspaceSlug]/[projectKey]/board       -> Kanban board
/[workspaceSlug]/[projectKey]/list        -> List/table view
/[workspaceSlug]/[projectKey]/issues/[issueKey] -> Issue detail (full page)
/[workspaceSlug]/[projectKey]/settings    -> Project settings
```

### URL Parameters (Filters via nuqs)

```
/acme/PROJ/board?status=in_progress,in_review&priority=high&assignee=user123
/acme/PROJ/list?sort=priority&order=desc&page=2&search=login
```

### Route Groups

| Group | Layout | Purpose |
|-------|--------|---------|
| `(auth)` | Centered card | Unauthenticated pages (sign-in, sign-up) |
| `(dashboard)` | App shell (sidebar + header) | All authenticated pages |

### Dynamic Route Segments

| Segment | Source | Validation |
|---------|--------|------------|
| `[workspaceSlug]` | `Workspace.slug` | Lookup in layout; 404 if not found or no access |
| `[projectKey]` | `Project.prefix` | Lookup in layout; 404 if not found |
| `[issueKey]` | `Issue.key` (e.g., "PROJ-123") | Lookup in page; 404 if not found |
| `[token]` | `WorkspaceInvitation.token` | Lookup in page; show expired/invalid message |

---

## 8. Performance & Caching Strategy

### Data Fetching Patterns

| Scenario | Pattern | Cache |
|----------|---------|-------|
| Page load (board, list, detail) | Server Component + Prisma query | Next.js full-route cache |
| Board interaction (drag/drop) | TanStack Query mutation + optimistic | Client query cache (30s stale) |
| Search (Cmd+K) | Client-side fetch to `/api/search` | TanStack Query (5s stale) |
| Filters change | URL state (nuqs) triggers refetch | Server Component re-render |
| After mutation | `revalidatePath()` or `revalidateTag()` | Invalidates Next.js cache |

### Database Performance

| Optimization | Implementation |
|-------------|----------------|
| Composite indexes | `(projectId, statusId, position)` for board queries |
| Eager loading | `include`/`select` in Prisma to prevent N+1 |
| Cursor-based pagination | For list view and comment threads |
| Column pagination | 50 issues max per board column (load more button) |
| Minimal card select | Board cards only fetch: id, key, title, type, priority, position, assignee (name, image), labels (name, color) |
| Connection pooling | PgBouncer or Prisma Accelerate in production |

### Client Performance

| Optimization | Implementation |
|-------------|----------------|
| Server Components default | Zero JS for static content |
| Dynamic imports | Lazy-load Tiptap editor, Recharts (Phase 2) |
| Image optimization | Next.js `<Image>` for avatars |
| Debounced saves | 500ms debounce for description auto-save |
| Bundle splitting | Per-route code splitting (App Router default) |
| Prefetching | `<Link prefetch>` for project navigation |
| Streaming + Suspense | Board shell renders immediately, columns stream in |

### Caching Layers

```
Layer 1: Next.js Full-Route Cache
  - Server Component pages cached at build/request time
  - Invalidated via revalidatePath() after mutations

Layer 2: Next.js Data Cache (fetch cache)
  - Not used (Prisma queries, not fetch())

Layer 3: TanStack Query (Client)
  - Board data: staleTime 30s, refetchInterval 30s
  - Search results: staleTime 5s
  - Issue detail: staleTime 60s
  - Invalidated on mutation success

Layer 4: Browser
  - Static assets cached via Next.js default headers
  - No manual cache-control needed for MVP
```

---

## 9. Key Libraries & Dependencies

### Production Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 15.x | Framework (App Router, Server Actions) |
| `react` / `react-dom` | 19.x | UI library |
| `typescript` | 5.x | Type safety |
| `prisma` / `@prisma/client` | 6.x | ORM + database client |
| `next-auth` | 5.x (Auth.js) | Authentication (OAuth + credentials) |
| `@auth/prisma-adapter` | latest | Prisma adapter for Auth.js |
| `bcryptjs` | latest | Password hashing |
| `tailwindcss` | 4.x | Styling (PostCSS-based) |
| `@radix-ui/react-*` | latest | Accessible UI primitives (via shadcn) |
| `class-variance-authority` | latest | Variant styling (shadcn) |
| `tailwind-merge` | latest | Class deduplication |
| `clsx` | latest | Conditional classes |
| `lucide-react` | latest | Icons |
| `@dnd-kit/core` | latest | Drag-and-drop foundation |
| `@dnd-kit/sortable` | latest | Sortable lists (Kanban) |
| `@dnd-kit/utilities` | latest | DnD CSS transform helpers |
| `@tanstack/react-query` | 5.x | Client-side server state cache |
| `@tanstack/react-table` | 8.x | Headless data table |
| `zustand` | 5.x | Client-side UI state |
| `nuqs` | latest | URL search param state |
| `zod` | 3.x | Schema validation |
| `react-hook-form` | 7.x | Form management |
| `@hookform/resolvers` | latest | Zod + RHF bridge |
| `@tiptap/react` | latest | Rich text editor |
| `@tiptap/starter-kit` | latest | Basic Tiptap extensions |
| `@tiptap/extension-task-list` | latest | Task list checkboxes |
| `@tiptap/extension-task-item` | latest | Task item |
| `@tiptap/extension-link` | latest | Auto-link URLs |
| `@tiptap/extension-placeholder` | latest | Placeholder text |
| `fractional-indexing` | latest | Position ordering for cards |
| `date-fns` | latest | Date utilities |
| `sonner` | latest | Toast notifications |
| `cmdk` | latest | Command palette (via shadcn) |
| `next-themes` | latest | Dark/light mode |

### Development Dependencies

| Package | Purpose |
|---------|---------|
| `eslint` + `eslint-config-next` | Linting |
| `prettier` + `prettier-plugin-tailwindcss` | Formatting with Tailwind class sorting |
| `@types/node` / `@types/react` | TypeScript definitions |
| `prisma` (CLI) | Database migrations |

### Package Scripts

```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit",
    "db:push": "prisma db push",
    "db:migrate": "prisma migrate dev",
    "db:studio": "prisma studio",
    "db:seed": "tsx prisma/seed.ts",
    "db:reset": "prisma migrate reset"
  }
}
```

---

## 10. Database Indexing Strategy

### Indexes by Query Pattern

| Query Pattern | Index | Used By |
|---------------|-------|---------|
| Board: issues by status in order | `(projectId, statusId, position)` | Board view |
| List: issues by assignee | `(projectId, assigneeId)` | List view filter |
| Sprint board: issues in sprint | `(projectId, sprintId)` | Sprint board (Phase 2) |
| Issue detail: by key | `UNIQUE(key)` | Issue detail page |
| Sub-tasks: children of parent | `(parentId)` | Sub-task list (Phase 2) |
| Activity log: per issue | `(issueId, createdAt)` | Issue activity tab |
| Activity log: per project | `(projectId, createdAt)` | Project activity feed |
| Comments: per issue | `(issueId, createdAt)` | Issue comments section |
| Projects in workspace | `(workspaceId)` | Sidebar, project list |
| Workflow statuses in order | `(projectId, position)` | Board columns |
| Sprint by status | `(projectId, status)` | Active sprint lookup |
| Workspace slug lookup | `UNIQUE(slug)` | URL routing |
| Project key in workspace | `UNIQUE(workspaceId, prefix)` | Issue key generation |
| Label in workspace | `UNIQUE(workspaceId, name)` | Label uniqueness |
| Member lookup | `(userId, workspaceId)` composite PK | Authorization checks |
| Invitation lookup | `UNIQUE(token)` + `(email, workspaceId)` | Invite acceptance |

### Unique Constraints Summary

| Constraint | Purpose |
|-----------|---------|
| `User.email` | One account per email |
| `Workspace.slug` | Globally unique workspace URLs |
| `Project(workspaceId, prefix)` | Unique project keys per workspace |
| `Issue.key` | Globally unique issue keys (PROJ-123) |
| `WorkflowStatus(projectId, name)` | No duplicate status names per project |
| `Label(workspaceId, name)` | No duplicate label names per workspace |
| `WorkspaceMember(userId, workspaceId)` | One membership per user per workspace |
| `ProjectFavorite(userId, projectId)` | One favorite per user per project |
| `IssueLink(fromId, toId, type)` | No duplicate links |
| `WorkspaceInvitation.token` | Unique invite tokens |
| `Account(provider, providerAccountId)` | One OAuth link per provider account |

---

## Architecture Summary

This architecture delivers a production-grade JIRA-like application with:

- **Multi-tenant isolation** via workspace-scoped routing and data access
- **Type-safe end-to-end** stack from Prisma schema to Zod validation to TypeScript components
- **Server-first rendering** with Client Components only at interaction boundaries
- **Optimistic drag-and-drop** using TanStack Query + @dnd-kit with fractional indexing
- **RBAC at every mutation** via Server Action authorization guards
- **Forward-compatible schema** with Sprint and IssueLink tables ready for Phase 2
- **Performant queries** via composite indexes aligned to actual query patterns
- **Shareable state** through URL-encoded filters using nuqs
