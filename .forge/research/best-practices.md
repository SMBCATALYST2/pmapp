# Best Practices Research: JIRA-like Project Management App

> Stack: Next.js 15 + TypeScript + PostgreSQL + Prisma + Tailwind CSS + shadcn/ui + NextAuth.js
> Date: 2026-03-26

---

## Table of Contents

1. [Architecture & Project Structure](#1-architecture--project-structure)
2. [Kanban Board Implementation](#2-kanban-board-implementation)
3. [Issue Tracking System](#3-issue-tracking-system)
4. [Sprint Management & Backlog](#4-sprint-management--backlog)
5. [Team & Workspace Management with RBAC](#5-team--workspace-management-with-rbac)
6. [Search, Filters & Dashboards](#6-search-filters--dashboards)
7. [Activity Feeds & Notifications](#7-activity-feeds--notifications)
8. [Recommended Libraries](#8-recommended-libraries)
9. [Database Schema Patterns](#9-database-schema-patterns)
10. [Security Best Practices](#10-security-best-practices)
11. [Common Pitfalls & Solutions](#11-common-pitfalls--solutions)
12. [Performance Optimization Strategies](#12-performance-optimization-strategies)

---

## 1. Architecture & Project Structure

### Next.js 15 App Router Architecture

Use the App Router with a clear separation of concerns:

```
src/
  app/
    (auth)/                    # Auth group (login, register, forgot-password)
      login/page.tsx
      register/page.tsx
    (dashboard)/               # Authenticated layout group
      layout.tsx               # Dashboard shell with sidebar
      [workspaceSlug]/         # Workspace-scoped routes
        page.tsx               # Workspace overview/dashboard
        projects/
          page.tsx             # Project list
          [projectId]/
            page.tsx           # Project overview
            board/page.tsx     # Kanban board view
            backlog/page.tsx   # Backlog view
            sprints/page.tsx   # Sprint management
            settings/page.tsx  # Project settings
        issues/
          [issueKey]/page.tsx  # Issue detail
        settings/
          page.tsx             # Workspace settings
          members/page.tsx     # Team management
    api/                       # API routes (webhooks, SSE endpoints)
      webhooks/
      sse/
  components/
    ui/                        # shadcn/ui components
    board/                     # Kanban board components
    issues/                    # Issue-related components
    layout/                    # Shell, sidebar, header
    shared/                    # Reusable components
  server/
    actions/                   # Server Actions by domain
      issues.ts
      projects.ts
      sprints.ts
      members.ts
    queries/                   # Data fetching functions
      issues.ts
      projects.ts
    db.ts                      # Prisma client singleton
  lib/
    auth/                      # Auth.js config + helpers
    validations/               # Zod schemas
    utils.ts                   # Utility functions
    constants.ts               # App constants
  hooks/                       # Custom React hooks
  types/                       # TypeScript type definitions
prisma/
  schema.prisma
  migrations/
  seed.ts
```

### Key Architectural Decisions

1. **Server Components by default** - Fetch data in Server Components, push interactivity to leaf Client Components
2. **Server Actions for mutations** - All write operations go through Server Actions with `'use server'` directive
3. **Route groups for layouts** - `(auth)` for unauthenticated pages, `(dashboard)` for authenticated pages
4. **Workspace-scoped routing** - All project management routes nested under `[workspaceSlug]` for multi-tenancy
5. **Collocated Server Actions** - Group actions by domain (issues, projects, sprints) in `src/server/actions/`
6. **Zod validation everywhere** - Validate all inputs at the Server Action boundary

### Data Flow Pattern

```
Server Component (fetch data via Prisma)
  -> Passes data as props to Client Components
    -> Client Component uses Server Action for mutations
      -> Server Action validates, mutates, calls revalidatePath/revalidateTag
        -> UI updates automatically
```

For optimistic updates (drag-and-drop):
```
Client Component (event handler)
  -> useOptimistic for immediate UI update
  -> startTransition + Server Action for persistence
  -> On error: automatic rollback to server state
```

---

## 2. Kanban Board Implementation

### Library Choice: @dnd-kit (Recommended)

**@dnd-kit** is the recommended drag-and-drop library for modern React apps:

- **Architecture**: Uses `DndContext` as top-level provider with Sensors (mouse, touch, keyboard), Modifiers (constraints), and Collision Detection algorithms
- **Sortable**: Built-in `@dnd-kit/sortable` package for reordering within and across lists (perfect for Kanban columns)
- **Performance**: Uses CSS transforms instead of layout shifts, supports virtualization
- **Accessibility**: Full keyboard navigation, screen reader announcements, ARIA attributes
- **Framework support**: React 18/19 compatible, tree-shakeable

**Why not react-beautiful-dnd?** It was officially deprecated by Atlassian. The community fork `@hello-pangea/dnd` exists but @dnd-kit is the more modern, actively maintained choice.

### Kanban Board Architecture

```typescript
// Board structure
interface KanbanBoard {
  columns: Column[];        // Ordered list of status columns
  issuesByColumn: Map<string, Issue[]>;  // Issues grouped by status
}

// Component hierarchy
<BoardProvider>                           // Context for board state
  <DndContext                             // @dnd-kit context
    sensors={sensors}
    collisionDetection={closestCorners}
    onDragStart={handleDragStart}
    onDragOver={handleDragOver}           // Cross-column movement
    onDragEnd={handleDragEnd}             // Final placement
  >
    <SortableContext>                     // Column ordering
      {columns.map(col => (
        <BoardColumn key={col.id} column={col}>
          <SortableContext items={issues}> // Issue ordering within column
            {issues.map(issue => (
              <SortableIssueCard key={issue.id} issue={issue} />
            ))}
          </SortableContext>
        </BoardColumn>
      ))}
    </SortableContext>
    <DragOverlay>                         // Floating card during drag
      {activeIssue && <IssueCard issue={activeIssue} />}
    </DragOverlay>
  </DndContext>
</BoardProvider>
```

### Optimistic Updates for Drag-and-Drop

Critical for smooth UX - update the board immediately, persist asynchronously:

```typescript
'use client'
import { useOptimistic, startTransition } from 'react';
import { moveIssue } from '@/server/actions/issues';

function useKanbanBoard(initialColumns: ColumnWithIssues[]) {
  const [optimisticColumns, setOptimisticColumns] = useOptimistic(
    initialColumns,
    (current, update: { issueId: string; fromCol: string; toCol: string; newIndex: number }) => {
      // Move issue between columns optimistically
      return current.map(col => {
        if (col.id === update.fromCol) {
          return { ...col, issues: col.issues.filter(i => i.id !== update.issueId) };
        }
        if (col.id === update.toCol) {
          const issue = current
            .flatMap(c => c.issues)
            .find(i => i.id === update.issueId);
          if (!issue) return col;
          const newIssues = [...col.issues];
          newIssues.splice(update.newIndex, 0, { ...issue, status: col.status });
          return { ...col, issues: newIssues };
        }
        return col;
      });
    }
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    startTransition(async () => {
      setOptimisticColumns({
        issueId: active.id as string,
        fromCol: /* source column */,
        toCol: /* destination column */,
        newIndex: /* calculated index */,
      });

      // Persist to server
      await moveIssue({
        issueId: active.id as string,
        newStatus: /* target status */,
        newPosition: /* calculated position */,
      });
    });
  }

  return { optimisticColumns, handleDragEnd };
}
```

### Position/Ordering Strategy

Use a **fractional indexing** approach for ordering issues within columns:

```typescript
// Use the `fractional-indexing` npm package
// Issues get a `position` string field, e.g., "a0", "a1", "a0V"
// Moving between items generates a key between them without reindexing the whole list

import { generateKeyBetween } from 'fractional-indexing';

function getNewPosition(before: string | null, after: string | null): string {
  return generateKeyBetween(before, after);
}

// In schema:
// model Issue {
//   position  String   // fractional index within its column
//   @@index([projectId, status, position])
// }
```

This avoids updating every issue's position when one is moved. Only the moved issue gets a new position value.

---

## 3. Issue Tracking System

### Issue Model Design

```typescript
// Core issue fields (see full schema in Section 9)
interface Issue {
  id: string;           // cuid2
  key: string;          // Human-readable: "PROJ-123"
  title: string;
  description: string;  // Rich text (Tiptap JSON or HTML)
  type: IssueType;      // BUG | TASK | STORY | EPIC
  status: string;       // Links to workflow status
  priority: Priority;   // URGENT | HIGH | MEDIUM | LOW | NONE
  assigneeId?: string;
  reporterId: string;
  projectId: string;
  sprintId?: string;
  parentId?: string;    // For subtasks & epic children
  labels: Label[];
  storyPoints?: number;
  dueDate?: Date;
  position: string;     // Fractional index for ordering
  createdAt: Date;
  updatedAt: Date;
}
```

### Issue Key Generation

Auto-generate sequential keys per project:

```typescript
// Server Action
async function createIssue(data: CreateIssueInput) {
  'use server';
  return prisma.$transaction(async (tx) => {
    // Atomically increment the project's issue counter
    const project = await tx.project.update({
      where: { id: data.projectId },
      data: { issueCounter: { increment: 1 } },
    });

    const key = `${project.prefix}-${project.issueCounter}`;

    return tx.issue.create({
      data: { ...data, key },
    });
  });
}
```

### Status Workflow Engine

Support customizable workflows per project:

```typescript
// Default workflow: BACKLOG -> TODO -> IN_PROGRESS -> IN_REVIEW -> DONE
// Each project can customize statuses and transitions

interface WorkflowStatus {
  id: string;
  name: string;
  category: 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
  color: string;
  position: number;
  projectId: string;
}

// Status categories allow the board to group columns logically
// and enable automatic sprint completion (move all DONE items out)
```

### Rich Text Editor: Tiptap

Tiptap is the recommended rich text editor for issue descriptions:

- **Headless architecture** - Full control over UI, integrates with any design system
- **React integration** - `@tiptap/react` with `useEditor` hook
- **Key extensions for PM apps**:
  - `StarterKit` (bold, italic, lists, headings, code blocks)
  - `TaskList` + `TaskItem` (checkboxes in descriptions)
  - `Mention` (@user mentions with autocomplete)
  - `Image` (inline screenshots/attachments)
  - `Link` (auto-detection)
  - `Placeholder`
  - `CodeBlockLowlight` (syntax highlighting)
  - `Markdown` (paste markdown, export markdown)
- **Collaborative editing** - Yjs integration for real-time co-editing (optional, advanced)
- **Output formats** - JSON (recommended for storage) or HTML
- **Performance** - Modular, only load extensions you need

```typescript
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Mention from '@tiptap/extension-mention';

const editor = useEditor({
  extensions: [
    StarterKit,
    TaskList,
    TaskItem.configure({ nested: true }),
    Mention.configure({
      suggestion: memberSuggestion, // Custom autocomplete
    }),
  ],
  content: issue.description,
  onUpdate: ({ editor }) => {
    // Debounced auto-save
    debouncedSave(editor.getJSON());
  },
});
```

### Subtasks & Issue Relationships

Support parent-child hierarchies and cross-linking:

```
Epic
  -> Story (parent = Epic)
    -> Task (parent = Story)
      -> Subtask (parent = Task)

Issue Links:
  - "blocks" / "is blocked by"
  - "relates to"
  - "duplicates" / "is duplicated by"
```

---

## 4. Sprint Management & Backlog

### Sprint Model

```typescript
interface Sprint {
  id: string;
  name: string;           // "Sprint 14"
  goal?: string;          // Sprint goal text
  projectId: string;
  status: 'PLANNED' | 'ACTIVE' | 'COMPLETED';
  startDate?: Date;
  endDate?: Date;
  completedAt?: Date;
  createdAt: Date;
}
```

### Key Sprint Operations

1. **Create Sprint** - Name, optional date range, goal
2. **Start Sprint** - Sets status to ACTIVE, validates no other active sprint
3. **Complete Sprint** - Move incomplete issues to backlog or next sprint
4. **Sprint Board** - Kanban filtered to current sprint's issues
5. **Burndown Chart** - Track story points completed over time

### Backlog View

- **Flat list** of all issues not in an active sprint, ordered by priority/position
- **Drag to sprint** - Move issues from backlog into a planned sprint
- **Bulk actions** - Select multiple issues, assign to sprint, change priority
- **Inline create** - Quick issue creation directly in the backlog
- **Grouping** - Group by epic, assignee, or priority

### Sprint Completion Logic

```typescript
async function completeSprint(sprintId: string, moveToSprintId?: string) {
  'use server';
  return prisma.$transaction(async (tx) => {
    const sprint = await tx.sprint.findUniqueOrThrow({
      where: { id: sprintId },
      include: { issues: true },
    });

    // Separate completed vs incomplete issues
    const incomplete = sprint.issues.filter(i =>
      !['DONE', 'CANCELLED'].includes(i.statusCategory)
    );

    // Move incomplete issues
    if (moveToSprintId) {
      await tx.issue.updateMany({
        where: { id: { in: incomplete.map(i => i.id) } },
        data: { sprintId: moveToSprintId },
      });
    } else {
      // Move back to backlog
      await tx.issue.updateMany({
        where: { id: { in: incomplete.map(i => i.id) } },
        data: { sprintId: null },
      });
    }

    // Mark sprint as completed
    await tx.sprint.update({
      where: { id: sprintId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
  });
}
```

### Date Handling: date-fns

Use **date-fns** for date manipulation (tree-shakeable, immutable, TypeScript-first):

```typescript
import { format, differenceInDays, addWeeks, isWithinInterval } from 'date-fns';

// Sprint duration
const sprintLength = differenceInDays(sprint.endDate, sprint.startDate);

// Default 2-week sprints
const defaultEnd = addWeeks(startDate, 2);

// Check if today is within sprint
const isActive = isWithinInterval(new Date(), {
  start: sprint.startDate,
  end: sprint.endDate,
});
```

---

## 5. Team & Workspace Management with RBAC

### Multi-Tenant Architecture

Use a **workspace** model as the top-level tenant:

```typescript
// URL structure: app.example.com/[workspaceSlug]/projects/...
// Each workspace has its own projects, members, settings

interface Workspace {
  id: string;
  name: string;
  slug: string;          // URL-safe unique identifier
  ownerId: string;       // Creator
  plan: 'FREE' | 'PRO' | 'ENTERPRISE';
  createdAt: Date;
}
```

### RBAC Model

Four-tier role system:

| Role | Permissions |
|------|-------------|
| **OWNER** | Full control, billing, delete workspace, manage all members |
| **ADMIN** | Manage projects, manage members (except owner), all project settings |
| **MEMBER** | Create/edit issues, manage own assignments, view all projects |
| **VIEWER** | Read-only access to projects and issues |

Implementation pattern:

```typescript
// Membership model (many-to-many with role)
interface WorkspaceMember {
  userId: string;
  workspaceId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  joinedAt: Date;
}

// Permission check helper
async function requirePermission(
  userId: string,
  workspaceId: string,
  requiredRole: Role
): Promise<WorkspaceMember> {
  const member = await prisma.workspaceMember.findUnique({
    where: {
      userId_workspaceId: { userId, workspaceId },
    },
  });

  if (!member) throw new Error('Not a member of this workspace');

  const roleHierarchy = { OWNER: 4, ADMIN: 3, MEMBER: 2, VIEWER: 1 };
  if (roleHierarchy[member.role] < roleHierarchy[requiredRole]) {
    throw new Error('Insufficient permissions');
  }

  return member;
}

// Usage in Server Action
export async function deleteProject(projectId: string) {
  'use server';
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');

  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
  });

  await requirePermission(session.user.id, project.workspaceId, 'ADMIN');

  await prisma.project.delete({ where: { id: projectId } });
  revalidatePath(`/${project.workspace.slug}/projects`);
}
```

### Project-Level Roles (Optional Enhancement)

For larger teams, add project-specific roles:

```typescript
interface ProjectMember {
  userId: string;
  projectId: string;
  role: 'LEAD' | 'MEMBER' | 'VIEWER';
}
```

### Invitation System

```typescript
interface WorkspaceInvitation {
  id: string;
  email: string;
  workspaceId: string;
  role: Role;
  invitedById: string;
  token: string;          // Unique invite token
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED';
  expiresAt: Date;
}
```

---

## 6. Search, Filters & Dashboards

### Data Tables: TanStack Table + shadcn/ui

**TanStack Table** (headless) combined with **shadcn/ui's DataTable** pattern:

- **Sorting** - Multi-column, server-side for large datasets
- **Filtering** - Column-level faceted filters (status, assignee, priority, label)
- **Global search** - Full-text search across issue titles and descriptions
- **Pagination** - Cursor-based for performance, offset for simpler UIs
- **Column visibility** - Toggle columns on/off
- **Row selection** - Bulk actions (assign, move to sprint, delete)
- **Column pinning** - Keep key columns visible while scrolling
- **Virtualization** - For boards/lists with 1000+ items

```typescript
// Server-side filtering pattern
async function getIssues(params: IssueFilterParams) {
  const where: Prisma.IssueWhereInput = {
    projectId: params.projectId,
    ...(params.status && { status: { in: params.status } }),
    ...(params.assigneeId && { assigneeId: params.assigneeId }),
    ...(params.priority && { priority: { in: params.priority } }),
    ...(params.labelIds?.length && {
      labels: { some: { id: { in: params.labelIds } } },
    }),
    ...(params.search && {
      OR: [
        { title: { contains: params.search, mode: 'insensitive' } },
        { key: { contains: params.search, mode: 'insensitive' } },
      ],
    }),
  };

  const [issues, total] = await prisma.$transaction([
    prisma.issue.findMany({
      where,
      include: {
        assignee: { select: { id: true, name: true, image: true } },
        labels: true,
      },
      orderBy: params.orderBy || { createdAt: 'desc' },
      skip: params.cursor ? 1 : 0,
      take: params.limit || 50,
      ...(params.cursor && { cursor: { id: params.cursor } }),
    }),
    prisma.issue.count({ where }),
  ]);

  return { issues, total, nextCursor: issues[issues.length - 1]?.id };
}
```

### Search Implementation

For MVP, use PostgreSQL full-text search:

```sql
-- Add tsvector column and GIN index
ALTER TABLE "Issue" ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(key, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description_text, '')), 'B')
  ) STORED;

CREATE INDEX issue_search_idx ON "Issue" USING GIN(search_vector);
```

```typescript
// Search with Prisma raw query
async function searchIssues(workspaceId: string, query: string) {
  return prisma.$queryRaw`
    SELECT id, key, title, status, priority
    FROM "Issue"
    WHERE "workspaceId" = ${workspaceId}
      AND search_vector @@ plainto_tsquery('english', ${query})
    ORDER BY ts_rank(search_vector, plainto_tsquery('english', ${query})) DESC
    LIMIT 20
  `;
}
```

### Command Palette (Quick Search)

Use shadcn/ui `Command` component (based on cmdk):

```typescript
// Cmd+K to open, search issues, projects, members
// Keyboard-first navigation
// Recent items, suggested actions
```

### Dashboard Charts: Recharts

**Recharts** is the recommended chart library:

- Built for React, declarative API
- Responsive and customizable
- Good TypeScript support
- Key charts for PM dashboards:
  - **Sprint burndown** (line chart)
  - **Issue distribution by status** (pie/donut chart)
  - **Issues created vs resolved** (area chart)
  - **Velocity chart** (bar chart - story points per sprint)
  - **Assignee workload** (horizontal bar chart)

---

## 7. Activity Feeds & Notifications

### Activity Log Pattern

Record all significant changes as an immutable audit trail:

```typescript
interface Activity {
  id: string;
  type: ActivityType;     // 'ISSUE_CREATED' | 'STATUS_CHANGED' | 'ASSIGNED' | etc.
  issueId?: string;
  projectId: string;
  workspaceId: string;
  actorId: string;        // Who performed the action
  metadata: JsonValue;    // Structured change data
  createdAt: Date;
}

// Example metadata for status change:
// { field: "status", from: "TODO", to: "IN_PROGRESS" }
// Example metadata for assignment:
// { field: "assignee", from: null, to: { id: "user123", name: "Alice" } }
```

### Activity Creation Pattern

Wrap mutations to automatically log activities:

```typescript
async function updateIssueWithActivity(
  issueId: string,
  data: Partial<Issue>,
  actorId: string
) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.issue.findUniqueOrThrow({ where: { id: issueId } });
    const after = await tx.issue.update({ where: { id: issueId }, data });

    // Generate activity entries for each changed field
    const activities = [];
    for (const [key, value] of Object.entries(data)) {
      if (before[key] !== value) {
        activities.push({
          type: `ISSUE_${key.toUpperCase()}_CHANGED`,
          issueId,
          projectId: before.projectId,
          workspaceId: before.workspaceId,
          actorId,
          metadata: { field: key, from: before[key], to: value },
        });
      }
    }

    if (activities.length > 0) {
      await tx.activity.createMany({ data: activities });
    }

    return after;
  });
}
```

### Notification System

```typescript
interface Notification {
  id: string;
  userId: string;         // Recipient
  type: NotificationType;
  title: string;
  body?: string;
  issueId?: string;
  workspaceId: string;
  read: boolean;
  readAt?: Date;
  createdAt: Date;
}

// Notification triggers:
// - Assigned to an issue
// - Mentioned in a comment (@username)
// - Issue you're watching is updated
// - Comment on an issue you created/are assigned to
// - Sprint started/completed
```

### Real-Time Updates Strategy

**Recommended: Server-Sent Events (SSE) for notifications, polling for board updates**

| Approach | Use Case | Complexity |
|----------|----------|------------|
| **SSE** | Notifications, activity feed | Medium |
| **Polling (SWR/React Query)** | Board refresh, issue list | Low |
| **WebSockets** | Real-time collaborative editing | High |

For an MVP, start with **smart polling** + **optimistic updates**:

```typescript
// Poll board data every 30 seconds, but use optimistic updates for instant feedback
// This avoids the complexity of WebSocket infrastructure

// SSE endpoint for notifications (API route)
// app/api/sse/notifications/route.ts
export async function GET(request: Request) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Check for new notifications periodically
      const interval = setInterval(async () => {
        const notifications = await getUnreadNotifications(userId);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(notifications)}\n\n`)
        );
      }, 5000);

      request.signal.addEventListener('abort', () => clearInterval(interval));
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
```

---

## 8. Recommended Libraries

### Core Stack

| Library | Version | Purpose |
|---------|---------|---------|
| `next` | 15.x | Framework |
| `react` | 19.x | UI library |
| `typescript` | 5.x | Type safety |
| `prisma` | 6.x | ORM + migrations |
| `@prisma/client` | 6.x | Database client |
| `tailwindcss` | 4.x | Styling |
| `next-auth` (Auth.js v5) | 5.x | Authentication |

### UI & Components

| Library | Purpose | Notes |
|---------|---------|-------|
| `shadcn/ui` | Component library | Copy-paste components, fully customizable |
| `@radix-ui/react-*` | Accessible primitives | Used by shadcn/ui under the hood |
| `cmdk` | Command palette | Powers shadcn/ui Command component |
| `lucide-react` | Icons | Default icon set for shadcn/ui |
| `class-variance-authority` | Variant styling | Used by shadcn/ui for component variants |
| `tailwind-merge` | Class merging | Dedup Tailwind classes |

### Drag and Drop

| Library | Purpose | Notes |
|---------|---------|-------|
| `@dnd-kit/core` | DnD foundation | Sensors, collision detection |
| `@dnd-kit/sortable` | Sortable lists | Kanban columns + card ordering |
| `@dnd-kit/utilities` | CSS transforms | Performance helpers |

### Data & Forms

| Library | Purpose | Notes |
|---------|---------|-------|
| `@tanstack/react-table` | Data tables | Headless, sorting, filtering, pagination |
| `react-hook-form` | Form management | Performance-focused, minimal re-renders |
| `zod` | Schema validation | Server + client validation |
| `@hookform/resolvers` | Zod + RHF bridge | Connect Zod schemas to forms |

### Rich Text

| Library | Purpose | Notes |
|---------|---------|-------|
| `@tiptap/react` | Rich text editor | Headless, extensible |
| `@tiptap/starter-kit` | Basic extensions | Bold, italic, lists, headings |
| `@tiptap/extension-task-list` | Task checkboxes | Inline task lists in descriptions |
| `@tiptap/extension-mention` | @mentions | User mention autocomplete |
| `@tiptap/extension-link` | Link detection | Auto-link URLs |
| `@tiptap/extension-placeholder` | Placeholder text | Empty state guidance |
| `@tiptap/extension-image` | Image embedding | Screenshots in descriptions |

### Utilities

| Library | Purpose | Notes |
|---------|---------|-------|
| `date-fns` | Date manipulation | Tree-shakeable, immutable |
| `fractional-indexing` | Position ordering | For Kanban card ordering |
| `nanoid` or `@paralleldrive/cuid2` | ID generation | URL-safe unique IDs |
| `recharts` | Charts/dashboards | React-native charting |
| `sonner` | Toast notifications | Minimal, accessible toasts |
| `nuqs` | URL state management | Type-safe URL search params for filters |

### Development

| Library | Purpose | Notes |
|---------|---------|-------|
| `eslint` | Linting | With Next.js config |
| `prettier` | Formatting | With Tailwind plugin |
| `prisma-dbml-generator` | Schema visualization | Generate ERD from Prisma schema |

---

## 9. Database Schema Patterns

### Complete Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ==================== AUTH ====================

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?
  password      String?   // For credentials auth (hashed)
  accounts      Account[]
  sessions      Session[]

  // PM Relations
  workspaces        WorkspaceMember[]
  ownedWorkspaces   Workspace[]       @relation("WorkspaceOwner")
  assignedIssues    Issue[]           @relation("Assignee")
  reportedIssues    Issue[]           @relation("Reporter")
  comments          Comment[]
  activities        Activity[]
  notifications     Notification[]

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

// ==================== WORKSPACE ====================

model Workspace {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  image     String?
  ownerId   String
  owner     User     @relation("WorkspaceOwner", fields: [ownerId], references: [id])

  members     WorkspaceMember[]
  projects    Project[]
  invitations WorkspaceInvitation[]
  labels      Label[]               // Workspace-wide labels

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
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
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  joinedAt    DateTime @default(now())

  @@id([userId, workspaceId])
}

model WorkspaceInvitation {
  id          String   @id @default(cuid())
  email       String
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  role        Role     @default(MEMBER)
  invitedById String
  token       String   @unique @default(cuid())
  status      InvitationStatus @default(PENDING)
  expiresAt   DateTime
  createdAt   DateTime @default(now())

  @@index([email, workspaceId])
  @@index([token])
}

enum InvitationStatus {
  PENDING
  ACCEPTED
  EXPIRED
}

// ==================== PROJECT ====================

model Project {
  id           String @id @default(cuid())
  name         String
  prefix       String       // "PROJ" - used for issue keys
  description  String?
  workspaceId  String
  workspace    Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  issueCounter Int      @default(0) // Auto-increment for issue keys

  issues       Issue[]
  sprints      Sprint[]
  statuses     WorkflowStatus[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([workspaceId, prefix])
  @@index([workspaceId])
}

// ==================== WORKFLOW ====================

enum StatusCategory {
  BACKLOG
  TODO
  IN_PROGRESS
  DONE
  CANCELLED
}

model WorkflowStatus {
  id        String         @id @default(cuid())
  name      String         // "In Review", "Testing", etc.
  category  StatusCategory
  color     String         @default("#6B7280")
  position  Int            // Order in the board
  projectId String
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  issues    Issue[]

  @@unique([projectId, name])
  @@index([projectId, position])
}

// ==================== ISSUE ====================

enum IssueType {
  EPIC
  STORY
  TASK
  BUG
  SUBTASK
}

enum Priority {
  URGENT
  HIGH
  MEDIUM
  LOW
  NONE
}

model Issue {
  id          String    @id @default(cuid())
  key         String    @unique    // "PROJ-123"
  title       String
  description Json?     // Tiptap JSON content
  descriptionText String? // Plain text for search indexing
  type        IssueType @default(TASK)
  priority    Priority  @default(MEDIUM)
  storyPoints Int?
  position    String    // Fractional index for ordering
  dueDate     DateTime?

  // Relations
  statusId    String
  status      WorkflowStatus @relation(fields: [statusId], references: [id])
  projectId   String
  project     Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  assigneeId  String?
  assignee    User?     @relation("Assignee", fields: [assigneeId], references: [id], onDelete: SetNull)
  reporterId  String
  reporter    User      @relation("Reporter", fields: [reporterId], references: [id])
  sprintId    String?
  sprint      Sprint?   @relation(fields: [sprintId], references: [id], onDelete: SetNull)

  // Hierarchy
  parentId    String?
  parent      Issue?    @relation("IssueHierarchy", fields: [parentId], references: [id], onDelete: SetNull)
  children    Issue[]   @relation("IssueHierarchy")

  // Many-to-many
  labels      Label[]
  comments    Comment[]
  activities  Activity[]
  attachments Attachment[]

  // Issue links (blocking, relates to, duplicates)
  linksFrom   IssueLink[] @relation("LinkFrom")
  linksTo     IssueLink[] @relation("LinkTo")

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([projectId, statusId, position])
  @@index([projectId, sprintId])
  @@index([assigneeId])
  @@index([parentId])
  @@index([key])
}

// ==================== ISSUE LINKS ====================

enum LinkType {
  BLOCKS
  IS_BLOCKED_BY
  RELATES_TO
  DUPLICATES
  IS_DUPLICATED_BY
}

model IssueLink {
  id       String   @id @default(cuid())
  type     LinkType
  fromId   String
  from     Issue    @relation("LinkFrom", fields: [fromId], references: [id], onDelete: Cascade)
  toId     String
  to       Issue    @relation("LinkTo", fields: [toId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@unique([fromId, toId, type])
}

// ==================== LABELS ====================

model Label {
  id          String    @id @default(cuid())
  name        String
  color       String    @default("#6B7280")
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  issues      Issue[]

  @@unique([workspaceId, name])
}

// ==================== SPRINT ====================

enum SprintStatus {
  PLANNED
  ACTIVE
  COMPLETED
}

model Sprint {
  id          String       @id @default(cuid())
  name        String
  goal        String?
  projectId   String
  project     Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
  status      SprintStatus @default(PLANNED)
  startDate   DateTime?
  endDate     DateTime?
  completedAt DateTime?
  issues      Issue[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([projectId, status])
}

// ==================== COMMENTS ====================

model Comment {
  id       String @id @default(cuid())
  body     Json   // Tiptap JSON
  bodyText String // Plain text for search
  issueId  String
  issue    Issue  @relation(fields: [issueId], references: [id], onDelete: Cascade)
  authorId String
  author   User   @relation(fields: [authorId], references: [id])

  // Thread support
  parentId String?
  parent   Comment?  @relation("CommentThread", fields: [parentId], references: [id], onDelete: SetNull)
  replies  Comment[] @relation("CommentThread")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([issueId, createdAt])
}

// ==================== ATTACHMENTS ====================

model Attachment {
  id       String @id @default(cuid())
  name     String
  url      String
  size     Int
  mimeType String
  issueId  String
  issue    Issue  @relation(fields: [issueId], references: [id], onDelete: Cascade)
  uploadedById String

  createdAt DateTime @default(now())
}

// ==================== ACTIVITY LOG ====================

model Activity {
  id          String   @id @default(cuid())
  type        String   // "ISSUE_CREATED", "STATUS_CHANGED", etc.
  issueId     String?
  issue       Issue?   @relation(fields: [issueId], references: [id], onDelete: SetNull)
  projectId   String
  actorId     String
  actor       User     @relation(fields: [actorId], references: [id])
  metadata    Json     // { field, from, to } or custom data
  createdAt   DateTime @default(now())

  @@index([issueId, createdAt])
  @@index([projectId, createdAt])
  @@index([actorId, createdAt])
}

// ==================== NOTIFICATIONS ====================

model Notification {
  id       String  @id @default(cuid())
  userId   String
  user     User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  type     String  // "ASSIGNED", "MENTIONED", "COMMENT", etc.
  title    String
  body     String?
  issueId  String?
  read     Boolean @default(false)
  readAt   DateTime?

  createdAt DateTime @default(now())

  @@index([userId, read, createdAt])
}
```

### Key Schema Design Decisions

1. **Fractional indexing for position** - Avoids reindexing entire column when moving cards
2. **Separate `descriptionText`** - Plain text mirror of rich content for full-text search
3. **StatusCategory enum** - Groups custom statuses into logical categories (board sections)
4. **Self-referencing Issue** - Supports epic->story->task->subtask hierarchy
5. **Composite indexes** - Optimized for common query patterns (project+status, project+sprint)
6. **Workspace-scoped labels** - Labels shared across all projects in a workspace
7. **WorkflowStatus per project** - Each project can customize its board columns
8. **Activity as append-only** - Never update or delete activities, only insert

---

## 10. Security Best Practices

### Authentication with Auth.js v5

```typescript
// src/lib/auth/config.ts
import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Google from 'next-auth/providers/google';
import GitHub from 'next-auth/providers/github';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/server/db';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },  // JWT for edge compatibility
  providers: [
    Google({ clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! }),
    GitHub({ clientId: process.env.GITHUB_CLIENT_ID!, clientSecret: process.env.GITHUB_CLIENT_SECRET! }),
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });
        if (!user?.password) return null;
        const valid = await bcrypt.compare(credentials.password as string, user.password);
        return valid ? user : null;
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
});
```

### Route Protection

In Next.js 16, `middleware.ts` is renamed to `proxy.ts`:

```typescript
// src/proxy.ts (or middleware.ts for Next.js 15)
import { auth } from '@/lib/auth/config';

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isAuthPage = req.nextUrl.pathname.startsWith('/login') ||
                     req.nextUrl.pathname.startsWith('/register');

  if (isAuthPage && isLoggedIn) {
    return Response.redirect(new URL('/', req.nextUrl));
  }

  if (!isAuthPage && !isLoggedIn) {
    return Response.redirect(new URL('/login', req.nextUrl));
  }
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

### Server Action Security Pattern

**Every Server Action must independently verify auth and authorization:**

```typescript
// src/server/actions/issues.ts
'use server';

import { auth } from '@/lib/auth/config';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

const createIssueSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.any().optional(),
  type: z.enum(['EPIC', 'STORY', 'TASK', 'BUG', 'SUBTASK']),
  priority: z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE']),
  projectId: z.string().cuid(),
  assigneeId: z.string().cuid().optional(),
  statusId: z.string().cuid(),
  sprintId: z.string().cuid().optional(),
});

export async function createIssue(input: z.infer<typeof createIssueSchema>) {
  // 1. Authenticate
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');

  // 2. Validate input
  const data = createIssueSchema.parse(input);

  // 3. Authorize (check workspace membership)
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: data.projectId },
    include: { workspace: true },
  });
  await requirePermission(session.user.id, project.workspaceId, 'MEMBER');

  // 4. Verify referenced entities belong to same workspace
  if (data.assigneeId) {
    const isMember = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: data.assigneeId,
          workspaceId: project.workspaceId,
        },
      },
    });
    if (!isMember) throw new Error('Assignee is not a workspace member');
  }

  // 5. Execute mutation
  const issue = await prisma.$transaction(async (tx) => {
    const proj = await tx.project.update({
      where: { id: data.projectId },
      data: { issueCounter: { increment: 1 } },
    });

    return tx.issue.create({
      data: {
        ...data,
        key: `${proj.prefix}-${proj.issueCounter}`,
        reporterId: session.user.id,
        position: generateKeyBetween(null, null), // First position
      },
    });
  });

  // 6. Revalidate cache
  revalidatePath(`/${project.workspace.slug}/projects/${project.id}`);

  return issue;
}
```

### Row-Level Security with Prisma

Prisma doesn't have built-in RLS, but implement it with a middleware/extension pattern:

```typescript
// src/server/db.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Workspace-scoped query helper
export function workspaceScope(workspaceId: string) {
  return {
    where: { workspaceId },
  };
}

