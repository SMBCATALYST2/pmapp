# Requirements Analysis: JIRA-like Project Management App

**Project:** PMApp
**Stack:** Next.js 15 + TypeScript + PostgreSQL + Prisma + Tailwind CSS + shadcn/ui + NextAuth.js
**Date:** 2026-03-26
**Author:** Analyst (Forge Pipeline)

---

## Table of Contents

1. [Core Functional Requirements](#1-core-functional-requirements)
2. [Non-Functional Requirements](#2-non-functional-requirements)
3. [MVP Scoping & Phasing](#3-mvp-scoping--phasing)
4. [Edge Cases & Error Handling](#4-edge-cases--error-handling)
5. [Data Model Implications](#5-data-model-implications)
6. [Tech Stack Alignment](#6-tech-stack-alignment)

---

## 1. Core Functional Requirements

### A. Authentication & Authorization

| ID | Requirement | Priority | Phase |
|----|-------------|----------|-------|
| AUTH-01 | Email/password sign-up with email verification | Must | MVP |
| AUTH-02 | Sign in / sign out with session management | Must | MVP |
| AUTH-03 | OAuth sign-in (Google, GitHub) via NextAuth.js | Must | MVP |
| AUTH-04 | Password reset flow (forgot password email link) | Must | MVP |
| AUTH-05 | Workspace/organization creation on first sign-up | Must | MVP |
| AUTH-06 | Role-based access control: Owner, Admin, Member, Viewer | Must | MVP |
| AUTH-07 | Invite members via email (generates invite link or sends email) | Must | MVP |
| AUTH-08 | Accept/decline invite flow | Must | MVP |
| AUTH-09 | Manage members (change role, remove from workspace) | Should | MVP |
| AUTH-10 | API token generation for programmatic access | Could | Phase 3 |
| AUTH-11 | Two-factor authentication (TOTP) | Could | Phase 3 |

**Authorization Matrix:**

| Action | Owner | Admin | Member | Viewer |
|--------|-------|-------|--------|--------|
| Manage workspace settings | Yes | Yes | No | No |
| Manage members/roles | Yes | Yes | No | No |
| Create/delete projects | Yes | Yes | No | No |
| Edit project settings | Yes | Yes | Yes (if lead) | No |
| Create/edit issues | Yes | Yes | Yes | No |
| Delete issues | Yes | Yes | Yes (own only) | No |
| View issues/boards | Yes | Yes | Yes | Yes |
| Manage sprints | Yes | Yes | Yes | No |
| Comment on issues | Yes | Yes | Yes | Yes |

**Implementation Notes:**
- NextAuth.js handles OAuth + credentials provider
- Session stored as JWT (stateless) or database session (for revocation)
- Middleware-based route protection using Next.js middleware
- Role stored in a `WorkspaceMember` join table (user can have different roles in different workspaces)

---

### B. Workspaces & Projects

| ID | Requirement | Priority | Phase |
|----|-------------|----------|-------|
| WS-01 | Create workspace with name, slug (URL-friendly), and optional description | Must | MVP |
| WS-02 | Edit workspace name, description, and settings | Must | MVP |
| WS-03 | Delete workspace (soft delete, with confirmation and 30-day grace period) | Should | Phase 2 |
| WS-04 | Switch between workspaces (user can belong to multiple) | Must | MVP |
| WS-05 | Workspace-level settings page | Should | MVP |
| PROJ-01 | Create project with: name, key/prefix (auto-generated, editable), description, lead | Must | MVP |
| PROJ-02 | Edit project settings (name, description, key, lead, default assignee) | Must | MVP |
| PROJ-03 | Archive project (hides from active list, issues become read-only) | Should | Phase 2 |
| PROJ-04 | Delete project (soft delete, cascades to issues) | Should | Phase 2 |
| PROJ-05 | Project icon (emoji picker) and color selection | Should | MVP |
| PROJ-06 | Project key validation (unique within workspace, 2-10 uppercase letters) | Must | MVP |
| PROJ-07 | List projects with search/filter in workspace sidebar | Must | MVP |
| PROJ-08 | Starred/favorite projects (per user, shown at top of sidebar) | Should | MVP |

**URL Structure:**
```
/{workspace-slug}/projects                    # Project list
/{workspace-slug}/projects/{project-key}      # Project board
/{workspace-slug}/projects/{project-key}/settings  # Project settings
/{workspace-slug}/settings                    # Workspace settings
```

**Implementation Notes:**
- Workspace slug must be globally unique (used in URLs)
- Project key used as prefix for issue keys (e.g., PROJ-123)
- Auto-increment counter per project for issue numbering
- Sidebar navigation: workspace switcher at top, starred projects, then all projects

---

### C. Issues/Tasks

| ID | Requirement | Priority | Phase |
|----|-------------|----------|-------|
| ISS-01 | Create issue with: title (required), description (rich text) | Must | MVP |
| ISS-02 | Issue types: Task, Bug, Story, Epic | Must | MVP |
| ISS-03 | Priority levels: Urgent (P0), High (P1), Medium (P2), Low (P3), None (P4) | Must | MVP |
| ISS-04 | Status workflow: Backlog, Todo, In Progress, In Review, Done, Cancelled | Must | MVP |
| ISS-05 | Assign issue to workspace member | Must | MVP |
| ISS-06 | Labels (create, assign multiple per issue, color-coded) | Must | MVP |
| ISS-07 | Due date (with overdue highlighting) | Must | MVP |
| ISS-08 | Story points (Fibonacci: 1, 2, 3, 5, 8, 13, 21) | Should | Phase 2 |
| ISS-09 | Auto-generated issue key: {PROJECT_KEY}-{auto_increment} | Must | MVP |
| ISS-10 | Issue detail view (slide-over panel or full page) | Must | MVP |
| ISS-11 | Inline editing of all fields on detail view | Must | MVP |
| ISS-12 | Rich text editor for description (Markdown support, or Tiptap/ProseMirror) | Must | MVP |
| ISS-13 | Sub-tasks (child issues linked to parent) | Should | Phase 2 |
| ISS-14 | Parent issue selection (for sub-task creation) | Should | Phase 2 |
| ISS-15 | Issue linking: blocks, is blocked by, relates to, duplicates | Could | Phase 2 |
| ISS-16 | Comments on issues (rich text, with timestamps and author) | Must | MVP |
| ISS-17 | @mentions in comments (triggers notification) | Should | Phase 2 |
| ISS-18 | Activity log per issue (tracks all field changes with before/after values) | Must | MVP |
| ISS-19 | File attachments (images, documents) with drag-and-drop | Should | Phase 2 |
| ISS-20 | Bulk operations (select multiple issues, change status/assignee/priority) | Could | Phase 3 |
| ISS-21 | Issue templates (pre-filled forms for bug reports, feature requests) | Could | Phase 3 |
| ISS-22 | Duplicate issue detection (title similarity) | Could | Phase 3 |
| ISS-23 | Estimated time and time tracking | Could | Phase 3 |

**Issue Detail View Layout:**
```
+--------------------------------------------------+
| PROJ-123  [Type Icon] [Priority Icon]            |
| Issue Title (editable inline)                     |
+--------------------------------------------------+
| [Status Dropdown] [Assignee] [Label Tags]        |
+--------------------------------------------------+
| Description (rich text editor)                    |
|                                                   |
+--------------------------------------------------+
| Details Sidebar:                                  |
|   Status: [dropdown]     Assignee: [avatar pick]  |
|   Priority: [dropdown]   Labels: [multi-select]   |
|   Due date: [date pick]  Sprint: [dropdown]       |
|   Story pts: [input]     Parent: [issue pick]     |
|   Created: date          Updated: date            |
+--------------------------------------------------+
| Sub-tasks (collapsible list)                      |
+--------------------------------------------------+
| Activity / Comments (tabbed)                      |
|   [Comment input with rich text]                  |
|   [Activity log entries]                          |
+--------------------------------------------------+
```

**Activity Log Events:**
- Issue created
- Status changed (from -> to)
- Assignee changed
- Priority changed
- Label added/removed
- Description edited
- Comment added
- Due date set/changed
- Sprint assigned/removed
- Linked issue added/removed

**Implementation Notes:**
- Rich text: Tiptap (ProseMirror-based) with Markdown shortcuts, recommended over plain textarea
- Issue key counter stored per-project in the database (atomic increment via Prisma `$transaction`)
- Activity log as a separate table (`IssueActivity`) with polymorphic event data (JSON column)
- Attachments stored in cloud storage (S3/R2) with signed URLs; metadata in DB
- Consider debounced auto-save for description editing

---

### D. Boards & Views

| ID | Requirement | Priority | Phase |
|----|-------------|----------|-------|
| BRD-01 | Kanban board view with columns per status | Must | MVP |
| BRD-02 | Drag-and-drop issues between columns (updates status) | Must | MVP |
| BRD-03 | Drag-and-drop reordering within columns (manual sort order) | Must | MVP |
| BRD-04 | List/table view with sortable columns | Must | MVP |
| BRD-05 | Quick filters bar: assignee, priority, label, type | Must | MVP |
| BRD-06 | Filter persistence in URL query params | Should | MVP |
| BRD-07 | Customizable board columns (add/remove/reorder statuses) | Should | Phase 2 |
| BRD-08 | Swimlanes (group by assignee, priority, or none) | Could | Phase 3 |
| BRD-09 | Saved views/filters (named, shareable within project) | Could | Phase 3 |
| BRD-10 | WIP limits per column (visual warning when exceeded) | Could | Phase 3 |
| BRD-11 | Column issue count badges | Must | MVP |
| BRD-12 | Board issue cards show: key, title, assignee avatar, priority icon, type icon, labels | Must | MVP |
| BRD-13 | Click issue card to open detail view | Must | MVP |
| BRD-14 | Create issue inline from board (quick-add at column top/bottom) | Should | MVP |

**Kanban Card Design:**
```
+---------------------------------------+
| [Type] PROJ-123         [Priority]    |
| Issue title that may wrap to two      |
| lines maximum with ellipsis...        |
|                                       |
| [Label] [Label]          [Avatar]     |
+---------------------------------------+
```

**Implementation Notes:**
- Drag-and-drop: `@dnd-kit/core` + `@dnd-kit/sortable` (React-based, accessible, performant)
- Sort order stored as a fractional index (e.g., LexoRank or simple float) to avoid reindexing all items on reorder
- Board state fetched via server components with client-side interactivity for drag operations
- Optimistic UI updates on drag with server reconciliation
- List view uses a `<Table>` from shadcn/ui with column visibility toggles

---

### E. Sprints & Backlog

| ID | Requirement | Priority | Phase |
|----|-------------|----------|-------|
| SPR-01 | Create sprint with name, start date, end date, goal | Should | Phase 2 |
| SPR-02 | Start sprint (only one active sprint per project at a time) | Should | Phase 2 |
| SPR-03 | Complete sprint (move incomplete issues to backlog or next sprint) | Should | Phase 2 |
| SPR-04 | Backlog view: ordered list of unassigned-to-sprint issues | Should | Phase 2 |
| SPR-05 | Drag issues from backlog to sprint (and vice versa) | Should | Phase 2 |
| SPR-06 | Sprint board: Kanban filtered to active sprint's issues | Should | Phase 2 |
| SPR-07 | Sprint planning view: backlog + sprint side by side | Could | Phase 2 |
| SPR-08 | Sprint velocity report (story points completed per sprint) | Could | Phase 2 |
| SPR-09 | Sprint burndown chart (ideal vs actual line chart) | Could | Phase 2 |
| SPR-10 | Auto-complete sprint on end date (with confirmation) | Could | Phase 3 |

**Sprint Lifecycle:**
```
[Not Started] --> [Active] --> [Completed]
                    |
                    v (on complete)
              [Move incomplete issues: Backlog | Next Sprint]
```

**Implementation Notes:**
- Sprint is a container entity; issues have an optional `sprintId` foreign key
- Active sprint constraint: max 1 sprint with status "Active" per project (database constraint or application logic)
- Backlog = issues where `sprintId IS NULL` and `status != Done/Cancelled`
- Burndown calculated from daily snapshots of remaining story points (cron job or computed on-demand from activity log)
- Velocity = sum of story points of issues moved to "Done" during sprint date range

---

### F. Search & Filters

| ID | Requirement | Priority | Phase |
|----|-------------|----------|-------|
| SRC-01 | Global search: search issues by title/key across all projects in workspace | Must | MVP |
| SRC-02 | Search results show: issue key, title, project, status, assignee | Must | MVP |
| SRC-03 | Search-as-you-type with debounced API calls (command palette style, Cmd+K) | Must | MVP |
| SRC-04 | Advanced filter builder (visual): combine conditions with AND/OR | Could | Phase 3 |
| SRC-05 | Text query language (JQL-like): `assignee = "me" AND priority = "High"` | Could | Phase 3 |
| SRC-06 | Recent issues list (last 10 viewed, per user) | Should | Phase 2 |
| SRC-07 | Full-text search on issue descriptions and comments | Could | Phase 3 |

**Cmd+K Search UX:**
```
+------------------------------------------+
| [Search icon] Search issues...     Cmd+K |
+------------------------------------------+
| Recent:                                  |
|   PROJ-123  Fix login bug                |
|   PROJ-124  Add dark mode                |
+------------------------------------------+
| Results:                                 |
|   PROJ-456  Search results page   [DEV]  |
|   DATA-789  Search indexing       [DATA] |
+------------------------------------------+
```

**Implementation Notes:**
- MVP search: Prisma `contains` (case-insensitive) on title + issue key; adequate for < 10K issues
- Phase 3: PostgreSQL full-text search (`tsvector`/`tsquery`) on title + description + comments for better relevance
- Cmd+K: Use shadcn/ui `<CommandDialog>` (built on cmdk library)
- Recent issues tracked in a `RecentIssue` table or localStorage

---

### G. Dashboard & Reports

| ID | Requirement | Priority | Phase |
|----|-------------|----------|-------|
| DASH-01 | Personal dashboard: "My Issues" (assigned to me, grouped by status) | Should | Phase 3 |
| DASH-02 | Personal dashboard: recent activity feed | Should | Phase 3 |
| DASH-03 | Project dashboard: issue count by status (bar/pie chart) | Could | Phase 3 |
| DASH-04 | Project dashboard: issue count by priority | Could | Phase 3 |
| DASH-05 | Project dashboard: issue count by assignee | Could | Phase 3 |
| DASH-06 | Sprint burndown chart (line chart) | Could | Phase 2 |
| DASH-07 | Sprint velocity chart (bar chart, last 5 sprints) | Could | Phase 2 |

**Implementation Notes:**
- Charts: Recharts (lightweight, React-based) or Chart.js via react-chartjs-2
- Dashboard data fetched server-side with aggregate Prisma queries
- Consider caching dashboard data with revalidation (Next.js ISR or SWR)

---

### H. Notifications & Activity

| ID | Requirement | Priority | Phase |
|----|-------------|----------|-------|
| NOTIF-01 | In-app notification bell with unread count | Should | Phase 3 |
| NOTIF-02 | Notification triggers: assigned to issue, mentioned in comment, issue status changed (if watching) | Should | Phase 3 |
| NOTIF-03 | Mark notification as read/unread | Should | Phase 3 |
| NOTIF-04 | Activity feed per project (all issue changes) | Should | Phase 3 |
| NOTIF-05 | Watch/unwatch issues (auto-watch on creation/assignment) | Could | Phase 3 |
| NOTIF-06 | Email notifications (digest or real-time) | Could | Phase 3 |
| NOTIF-07 | Notification preferences (per user, per type) | Could | Phase 3 |

**Implementation Notes:**
- Notifications stored in a `Notification` table with `userId`, `type`, `data` (JSON), `read` boolean, `createdAt`
- Created via event hooks when issues are mutated (server actions or API routes trigger notification creation)
- Real-time: consider Server-Sent Events (SSE) or polling; WebSockets are overkill for MVP
- Email: Resend or Nodemailer with queue (Phase 3)

---

## 2. Non-Functional Requirements

### Performance

| ID | Requirement | Target | Phase |
|----|-------------|--------|-------|
| PERF-01 | Kanban board initial load (with 500 issues) | < 2 seconds | MVP |
| PERF-02 | Issue detail view load | < 500ms | MVP |
| PERF-03 | Search results return | < 300ms | MVP |
| PERF-04 | Drag-and-drop status update (optimistic) | < 100ms perceived | MVP |
| PERF-05 | API response times (p95) | < 500ms | MVP |
| PERF-06 | Support up to 50 concurrent users per workspace | Seamless | Phase 2 |

**Strategies:**
- Server components for initial data loading (no client-side waterfall)
- Pagination: board loads max 50 issues per column (with "load more")
- List view: cursor-based pagination (50 items per page)
- Database indexes on: `(projectId, status)`, `(projectId, assigneeId)`, `(workspaceId, title)`, `(projectId, sortOrder)`
- React Query / SWR for client-side cache and optimistic updates

### Responsiveness

| ID | Requirement | Target | Phase |
|----|-------------|--------|-------|
| RESP-01 | Desktop layout (1024px+) | Full feature set | MVP |
| RESP-02 | Tablet layout (768-1023px) | Collapsible sidebar, stacked layout | MVP |
| RESP-03 | Mobile layout (< 768px) | Basic issue list/detail; no drag-and-drop | Phase 2 |

**Notes:**
- Kanban board: horizontal scroll on smaller screens
- Sidebar: collapsible on tablet, hidden on mobile with hamburger menu
- Issue detail: full-width on mobile, slide-over panel on desktop

### Accessibility (WCAG 2.1 AA)

| ID | Requirement | Phase |
|----|-------------|-------|
| A11Y-01 | Keyboard navigation for all interactive elements | MVP |
| A11Y-02 | ARIA labels on all form controls and buttons | MVP |
| A11Y-03 | Focus management on modal/panel open/close | MVP |
| A11Y-04 | Color contrast ratio >= 4.5:1 for text | MVP |
| A11Y-05 | Screen reader compatible (semantic HTML, ARIA live regions for updates) | MVP |
| A11Y-06 | Drag-and-drop keyboard alternative (move issue via context menu) | MVP |
| A11Y-07 | Reduced motion support (respect `prefers-reduced-motion`) | MVP |

**Notes:**
- shadcn/ui components are built on Radix UI (accessible primitives) -- good baseline
- @dnd-kit supports keyboard-based drag-and-drop natively
- Run axe-core audits during development

### Security (OWASP Top 10)

| ID | Requirement | Mitigation | Phase |
|----|-------------|------------|-------|
| SEC-01 | Injection (SQL, XSS) | Prisma parameterized queries; DOMPurify for rich text output | MVP |
| SEC-02 | Broken authentication | NextAuth.js; bcrypt password hashing; secure cookie settings | MVP |
| SEC-03 | Sensitive data exposure | HTTPS enforced; passwords never logged; secrets in env vars | MVP |
| SEC-04 | Broken access control | Middleware auth checks; per-route role validation; row-level security via Prisma middleware | MVP |
| SEC-05 | Security misconfiguration | Helmet headers; CORS restricted; CSP policy | MVP |
| SEC-06 | Cross-Site Request Forgery | NextAuth.js CSRF tokens; SameSite cookie attribute | MVP |
| SEC-07 | Rate limiting | Rate limit auth endpoints (5 attempts/min); general API rate limit | Phase 2 |
| SEC-08 | Input validation | Zod schemas for all API inputs (server-side) | MVP |
| SEC-09 | File upload security | File type allowlist; size limit (10MB); virus scan (optional) | Phase 2 |
| SEC-10 | Audit logging | Log sensitive operations (member changes, deletions) | Phase 3 |

### Data Integrity

| ID | Requirement | Phase |
|----|-------------|-------|
| DINT-01 | Optimistic locking: `updatedAt` version check on issue updates (409 on conflict) | MVP |
| DINT-02 | Soft deletes for issues and projects (`deletedAt` timestamp) | MVP |
| DINT-03 | Database referential integrity (foreign keys, cascading rules) | MVP |
| DINT-04 | Unique constraints: workspace slug, project key within workspace, issue key within project | MVP |
| DINT-05 | Transactions for multi-table operations (e.g., sprint completion) | Phase 2 |

---

## 3. MVP Scoping & Phasing

### Phase 1 -- MVP (Target: 4-6 weeks)

**Goal:** A working app where a team can sign up, create a project, manage issues on a Kanban board, and collaborate via comments.

| Module | Included Features |
|--------|-------------------|
| Auth | Sign up (email/password + Google/GitHub OAuth), sign in, sign out, workspace creation on signup |
| Authorization | Role-based access (Owner, Admin, Member, Viewer), invite members via email |
| Workspaces | Create/edit workspace, workspace sidebar with project list |
| Projects | Create/edit project, project key, icon/color, star/favorite |
| Issues | Full CRUD, all fields (title, description, type, priority, status, assignee, labels, due date), auto-generated issue key, rich text description, comments, activity log |
| Kanban Board | Drag-and-drop columns by status, issue cards with key/title/assignee/priority, quick filters |
| List View | Sortable table view with basic filtering |
| Search | Cmd+K global search by title/key |
| UI/UX | Responsive desktop/tablet layout, dark/light mode, accessible components |

**MVP Page Map:**
```
/                           -> Redirect to workspace
/sign-in                    -> Sign in page
/sign-up                    -> Sign up page
/create-workspace           -> Workspace creation (post-signup)
/invite/[token]             -> Accept invite page
/[workspace]/               -> Redirect to first project or project list
/[workspace]/projects       -> Project list
/[workspace]/projects/new   -> Create project
/[workspace]/project/[key]  -> Kanban board (default view)
/[workspace]/project/[key]/list     -> List view
/[workspace]/project/[key]/settings -> Project settings
/[workspace]/settings       -> Workspace settings
/[workspace]/settings/members -> Member management
```

### Phase 2 -- Team Workflows (Target: 3-4 weeks after MVP)

| Module | Features |
|--------|----------|
| Sprints | Create/start/complete sprints, backlog view, sprint board, sprint planning |
| Sub-tasks | Parent-child issue relationships |
| Issue Links | Blocks, is blocked by, relates to, duplicates |
| Attachments | File upload with drag-and-drop, image preview |
| Reports | Sprint burndown chart, velocity chart |
| Search | Recent issues, full-text search improvements |
| Project Mgmt | Archive/delete projects, soft delete issues |
| Performance | Rate limiting, pagination optimization |

### Phase 3 -- Power Features (Target: 4-6 weeks after Phase 2)

| Module | Features |
|--------|----------|
| Dashboard | Personal dashboard, project dashboard with charts |
| Notifications | In-app notification system, watch/unwatch, email notifications |
| Advanced Filters | Visual filter builder, JQL-like query language, saved views |
| Board Enhancements | Swimlanes, WIP limits, custom columns |
| Bulk Operations | Multi-select issues, bulk update |
| Templates | Issue templates |
| API | REST/public API with token auth |
| Real-time | Live updates via SSE (board changes, new comments) |
| Audit | Full audit logging |

---

## 4. Edge Cases & Error Handling

### Empty States

| Context | Behavior |
|---------|----------|
| No workspaces | Redirect to workspace creation flow after sign-up |
| No projects in workspace | Show "Create your first project" CTA with illustration |
| No issues in project | Show empty board with "Create your first issue" prompt per column or centered CTA |
| No issues matching filter | Show "No issues match your filters" with a "Clear filters" button |
| No sprints | Show "Create a sprint to start planning" in backlog view |
| No comments on issue | Show "Be the first to comment" placeholder |
| No members besides owner | Show "Invite your team" banner in workspace settings |

### Concurrent Editing

| Scenario | Handling |
|----------|----------|
| Two users edit same issue's title simultaneously | Optimistic locking: second save returns 409 Conflict; UI shows "This issue has been updated by [user]. Reload to see changes." with option to overwrite or reload |
| Two users drag same issue to different columns | Last-write-wins with optimistic UI; both see their change briefly, then reconcile on next fetch (polling or SSE) |
| User edits issue that was deleted | On save, return 404; UI shows "This issue has been deleted" and redirects to board |

### Deletion Cascades

| Scenario | Handling |
|----------|----------|
| Delete issue that has sub-tasks | Soft delete parent; sub-tasks become orphaned (parent field set to null) with a banner "Parent issue was deleted" |
| Delete issue that blocks another | Remove link; unblocked issue shows activity log entry "Blocking issue PROJ-123 was deleted" |
| Delete assignee (remove member from workspace) | Unassign from all their issues; issues show "Unassigned"; activity log records the change |
| Archive project with active sprint | Require completing/cancelling active sprint before archiving; or auto-complete sprint on archive |
| Delete label used on issues | Remove label from all issues; soft delete the label entity |

### Large Data Scenarios

| Scenario | Handling |
|----------|----------|
| Board with 100+ issues per column | Paginate: show first 50 per column with "Load 50 more" button; virtual scrolling not needed for MVP |
| Board with 500+ total issues | Server-side filtering: only fetch issues matching current filters; lazy-load columns |
| Project with 10,000+ issues | List view: server-side pagination (cursor-based); board view: must have active filters or sprint filter |
| Workspace with 50+ projects | Sidebar: show starred first, then search/filter for others; paginate project list |
| Issue with 500+ comments | Paginate comments (newest first or oldest first with pagination) |
| Description with very long rich text | Render with max-height and "Show more" toggle; lazy-load full content |

### Input Validation Edge Cases

| Scenario | Handling |
|----------|----------|
| Project key conflicts on creation | Validate uniqueness in real-time (debounced); show inline error |
| Issue title empty or > 255 chars | Client + server validation via Zod; prevent form submission |
| Due date in the past | Allow it (may be intentional for tracking); show warning indicator |
| Assigning issue to removed member | Validation on server; return 400 with message |
| Cyclic issue links (A blocks B, B blocks A) | Detect cycle on link creation; prevent with error message |
| Duplicate project key after workspace merge | Not applicable in MVP (no workspace merge feature) |

---

## 5. Data Model Implications

Based on the requirements above, the primary entities needed are:

```
User
Workspace
WorkspaceMember (join: User <-> Workspace, with role)
WorkspaceInvite
Project
Issue
IssueComment
IssueActivity
IssueLink (Phase 2)
Label
IssueLabel (join: Issue <-> Label)
Sprint (Phase 2)
Notification (Phase 3)
SavedFilter (Phase 3)
Attachment (Phase 2)
RecentIssue (Phase 2)
```

**Key Design Decisions:**
- Issue sort order: Use a `sortOrder` float column for drag-and-drop reordering (LexoRank-style approach avoids reindexing)
- Issue counter: Per-project auto-increment stored as `issueCounter` on the `Project` model (incremented atomically in a transaction)
- Activity log: Polymorphic `IssueActivity` table with `field`, `oldValue`, `newValue` text columns (or a JSON `data` column)
- Soft deletes: `deletedAt` nullable timestamp on `Issue`, `Project`, `Workspace`
- Multi-tenancy: All queries scoped by `workspaceId` (Prisma middleware or explicit where clauses)

---

## 6. Tech Stack Alignment

| Requirement | Tech Solution |
|-------------|---------------|
| Auth (OAuth + credentials) | NextAuth.js v5 (Auth.js) with Prisma adapter |
| Database ORM | Prisma with PostgreSQL |
| UI Components | shadcn/ui (Radix UI primitives + Tailwind) |
| Drag-and-drop | @dnd-kit/core + @dnd-kit/sortable |
| Rich text editor | Tiptap (ProseMirror-based) with Markdown support |
| Command palette | cmdk (via shadcn/ui CommandDialog) |
| Form validation | Zod (shared schemas for client + server) |
| Data fetching | Server Components + Server Actions (Next.js 15) |
| Client-side cache | TanStack Query (React Query) for optimistic updates |
| Charts (Phase 2+) | Recharts |
| File storage (Phase 2+) | S3-compatible (Cloudflare R2 or AWS S3) |
| Email (Phase 3) | Resend |
| Deployment | Vercel (frontend) + managed PostgreSQL (Neon, Supabase, or Railway) |

---

## Summary

This requirements document defines **78 functional requirements** across 8 modules and **26 non-functional requirements** spanning performance, responsiveness, accessibility, security, and data integrity. The MVP (Phase 1) includes **40 must/should requirements** covering auth, workspaces, projects, full issue CRUD, Kanban board with drag-and-drop, list view, and global search -- representing a fully functional project management tool. Phases 2 and 3 add sprints, reports, advanced search, dashboards, notifications, and real-time collaboration.
