# Implementation Strategy: PMApp MVP (Phase 1)

**Project:** JIRA-like Project Management App
**Stack:** Next.js 15 + TypeScript + PostgreSQL + Prisma + Tailwind CSS + shadcn/ui + NextAuth.js
**Date:** 2026-03-26
**Author:** Strategist (Forge Pipeline)

---

## Table of Contents

1. [Implementation Order](#1-implementation-order)
2. [Component Breakdown](#2-component-breakdown)
3. [Integration Strategy](#3-integration-strategy)
4. [Risk Register](#4-risk-register)
5. [Rollback & Safety Strategy](#5-rollback--safety-strategy)
6. [Milestone Plan](#6-milestone-plan)

---

## 1. Implementation Order

The build follows a strict **foundation-up** dependency chain. Each layer unlocks the next.

```
Layer 0: Project Scaffolding + Tooling
    |
Layer 1: Database Schema + Prisma Setup
    |
Layer 2: Authentication + Session Management
    |
Layer 3: Workspace + Project CRUD + Navigation Shell
    |
Layer 4: Issue CRUD + Server Actions + Validation
    |
Layer 5: Board Views (Kanban + List)
    |
Layer 6: Search, Filters, and Polish
```

### Dependency Graph

```
[Scaffolding] ─────────────────────────────────────────────────────────►
       │
       ▼
[Prisma Schema] ───────────────────────────────────────────────────────►
       │
       ├──► [Auth System] ─────────────────────────────────────────────►
       │         │
       │         ├──► [Workspace CRUD] ────────────────────────────────►
       │         │         │
       │         │         ├──► [Project CRUD] ────────────────────────►
       │         │         │         │
       │         │         │         ├──► [Issue CRUD] ────────────────►
       │         │         │         │         │
       │         │         │         │         ├──► [Kanban Board] ────►
       │         │         │         │         │         │
       │         │         │         │         │         ├──► [DnD] ──►
       │         │         │         │         │
       │         │         │         │         ├──► [List View] ───────►
       │         │         │         │         │
       │         │         │         │         ├──► [Comments] ────────►
       │         │         │         │         │
       │         │         │         │         └──► [Activity Log] ───►
       │         │         │
       │         │         └──► [Member Management] ──────────────────►
       │         │
       │         └──► [App Shell / Sidebar / Layout] ─────────────────►
       │
       └──► [Labels] ─────────────────────────────────────────────────►
                                                       │
                                                       └──► [Search] ─►
```

---

## 2. Component Breakdown

### Layer 0: Project Scaffolding + Tooling

| # | Component | Priority | Dependencies | Complexity | Risk | Est. Time |
|---|-----------|----------|--------------|------------|------|-----------|
| 0.1 | Next.js 15 project init (`create-next-app`) | 1 | None | S | Low | 15 min |
| 0.2 | TypeScript strict config + path aliases | 1 | 0.1 | S | Low | 10 min |
| 0.3 | Tailwind CSS v4 + PostCSS setup | 1 | 0.1 | S | Low | 10 min |
| 0.4 | shadcn/ui init + base components (Button, Input, Dialog, DropdownMenu, Select, Popover, Command, Avatar, Badge, Tooltip, Card, Table, Tabs, Separator, ScrollArea, Sheet, Skeleton, Form, Label, Textarea, Sonner) | 1 | 0.3 | S | Low | 20 min |
| 0.5 | ESLint 9 flat config + Prettier w/ Tailwind plugin | 1 | 0.1 | S | Low | 15 min |
| 0.6 | Environment variable setup (`src/env.ts` with Zod validation) | 1 | 0.1 | S | Low | 10 min |
| 0.7 | Install core dependencies (see Section 2.1) | 1 | 0.1 | S | Low | 5 min |

**Core Dependencies to Install:**
```
# Core
prisma @prisma/client next-auth@5 @auth/prisma-adapter

# UI
@dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
@tiptap/react @tiptap/starter-kit @tiptap/extension-task-list @tiptap/extension-task-item @tiptap/extension-link @tiptap/extension-placeholder
@tanstack/react-table @tanstack/react-query

# Forms + Validation
react-hook-form zod @hookform/resolvers

# Utilities
date-fns fractional-indexing sonner nuqs bcryptjs
@paralleldrive/cuid2

# Dev
@types/bcryptjs prisma-dbml-generator
```

**Layer 0 Total: ~1.5 hours**

---

### Layer 1: Database Schema + Prisma Setup

| # | Component | Priority | Dependencies | Complexity | Risk | Est. Time |
|---|-----------|----------|--------------|------------|------|-----------|
| 1.1 | Prisma init + PostgreSQL connection | 2 | 0.6 | S | Low | 15 min |
| 1.2 | Auth models (User, Account, Session) | 2 | 1.1 | S | Low | 20 min |
| 1.3 | Workspace + WorkspaceMember + WorkspaceInvitation models | 2 | 1.2 | M | Low | 30 min |
| 1.4 | Project + WorkflowStatus models | 2 | 1.3 | M | Low | 30 min |
| 1.5 | Issue model (all fields, enums, relations) | 2 | 1.4 | M | Medium | 45 min |
| 1.6 | Label model (workspace-scoped, many-to-many with Issue) | 2 | 1.5 | S | Low | 15 min |
| 1.7 | Comment + Activity models | 2 | 1.5 | S | Low | 20 min |
| 1.8 | Database indexes (composite indexes for query patterns) | 2 | 1.7 | S | Medium | 20 min |
| 1.9 | Prisma client singleton (`src/server/db.ts`) | 2 | 1.1 | S | Low | 10 min |
| 1.10 | Seed script (dev workspace, project, sample issues) | 2 | 1.8 | M | Low | 45 min |
| 1.11 | Run `prisma db push` + validate | 2 | 1.8 | S | Low | 10 min |

**Key Schema Decisions (from research):**
- Use `cuid()` for all IDs
- `position` as String field (fractional indexing) on Issue
- `issueCounter` Int on Project for atomic key generation
- WorkflowStatus per-project (not global enum) for future customization
- Implicit many-to-many for Issue-Label (Prisma handles join table)
- `description` as Json (Tiptap JSON), `descriptionText` as String (search)
- Activity as append-only log with `metadata` Json field
- Soft deletes deferred to Phase 2 (keep MVP simple)

**MVP Schema Models (10 total):**
1. User, Account, Session (Auth.js required)
2. Workspace, WorkspaceMember, WorkspaceInvitation
3. Project, WorkflowStatus
4. Issue, Label (implicit M2M)
5. Comment, Activity

**Excluded from MVP Schema (Phase 2+):**
- Sprint, IssueLink, Attachment, Notification, SavedFilter

**Layer 1 Total: ~4 hours**

---

### Layer 2: Authentication + Session Management

| # | Component | Priority | Dependencies | Complexity | Risk | Est. Time |
|---|-----------|----------|--------------|------------|------|-----------|
| 2.1 | Auth.js v5 config (`src/lib/auth/config.ts`) with JWT strategy | 3 | 1.2, 1.9 | M | Medium | 1 hr |
| 2.2 | Credentials provider (email/password with bcrypt) | 3 | 2.1 | M | Medium | 45 min |
| 2.3 | OAuth providers (Google + GitHub) | 3 | 2.1 | M | Medium | 45 min |
| 2.4 | Auth API route (`src/app/api/auth/[...nextauth]/route.ts`) | 3 | 2.1 | S | Low | 10 min |
| 2.5 | Middleware for route protection (`src/middleware.ts`) | 3 | 2.1 | M | Medium | 30 min |
| 2.6 | Sign-up page with form validation | 3 | 2.2, 0.4 | M | Low | 1.5 hr |
| 2.7 | Sign-in page (credentials + OAuth buttons) | 3 | 2.2, 2.3, 0.4 | M | Low | 1.5 hr |
| 2.8 | Auth callback handling + session enrichment (user ID in JWT) | 3 | 2.1 | S | Medium | 30 min |
| 2.9 | `SessionProvider` wrapper + `useSession` hook setup | 3 | 2.1 | S | Low | 15 min |
| 2.10 | Auth helper functions (`getCurrentUser`, `requireAuth`) | 3 | 2.1 | S | Low | 20 min |
| 2.11 | Zod schemas for auth inputs (`src/lib/validations/auth.ts`) | 3 | 0.7 | S | Low | 20 min |

**Auth Flow:**
```
Sign Up -> Create User (hashed password) -> Auto-create Workspace -> Redirect to Workspace
Sign In -> Validate credentials/OAuth -> JWT session -> Redirect to last Workspace
Protected Route -> Middleware checks JWT -> 401 or pass through
Server Action -> auth() call -> verify session -> authorize role -> execute
```

**Key Decisions:**
- JWT strategy (stateless, edge-compatible) over database sessions
- Credentials + Google + GitHub for MVP (3 providers)
- Session includes `user.id` via JWT callback enrichment
- Middleware protects all routes except `/sign-in`, `/sign-up`, `/api/auth/*`, static assets
- Every Server Action independently calls `auth()` -- never trust middleware alone

**Layer 2 Total: ~7 hours**

---

### Layer 3: Workspace + Project CRUD + Navigation Shell

| # | Component | Priority | Dependencies | Complexity | Risk | Est. Time |
|---|-----------|----------|--------------|------------|------|-----------|
| 3.1 | App shell layout (`src/app/(dashboard)/layout.tsx`) | 4 | 2.5, 0.4 | M | Low | 2 hr |
| 3.2 | Sidebar component (workspace switcher, project list, starred projects) | 4 | 3.1 | L | Low | 3 hr |
| 3.3 | Workspace creation page (`/create-workspace`) | 4 | 2.10 | M | Low | 1.5 hr |
| 3.4 | Workspace server actions (create, update) | 4 | 1.9, 2.10 | M | Low | 1 hr |
| 3.5 | Workspace settings page (`/[workspace]/settings`) | 4 | 3.4 | M | Low | 1.5 hr |
| 3.6 | Member management page (`/[workspace]/settings/members`) | 4 | 3.4 | M | Medium | 2 hr |
| 3.7 | Invite member flow (generate invite, send email placeholder, accept invite page) | 4 | 3.6, 1.3 | L | Medium | 3 hr |
| 3.8 | RBAC permission helper (`src/lib/auth/permissions.ts`) | 4 | 1.3, 2.10 | M | Medium | 1.5 hr |
| 3.9 | Project CRUD server actions (create, update) | 5 | 3.4, 1.4 | M | Low | 1.5 hr |
| 3.10 | Project creation page (`/[workspace]/projects/new`) | 5 | 3.9, 0.4 | M | Low | 1.5 hr |
| 3.11 | Project list page (`/[workspace]/projects`) | 5 | 3.9 | M | Low | 1.5 hr |
| 3.12 | Project settings page (`/[workspace]/project/[key]/settings`) | 5 | 3.9 | M | Low | 1.5 hr |
| 3.13 | Default workflow status seeding on project creation | 5 | 1.4 | S | Low | 30 min |
| 3.14 | Star/favorite project toggle (per user) | 5 | 3.9 | S | Low | 30 min |
| 3.15 | Workspace slug validation (unique, URL-safe) | 4 | 3.4 | S | Low | 20 min |
| 3.16 | Project key validation (unique within workspace, 2-10 uppercase) | 5 | 3.9 | S | Low | 20 min |
| 3.17 | Zod schemas for workspace + project inputs | 4 | 0.7 | S | Low | 30 min |
| 3.18 | Dark/light mode toggle (next-themes) | 4 | 3.1 | S | Low | 30 min |
| 3.19 | TanStack Query provider setup (`src/lib/providers.tsx`) | 4 | 0.7 | S | Low | 20 min |
| 3.20 | Post-signup redirect logic (no workspace -> create-workspace) | 4 | 3.3, 2.5 | S | Low | 20 min |

**Default Workflow Statuses (seeded on project creation):**
```
Position 0: Backlog    (category: BACKLOG)     color: #6B7280
Position 1: Todo       (category: TODO)        color: #3B82F6
Position 2: In Progress (category: IN_PROGRESS) color: #F59E0B
Position 3: In Review  (category: IN_PROGRESS)  color: #8B5CF6
Position 4: Done       (category: DONE)         color: #22C55E
Position 5: Cancelled  (category: CANCELLED)    color: #EF4444
```

**Navigation Structure:**
```
+--[ Workspace Switcher ]--+
|  Starred Projects        |
|    * Project Alpha       |
|    * Project Beta        |
|  ─────────────────────── |
|  All Projects            |
|    Project Alpha         |
|    Project Beta          |
|    Project Gamma         |
|  ─────────────────────── |
|  Settings                |
|  Members                 |
+──────────────────────────+
```

**Layer 3 Total: ~23 hours (largest layer)**

---

### Layer 4: Issue CRUD + Server Actions + Validation

| # | Component | Priority | Dependencies | Complexity | Risk | Est. Time |
|---|-----------|----------|--------------|------------|------|-----------|
| 4.1 | Issue server actions (create, update, delete) | 6 | 3.9, 1.5, 2.10, 3.8 | L | Medium | 3 hr |
| 4.2 | Issue key generation (atomic increment in transaction) | 6 | 4.1 | M | High | 1 hr |
| 4.3 | Issue creation modal/page | 6 | 4.1, 0.4 | L | Low | 3 hr |
| 4.4 | Issue detail view (slide-over panel) | 6 | 4.1, 0.4 | L | Medium | 4 hr |
| 4.5 | Inline field editing (status, assignee, priority, labels, due date) | 6 | 4.4 | L | Medium | 4 hr |
| 4.6 | Rich text editor for description (Tiptap) | 6 | 4.4 | L | High | 4 hr |
| 4.7 | Label CRUD (create, assign to issue, remove) | 6 | 1.6, 4.1 | M | Low | 1.5 hr |
| 4.8 | Label picker component (multi-select with color dots) | 6 | 4.7, 0.4 | M | Low | 1 hr |
| 4.9 | Assignee picker component (member avatars dropdown) | 6 | 3.6, 0.4 | M | Low | 1 hr |
| 4.10 | Priority picker component | 6 | 0.4 | S | Low | 30 min |
| 4.11 | Status picker component | 6 | 1.4, 0.4 | S | Low | 30 min |
| 4.12 | Due date picker component | 6 | 0.4 | S | Low | 30 min |
| 4.13 | Issue type selector component | 6 | 0.4 | S | Low | 20 min |
| 4.14 | Comment system (create, list, rich text) | 7 | 4.4, 4.6 | M | Low | 2.5 hr |
| 4.15 | Activity log (auto-generated on field changes) | 7 | 4.1 | M | Medium | 2 hr |
| 4.16 | Activity + Comments tabbed view on issue detail | 7 | 4.14, 4.15 | M | Low | 1.5 hr |
| 4.17 | Zod schemas for all issue inputs | 6 | 0.7 | M | Low | 1 hr |
| 4.18 | Optimistic locking (`updatedAt` check on save, 409 on conflict) | 7 | 4.1 | M | Medium | 1 hr |
| 4.19 | Issue type + priority icons/badges (shared component) | 6 | 0.4 | S | Low | 30 min |

**Issue Creation Server Action Pattern:**
```
1. auth() -> get current user
2. Zod validate input
3. requirePermission(userId, workspaceId, 'MEMBER')
4. Validate assignee is workspace member (if set)
5. Validate statusId belongs to project
6. $transaction: increment project.issueCounter + create issue
7. Create ISSUE_CREATED activity
8. revalidatePath for board + project
9. Return created issue
```

**Activity Log Auto-Generation:**
- Wrap `updateIssue` to compare before/after for each field
- Generate one Activity row per changed field
- Store `{ field, oldValue, newValue }` in metadata JSON
- Events: created, status_changed, assignee_changed, priority_changed, label_added, label_removed, description_edited, due_date_changed, comment_added

**Layer 4 Total: ~32 hours**

---

### Layer 5: Board Views (Kanban + List)

| # | Component | Priority | Dependencies | Complexity | Risk | Est. Time |
|---|-----------|----------|--------------|------------|------|-----------|
| 5.1 | Kanban board page (`/[workspace]/project/[key]`) | 8 | 4.1, 1.4 | L | Medium | 3 hr |
| 5.2 | Board data fetching (server component, statuses + issues per column) | 8 | 5.1 | M | Low | 1.5 hr |
| 5.3 | Board column component (status header, issue count badge) | 8 | 5.1, 0.4 | M | Low | 1.5 hr |
| 5.4 | Issue card component (key, title, assignee avatar, priority icon, type icon, labels) | 8 | 4.19, 0.4 | M | Low | 2 hr |
| 5.5 | @dnd-kit integration: DndContext + SortableContext | 8 | 5.3, 5.4 | L | High | 4 hr |
| 5.6 | Cross-column drag-and-drop (status change) | 8 | 5.5 | L | High | 3 hr |
| 5.7 | Within-column reorder (position change) | 8 | 5.5, 5.6 | L | High | 2 hr |
| 5.8 | DragOverlay (floating card during drag) | 8 | 5.5 | M | Medium | 1 hr |
| 5.9 | Optimistic updates for drag operations (`useOptimistic`) | 8 | 5.6, 5.7 | L | High | 3 hr |
| 5.10 | `moveIssue` server action (update status + position) | 8 | 4.1 | M | Medium | 1 hr |
| 5.11 | Fractional indexing position calculation | 8 | 5.7 | M | Medium | 1 hr |
| 5.12 | Keyboard accessibility for DnD (context menu fallback) | 8 | 5.5 | M | Medium | 1.5 hr |
| 5.13 | Quick-add issue from board column (inline form) | 8 | 5.3, 4.1 | M | Low | 1.5 hr |
| 5.14 | Click card -> open issue detail panel | 8 | 5.4, 4.4 | M | Low | 1 hr |
| 5.15 | Quick filter bar (assignee, priority, label, type) | 9 | 5.1 | M | Low | 2 hr |
| 5.16 | Filter state in URL params (via `nuqs`) | 9 | 5.15 | M | Low | 1.5 hr |
| 5.17 | Column pagination ("Load more" when 50+ issues) | 9 | 5.2 | M | Low | 1.5 hr |
| 5.18 | List/table view page (`/[workspace]/project/[key]/list`) | 9 | 4.1 | L | Medium | 4 hr |
| 5.19 | TanStack Table integration (sorting, column visibility) | 9 | 5.18 | L | Medium | 3 hr |
| 5.20 | View toggle (Board / List) in project header | 9 | 5.1, 5.18 | S | Low | 30 min |
| 5.21 | Empty state for board (no issues in column / no issues at all) | 8 | 5.1 | S | Low | 30 min |
| 5.22 | Board view polling (30s refresh for multi-user sync) | 9 | 5.1 | M | Low | 1 hr |

**Kanban Board Component Hierarchy:**
```
BoardPage (Server Component)
  -> fetches statuses + issues
  -> passes to KanbanBoard (Client Component)

KanbanBoard ('use client')
  -> DndContext (sensors: mouse, touch, keyboard)
    -> SortableContext (horizontal, columns)
      -> BoardColumn (per status)
        -> SortableContext (vertical, issues)
          -> SortableIssueCard (per issue)
    -> DragOverlay
      -> IssueCard (clone of dragged card)
  -> QuickFilterBar
```

**Drag-and-Drop Event Flow:**
```
onDragStart -> set activeId, show DragOverlay
onDragOver  -> detect cross-column movement, preview in target column
onDragEnd   -> calculate new position (fractional-indexing)
           -> optimistic update (useOptimistic)
           -> startTransition + moveIssue server action
           -> on error: auto-revert + toast
```

**Layer 5 Total: ~37 hours (most complex layer)**

---

### Layer 6: Search, Filters, and Polish

| # | Component | Priority | Dependencies | Complexity | Risk | Est. Time |
|---|-----------|----------|--------------|------------|------|-----------|
| 6.1 | Command palette (Cmd+K) using shadcn Command | 10 | 4.1, 0.4 | M | Low | 2 hr |
| 6.2 | Global issue search (title + key, Prisma `contains`) | 10 | 6.1, 1.5 | M | Low | 1.5 hr |
| 6.3 | Search results display (issue key, title, project, status, assignee) | 10 | 6.2 | M | Low | 1 hr |
| 6.4 | Search keyboard navigation (arrow keys, enter to navigate) | 10 | 6.1 | S | Low | 30 min |
| 6.5 | Loading states (Skeleton components across all pages) | 10 | 0.4 | M | Low | 2 hr |
| 6.6 | Error boundaries (global + per-route) | 10 | None | M | Low | 1.5 hr |
| 6.7 | Toast notifications for all mutations (sonner) | 10 | 0.7 | S | Low | 1 hr |
| 6.8 | Empty states for all pages (no projects, no issues, no members, no results) | 10 | 0.4 | M | Low | 2 hr |
| 6.9 | Responsive layout adjustments (tablet: collapsible sidebar) | 10 | 3.1 | M | Low | 2 hr |
| 6.10 | Overdue date highlighting (red badge on past-due issues) | 10 | 4.12 | S | Low | 20 min |
| 6.11 | Breadcrumb navigation (Workspace > Project > Issue) | 10 | 3.1 | S | Low | 30 min |
| 6.12 | Page titles + meta tags | 10 | None | S | Low | 30 min |
| 6.13 | 404 page + redirect logic (no workspace, invalid project key) | 10 | 3.1 | S | Low | 30 min |

**Layer 6 Total: ~15 hours**

---

## 3. Integration Strategy

### 3.1 Frontend-to-Backend Communication

| Pattern | When to Use | Examples |
|---------|-------------|---------|
| **Server Components** (data fetch) | Initial page loads, read-only data | Board page, project list, issue detail |
| **Server Actions** (mutations) | All write operations | Create issue, move card, update field, add comment |
| **API Routes** | External webhooks, SSE endpoints | `api/auth/*` (Auth.js), future SSE endpoint |
| **TanStack Query** | Client-side cache + optimistic updates | Board polling refresh, search-as-you-type |

**Decision: Server Actions as primary mutation layer (NOT API routes).**

Rationale:
- Server Actions are type-safe end-to-end with TypeScript
- Built-in form progressiveenhancement
- Automatic `revalidatePath`/`revalidateTag` integration
- No need to define REST endpoints, serialize/deserialize manually
- Works with `useOptimistic` + `startTransition` for optimistic UI

API routes reserved ONLY for:
- Auth.js callback routes (required by the library)
- Future SSE/webhook endpoints (Phase 3)

### 3.2 Auth Context Flow

```
Request enters Next.js
    |
    ▼
middleware.ts
    ├── Checks JWT session via auth()
    ├── Public routes (/sign-in, /sign-up, /invite/*) -> pass through
    ├── No session -> redirect to /sign-in
    └── Has session -> pass through
    |
    ▼
Server Component / Server Action
    ├── const session = await auth()  // Re-verify independently
    ├── Extract userId from session.user.id
    ├── Check workspace membership: WorkspaceMember(userId, workspaceId)
    ├── Check role hierarchy: OWNER > ADMIN > MEMBER > VIEWER
    └── Execute query/mutation only if authorized
    |
    ▼
Client Component
    ├── SessionProvider wraps (dashboard) layout
    ├── useSession() for UI decisions (show/hide buttons based on role)
    └── Server Actions handle real authorization (never trust client)
```

**Auth Helper Functions:**

```
getCurrentUser()     -> Returns session user or throws 401
requireAuth()        -> Returns session or throws redirect to /sign-in
requireWorkspaceMember(userId, workspaceId) -> Returns member record or throws 403
requirePermission(userId, workspaceId, minRole) -> Role hierarchy check or throws 403
```

### 3.3 Data Fetching Pattern

**Server Components (read):**
```
Page (Server Component)
  -> Prisma query with includes/selects
  -> Pass data as props to Client Components
```

**Client Mutations (write):**
```
Client Component
  -> User action (click, drag, type)
  -> useOptimistic for instant UI update (where applicable)
  -> startTransition + Server Action
  -> Server Action: auth -> validate -> authorize -> execute -> revalidate
  -> On success: UI updates via revalidation
  -> On error: optimistic revert + toast notification
```

**Search (client-driven):**
```
Command Palette (Client Component)
  -> Debounced input (300ms)
  -> Server Action: searchIssues(workspaceId, query)
  -> Return results -> render in Command list
```

### 3.4 Real-Time Updates Strategy

**MVP approach: Smart Polling + Optimistic Updates**

| Scenario | Strategy | Refresh Interval |
|----------|----------|-----------------|
| Kanban board | TanStack Query polling | 30 seconds |
| Issue detail view | Revalidate on focus | On window focus |
| Issue list | TanStack Query polling | 30 seconds |
| Search results | On-demand (each keystroke) | N/A |
| Sidebar project list | Revalidate on navigation | On route change |

**Why not WebSockets/SSE for MVP:**
- Adds significant infrastructure complexity
- 30s polling is sufficient for 1-10 concurrent users
- Optimistic updates handle the "my own changes" case instantly
- SSE for notifications planned for Phase 3

### 3.5 State Management Strategy

| State Type | Technology | Location |
|------------|-----------|----------|
| Server data (issues, projects, members) | Server Components + revalidation | Server |
| Cached server data (board polling) | TanStack Query | Client |
| Optimistic mutations | `useOptimistic` | Client |
| URL state (filters, view mode, search) | `nuqs` | URL params |
| UI state (sidebar open, active modal, drag state) | Zustand | Client |
| Auth session | NextAuth JWT + `useSession` | Cookie + Client |

---

## 4. Risk Register

### High Risk

| ID | Risk | Impact | Likelihood | Mitigation |
|----|------|--------|------------|------------|
| R1 | **Drag-and-drop on Kanban is buggy/janky** | Major UX degradation; board feels broken | Medium | Use @dnd-kit (battle-tested); prototype DnD in isolation first; implement DragOverlay for smooth visuals; extensive manual testing across browsers |
| R2 | **Optimistic updates cause stale UI or data loss** | Users see incorrect data; trust eroded | Medium | Use React 19 `useOptimistic` (auto-reverts on error); always show toast on server error; add 30s polling as safety net; implement `updatedAt` conflict detection |
| R3 | **Fractional indexing edge cases (precision overflow)** | Cards can't be reordered after many moves | Low | Use `fractional-indexing` library (handles edge cases); implement periodic rebalancing function; monitor position string lengths |
| R4 | **Tiptap rich text editor bundle size + complexity** | Slow page loads; editor bugs | Medium | Dynamic import (`next/dynamic`) for editor; start with minimal extensions (StarterKit only); add extensions incrementally; set a 200KB budget for editor chunk |

### Medium Risk

| ID | Risk | Impact | Likelihood | Mitigation |
|----|------|--------|------------|------------|
| R5 | **Auth + RBAC middleware edge cases** | Unauthorized access; security holes | Medium | Independent auth check in every Server Action (defense in depth); comprehensive Zod validation; test all role combinations; never rely solely on middleware |
| R6 | **Issue key race condition** | Duplicate keys (PROJ-123 appears twice) | Low | Prisma interactive `$transaction` with atomic `increment`; unique constraint on issue.key in DB; retry on unique violation |
| R7 | **Large board performance (500+ issues)** | Slow render, dropped frames during drag | Medium | Column pagination (50 per column); minimal data on cards (no description); Suspense streaming for columns; consider virtualization if needed |
| R8 | **Workspace slug / project key uniqueness validation UX** | Confusing errors on duplicate names | Low | Real-time debounced validation; clear inline error messages; suggest alternatives |
| R9 | **NextAuth.js v5 breaking changes / edge cases** | Auth flows fail unexpectedly | Medium | Pin exact version; follow Auth.js v5 migration guide closely; test all three providers end-to-end |

### Low Risk

| ID | Risk | Impact | Likelihood | Mitigation |
|----|------|--------|------------|------------|
| R10 | **Prisma client hot-reload memory leaks in dev** | Dev server crashes | Low | Singleton pattern (globalThis); documented in best-practices |
| R11 | **Tailwind v4 + shadcn/ui compatibility issues** | Styling breaks | Low | Use shadcn/ui latest init; follow Tailwind v4 PostCSS setup exactly |
| R12 | **PostgreSQL connection limits in dev** | DB connection errors | Low | Prisma connection pooling; single client instance |

---

## 5. Rollback & Safety Strategy

### 5.1 Git Commit Strategy

Commit at every meaningful milestone. Each commit should leave the app in a **runnable state** (even if incomplete features exist).

| Milestone | Commit Message Pattern | Tag |
|-----------|----------------------|-----|
| Layer 0 complete | `feat: scaffold Next.js 15 project with tooling` | `v0.0.1-scaffold` |
| Schema complete | `feat: add Prisma schema with all MVP models` | `v0.0.2-schema` |
| Auth working | `feat: add auth system (credentials + OAuth)` | `v0.0.3-auth` |
| Workspace + Project CRUD | `feat: add workspace and project management` | `v0.0.4-workspace` |
| Issue CRUD (no board) | `feat: add issue CRUD with detail view` | `v0.0.5-issues` |
| Kanban board (static) | `feat: add Kanban board view` | `v0.0.6-board-static` |
| Kanban DnD working | `feat: add drag-and-drop to Kanban board` | `v0.0.7-board-dnd` |
| List view complete | `feat: add list view with sorting` | `v0.0.8-list-view` |
| Search + filters | `feat: add global search and board filters` | `v0.0.9-search` |
| MVP polish complete | `feat: complete MVP with polish and error states` | `v0.1.0-mvp` |

### 5.2 Feature Flags (for Risky Components)

Implement a simple feature flag system for risky features that can be toggled off without removing code:

```typescript
// src/lib/feature-flags.ts
export const featureFlags = {
  KANBAN_DND: process.env.NEXT_PUBLIC_FF_KANBAN_DND !== 'false',      // default ON
  RICH_TEXT_EDITOR: process.env.NEXT_PUBLIC_FF_RICH_TEXT !== 'false',  // default ON
  OPTIMISTIC_UPDATES: process.env.NEXT_PUBLIC_FF_OPTIMISTIC !== 'false', // default ON
} as const;
```

| Feature | Flag | Fallback if OFF |
|---------|------|-----------------|
| Kanban drag-and-drop | `KANBAN_DND` | Status change via dropdown on issue detail only |
| Rich text editor | `RICH_TEXT_EDITOR` | Plain textarea for description |
| Optimistic board updates | `OPTIMISTIC_UPDATES` | Full page reload after move |

### 5.3 Database Rollback

- Use `prisma db push` during dev (schema sync without migrations)
- Switch to `prisma migrate dev` before first deployment (creates migration history)
- Every schema change committed alongside code changes
- Seed script allows fresh database recreation at any point

### 5.4 Incremental Delivery

Each layer produces a usable (if limited) application:

| After Layer | What Works |
|-------------|------------|
| Layer 2 | Users can sign up, sign in, see empty dashboard |
| Layer 3 | Users can create workspaces, projects, invite members |
| Layer 4 | Users can create and manage issues (no board yet, but list of issues works) |
| Layer 5 | Full Kanban + List views working |
| Layer 6 | Search, filters, polish -- MVP complete |

---

## 6. Milestone Plan

### Timeline Estimate

| Layer | Description | Est. Hours | Calendar Days (4h/day) |
|-------|-------------|-----------|----------------------|
| 0 | Scaffolding | 1.5 hr | 0.5 day |
| 1 | Database schema | 4 hr | 1 day |
| 2 | Authentication | 7 hr | 2 days |
| 3 | Workspace + Project + Shell | 23 hr | 6 days |
| 4 | Issue CRUD | 32 hr | 8 days |
| 5 | Board views (Kanban + List) | 37 hr | 9 days |
| 6 | Search + Polish | 15 hr | 4 days |
| **Total** | | **~120 hr** | **~30 working days** |

### Critical Path

The critical path (longest sequential chain) is:

```
Schema -> Auth -> Workspace -> Project -> Issue CRUD -> Kanban Board -> DnD -> Optimistic Updates
```

Items that can be parallelized (if multiple developers):
- Layer 3: Sidebar + Shell can parallel with Workspace CRUD
- Layer 4: Label/Assignee/Priority pickers can parallel with Issue server actions
- Layer 5: List view can parallel with Kanban board
- Layer 6: Search can parallel with polish/error states

### Definition of Done (per Layer)

Each layer is "done" when:
1. All components in the layer are implemented
2. TypeScript compiles with zero errors (`tsc --noEmit`)
3. ESLint passes with zero warnings
4. Manual smoke test of all happy paths
5. Edge cases from requirements doc are handled (empty states, validation errors)
6. Git commit + tag created
7. App runs successfully in dev mode

### MVP Definition of Done

The MVP (v0.1.0) is complete when:
- [ ] User can sign up (email/password or Google/GitHub OAuth)
- [ ] User can create a workspace and invite members with roles
- [ ] User can create projects with custom key and icon
- [ ] User can create, edit, and view issues with all MVP fields
- [ ] Issues have auto-generated keys (PROJ-1, PROJ-2, etc.)
- [ ] Kanban board shows issues grouped by status columns
- [ ] Drag-and-drop moves issues between status columns
- [ ] Drag-and-drop reorders issues within columns
- [ ] List view shows issues in a sortable table
- [ ] Board has quick filter bar (assignee, priority, label, type)
- [ ] Cmd+K global search finds issues by title and key
- [ ] Issue detail panel shows all fields with inline editing
- [ ] Rich text editor works for issue descriptions
- [ ] Comments can be added to issues
- [ ] Activity log tracks all issue changes
- [ ] Labels can be created and assigned to issues
- [ ] Dark/light mode works
- [ ] Desktop and tablet layouts are responsive
- [ ] All empty states have helpful messaging
- [ ] All mutations show success/error toasts
- [ ] Auth protects all routes; RBAC enforced on all actions

---

## Summary

This strategy defines a 6-layer, foundation-up implementation plan for the PMApp MVP with 120 estimated hours of work across 86 discrete components. The build order ensures each layer produces a runnable application, with the most complex work (Kanban DnD + optimistic updates) concentrated in Layer 5 where all dependencies are satisfied. Four high-risk items are identified with specific mitigations, and a feature flag system provides safe rollback for the riskiest features (DnD, rich text, optimistic updates).