// Always include workspace filter in queries
export async function getProjectsForWorkspace(workspaceId: string, userId: string) {
  // First verify membership
  const member = await prisma.workspaceMember.findUniqueOrThrow({
    where: { userId_workspaceId: { userId, workspaceId } },
  });

  return prisma.project.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: 'desc' },
  });
}
```

### Input Sanitization

- Always use Zod schemas at Server Action boundaries
- Sanitize rich text content (strip dangerous HTML if rendering as HTML)
- Use Prisma parameterized queries (never construct raw SQL from user input)
- Validate file uploads (size limits, allowed MIME types)

---

## 11. Common Pitfalls & Solutions

### Pitfall 1: N+1 Queries in Prisma

**Problem**: Fetching issues then looping to get assignees, labels, etc.

**Solution**: Always use `include` or `select` to eager-load relations:

```typescript
// BAD - N+1
const issues = await prisma.issue.findMany({ where: { projectId } });
for (const issue of issues) {
  issue.assignee = await prisma.user.findUnique({ where: { id: issue.assigneeId } });
}

// GOOD - Single query with JOINs
const issues = await prisma.issue.findMany({
  where: { projectId },
  include: {
    assignee: { select: { id: true, name: true, image: true } },
    labels: true,
    status: true,
  },
});
```

### Pitfall 2: Drag-and-Drop Position Conflicts

**Problem**: Two users move cards simultaneously, positions conflict.

**Solution**:
- Use fractional indexing (no position number collisions)
- Optimistic UI with server reconciliation
- If positions are too close (precision limit), run a background rebalancing job

```typescript
// Periodic rebalancing
async function rebalancePositions(projectId: string, statusId: string) {
  const issues = await prisma.issue.findMany({
    where: { projectId, statusId },
    orderBy: { position: 'asc' },
  });

  const newPositions = issues.map((issue, index) => ({
    where: { id: issue.id },
    data: { position: generateNKeysBetween(null, null, issues.length)[index] },
  }));

  await prisma.$transaction(
    newPositions.map(p => prisma.issue.update(p))
  );
}
```

### Pitfall 3: Stale Board Data

**Problem**: User A moves a card, User B still sees old state.

**Solution**:
- Optimistic updates for the acting user
- Periodic polling (30s) for background sync
- `revalidatePath` after mutations
- Add a "last updated" indicator to show data freshness

### Pitfall 4: Large Board Performance

**Problem**: Projects with 500+ issues on a board render slowly.

**Solutions**:
- **Virtualization**: Use `@tanstack/react-virtual` for long lists
- **Pagination per column**: Only load first 20 issues per column, "Load more" button
- **Lazy load off-screen columns**: Only render visible columns
- **Minimal card data**: Only fetch fields shown on cards (not full descriptions)

```typescript
// Paginated board query
async function getBoardData(projectId: string, sprintId?: string) {
  const statuses = await prisma.workflowStatus.findMany({
    where: { projectId },
    orderBy: { position: 'asc' },
    include: {
      issues: {
        where: sprintId ? { sprintId } : {},
        take: 20,  // Limit per column
        orderBy: { position: 'asc' },
        select: {
          id: true,
          key: true,
          title: true,
          type: true,
          priority: true,
          position: true,
          assignee: { select: { id: true, name: true, image: true } },
          labels: { select: { id: true, name: true, color: true } },
        },
      },
      _count: { select: { issues: true } },  // Total count for "Load more"
    },
  });
  return statuses;
}
```

### Pitfall 5: Optimistic Update Rollback Confusion

**Problem**: Optimistic update shows success, server fails, UI flickers back.

**Solution**:
- Use `useOptimistic` which auto-reverts on error
- Show toast notification on server error
- Add visual indicator for pending operations (opacity, spinner)

```typescript
startTransition(async () => {
  setOptimisticColumns(moveData);
  try {
    await moveIssueAction(moveData);
  } catch (error) {
    // useOptimistic automatically reverts
    toast.error('Failed to move issue. Reverted.');
  }
});
```

### Pitfall 6: Race Conditions in Issue Key Generation

**Problem**: Two simultaneous issue creates get same key.

**Solution**: Use Prisma interactive transaction with atomic increment:

```typescript
await prisma.$transaction(async (tx) => {
  const project = await tx.project.update({
    where: { id: projectId },
    data: { issueCounter: { increment: 1 } },
  });
  // The atomic increment guarantees uniqueness
  const key = `${project.prefix}-${project.issueCounter}`;
  return tx.issue.create({ data: { ...data, key } });
});
```

### Pitfall 7: Memory Issues with Prisma Client in Development

**Problem**: Next.js hot reload creates multiple Prisma clients.

**Solution**: Use the singleton pattern:

```typescript
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

### Pitfall 8: Auth Session in Server Components vs Client Components

**Problem**: Accessing session differently in server vs client contexts.

**Solution**:
- Server Components/Actions: `const session = await auth()`
- Client Components: `useSession()` from `next-auth/react` with `SessionProvider`
- Proxy/Middleware: `auth()` callback pattern

---

## 12. Performance Optimization Strategies

### Database Level

1. **Indexes**: Add composite indexes for common query patterns (see schema above)
2. **Connection pooling**: Use PgBouncer or Prisma Accelerate for production
3. **Query optimization**: Use `select` instead of `include` when you don't need all relation fields
4. **Batch operations**: Use `createMany`, `updateMany` for bulk operations
5. **Cursor-based pagination**: More efficient than offset for large datasets

### Application Level

1. **React Server Components**: Fetch data on the server, zero client-side waterfall
2. **Streaming with Suspense**: Show board shell immediately, stream in column data
3. **Parallel data fetching**: Use `Promise.all` for independent queries in Server Components
4. **Debounced saves**: Auto-save rich text editor with 500ms debounce
5. **URL state for filters**: Use `nuqs` for filter state in URL (shareable, no client state)

### Client Level

1. **Optimistic updates**: Instant UI feedback for all mutations
2. **Virtualization**: For lists with 100+ items
3. **Image optimization**: Next.js `<Image>` for avatars and attachments
4. **Bundle splitting**: Dynamic imports for heavy components (editor, charts)
5. **Prefetching**: `<Link prefetch>` for likely navigation targets

### Caching Strategy

```typescript
// Tag-based caching for fine-grained invalidation
import { unstable_cache } from 'next/cache';

const getProjectBoard = unstable_cache(
  async (projectId: string, sprintId?: string) => {
    return prisma.workflowStatus.findMany({ /* ... */ });
  },
  ['project-board'],
  {
    tags: [`project-${projectId}-board`],
    revalidate: 60, // Stale after 60s
  }
);

// In Server Action after mutation:
revalidateTag(`project-${projectId}-board`);
```

---

## Summary of Key Recommendations

| Decision | Recommendation | Reasoning |
|----------|---------------|-----------|
| DnD library | @dnd-kit | Modern, accessible, performant, maintained |
| Rich text | Tiptap | Headless, extensible, React-native |
| Data tables | TanStack Table + shadcn | Headless + beautiful defaults |
| Charts | Recharts | React-declarative, good TS support |
| Date handling | date-fns | Tree-shakeable, immutable |
| Form management | react-hook-form + zod | Minimal re-renders, type-safe validation |
| Ordering | fractional-indexing | No reindex on card move |
| Real-time (MVP) | Polling + optimistic updates | Simple, works well for 1-50 concurrent users |
| Real-time (Scale) | SSE for notifications + polling | Add WebSockets only for collaborative editing |
| Auth | Auth.js v5 + Prisma adapter | First-party Next.js support, multiple providers |
| IDs | cuid2 | URL-safe, collision-resistant, sortable |
| URL state | nuqs | Type-safe search params for filters |
| Notifications | sonner (toasts) + DB notifications | In-app notification center + real-time toasts |
