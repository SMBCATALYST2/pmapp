# Performance Review -- pmapp

**Reviewer**: PerfReviewer (Forge Pipeline)
**Date**: 2026-03-26
**Stack**: Next.js 16 + Prisma 7 + PostgreSQL + @dnd-kit + @tanstack/react-table

---

## Summary

Found **5 CRITICAL**, **8 HIGH**, **10 MEDIUM**, and **6 LOW** performance issues across queries, actions, React components, schema design, and caching strategy. The most impactful problems are: (1) a dashboard query that fetches ALL issues into memory to count by status category, (2) redundant `getWorkspaceBySlug` calls in nested layouts creating waterfall queries, (3) unbounded board queries with no column-level pagination, (4) client-side filtering that duplicates server-side data, and (5) extra DB round-trips for `revalidatePath` slug lookups in every server action.

---

## CRITICAL

### C1. Dashboard `issuesByCategoryRaw` fetches ALL issues into memory

- **Impact**: CRITICAL
- **File**: `src/server/queries/dashboard-queries.ts:92-97`
- **Issue**: To compute `issuesByStatusCategory`, the code runs `db.issue.findMany(...)` selecting the full `status.category` for every active issue in the workspace, then loops over them in JS to count. For a workspace with 10,000+ issues, this loads 10,000+ rows into Node.js memory on every dashboard load. Meanwhile, the `issuesByPriority` and `issuesByType` queries properly use `groupBy`.
- **Fix**: Replace with a `groupBy` through the relation or a raw SQL query:
  ```ts
  // Option A: Raw SQL (most efficient -- single pass)
  const issuesByCategoryRaw = await db.$queryRaw`
    SELECT ws."category", COUNT(i."id")::int as count
    FROM "Issue" i
    JOIN "WorkflowStatus" ws ON i."statusId" = ws."id"
    JOIN "Project" p ON i."projectId" = p."id"
    WHERE i."deletedAt" IS NULL
      AND p."workspaceId" = ${workspaceId}
      AND p."deletedAt" IS NULL
    GROUP BY ws."category"
  `;
  ```
  This avoids transferring all rows and counting in JS.

### C2. Redundant `getWorkspaceBySlug` calls in nested layouts (waterfall)

- **Impact**: CRITICAL
- **File**: `src/app/(dashboard)/[workspaceSlug]/layout.tsx`, `src/app/(dashboard)/[workspaceSlug]/[projectKey]/layout.tsx`, plus every page (`board/page.tsx`, `list/page.tsx`, `issues/[issueKey]/page.tsx`, `settings/page.tsx`, `settings/members/page.tsx`, `projects/page.tsx`, `projects/new/page.tsx`, `[projectKey]/settings/page.tsx`)
- **Issue**: Every nested Server Component calls `await getWorkspaceBySlug(workspaceSlug)` independently. For a board page, the request chain is:
  1. `WorkspaceLayout` calls `getWorkspaceBySlug` (1 DB query + auth)
  2. `ProjectLayout` calls `getWorkspaceBySlug` (duplicate) + `getProjectByKey`
  3. `BoardPage` calls `getWorkspaceBySlug` (triplicate) + `getBoardData` + `getWorkspaceMembers` + `getLabels`

  Each `getWorkspaceBySlug` internally calls `requireAuth()` + `db.workspace.findUnique` + `db.workspaceMember.findUnique` = 3 DB queries x3 = **9 redundant DB queries** per board page load. Combined with auth session verification, this creates a significant waterfall.
- **Fix**: Use React `cache()` to deduplicate per-request:
  ```ts
  import { cache } from "react";
  export const getWorkspaceBySlug = cache(async (slug: string) => { ... });
  ```
  Also apply to `requireAuth()`, `getProjectByKey()`, and `requireWorkspaceMember()`. Next.js automatically deduplicates `fetch()` calls but NOT Prisma queries; the `cache()` wrapper is needed.

### C3. `getProjectIssues` called without workspaceId or pagination on list page

- **Impact**: CRITICAL
- **File**: `src/app/(dashboard)/[workspaceSlug]/[projectKey]/list/page.tsx:26`
- **Issue**: The list page calls `getProjectIssues(project.id)` which maps to `getIssuesByProject(workspaceId, projectId, options)`. But the call passes only `project.id` as the first arg, meaning `workspaceId = project.id` and `projectId = undefined`. This is a **signature mismatch** that will either error or return empty results. Even if corrected, there is no pagination -- it loads all issues at once for the data table.
- **Fix**: Fix the call to `getIssuesByProject(workspace.id, project.id)` and add server-side pagination with cursor-based loading for the data table.

### C4. `getIssueByKey` called without workspaceId

- **Impact**: CRITICAL
- **File**: `src/app/(dashboard)/[workspaceSlug]/[projectKey]/issues/[issueKey]/page.tsx:22`
- **Issue**: `getIssueByKey(issueKey)` maps to `getIssue(workspaceId, issueKey)` but is called with only one argument. `workspaceId` is `issueKey` and `issueKey` is `undefined`. This is broken.
- **Fix**: `getIssueByKey(workspace.id, issueKey)`.

### C5. Dashboard `recentActivity` has nested async `await` inside `Promise.all`

- **Impact**: CRITICAL
- **File**: `src/server/queries/dashboard-queries.ts:100-108`
- **Issue**: The 6th element of the `Promise.all` array contains an inline `await` for project IDs:
  ```ts
  projectId: {
    in: await db.project.findMany(...)
      .then(ps => ps.map(p => p.id))
  }
  ```
  This `await` runs **inside** the `Promise.all` definition, which means it executes sequentially BEFORE the `Promise.all` even starts. The project ID lookup blocks ALL 6 parallel queries. Additionally, this is an N+1 pattern -- first query all projects, then query activities.
- **Fix**: Extract the project ID lookup into a separate `const` before the `Promise.all`, or better, join through the relation:
  ```ts
  // Move project ID fetch before Promise.all
  const projectIds = await db.project.findMany({
    where: { workspaceId, deletedAt: null },
    select: { id: true },
  }).then(ps => ps.map(p => p.id));

  const [..., recentActivity] = await Promise.all([
    ...,
    db.activity.findMany({
      where: { projectId: { in: projectIds } },
      ...
    }),
  ]);
  ```

---

## HIGH

### H1. Board query fetches ALL issues per column with no limit

- **Impact**: HIGH
- **File**: `src/server/queries/project-queries.ts:195-226` (`getBoardData`)
- **Issue**: The board data query includes all issues per status column with no `take` limit. If a column (e.g., "Backlog") has 5,000 issues, all 5,000 are loaded and sent to the client. The board view displays them all in a scrollable column, which is both a DB and rendering performance problem.
- **Fix**: Add `take: 50` (or configurable) to the issues include and return a `hasMore` flag per column:
  ```ts
  issues: {
    where: issueWhere as any,
    take: 50, // Load first 50 per column
    orderBy: { position: "asc" },
    select: { ... },
  },
  ```
  Add infinite scroll / "load more" per column on the client.

### H2. Comments and activities loaded client-side with N+1 pattern

- **Impact**: HIGH
- **File**: `src/components/issues/issue-comments.tsx:29-41`, `src/components/issues/issue-activity.tsx:18-30`
- **Issue**: Both components are `"use client"` and load data via `useEffect` calling server queries (`getIssueComments`, `getIssueActivities`). Each of these queries first runs a verification query (`db.issue.findFirst`) to confirm workspace membership, then runs the actual data query -- so each is 2 sequential DB calls. These happen after the page renders, creating a loading waterfall: page HTML -> client hydrate -> fetch comments -> fetch activities.
- **Fix**: Load comments and activities server-side in the issue detail page and pass as props. Or use `React.Suspense` with server components for streaming. This eliminates the client-side waterfall and the double verification queries.

### H3. `revalidatePath` + extra DB query for workspace slug in every action

- **Impact**: HIGH
- **File**: `src/server/actions/issue-actions.ts:157-162`, `src/server/actions/issue-actions.ts:377-386`, `src/server/actions/issue-actions.ts:447-452`, `src/server/actions/issue-actions.ts:522-528`, `src/server/actions/issue-actions.ts:567-571`, `src/server/actions/project-actions.ts:108-112`, `src/server/actions/comment-actions.ts:92-99`, `src/server/actions/label-actions.ts:69-73`, `src/server/actions/workspace-actions.ts:196-201` (and many more)
- **Issue**: After every mutation, each action calls `db.workspace.findUnique({ where: { id: workspaceId }, select: { slug: true } })` just to construct the `revalidatePath` URL. This is an extra DB query per action that could be avoided.
- **Fix**: Pass `workspaceSlug` through from the caller (it's available in every page), or cache it from the earlier workspace lookup in the same action. Alternatively, use `revalidateTag()` instead of `revalidatePath()` for more granular and slug-independent cache invalidation.

### H4. Search uses Prisma `contains` instead of PostgreSQL full-text search

- **Impact**: HIGH
- **File**: `src/server/queries/issue-queries.ts:117-121`, `src/app/api/search/route.ts:78-82`
- **Issue**: The search queries use `{ contains: query, mode: "insensitive" }` which translates to `ILIKE '%query%'`. This is a sequential scan that cannot use the GIN full-text search indexes that were explicitly created in `prisma/migrations/00000000000000_custom_indexes/migration.sql`. The full-text indexes exist but are never used.
- **Fix**: Use `$queryRaw` with `to_tsquery` for the search queries:
  ```ts
  const results = await db.$queryRaw`
    SELECT i."id", i."key", i."title", ...
    FROM "Issue" i
    WHERE to_tsvector('english', coalesce(i."title", '') || ' ' || coalesce(i."descriptionText", ''))
          @@ plainto_tsquery('english', ${query})
      AND i."deletedAt" IS NULL
      AND i."projectId" IN (SELECT id FROM "Project" WHERE "workspaceId" = ${workspaceId} AND "deletedAt" IS NULL)
    ORDER BY ts_rank(...) DESC
    LIMIT ${limit}
  `;
  ```

### H5. `getProjects` called with wrong arity on projects page

- **Impact**: HIGH
- **File**: `src/app/(dashboard)/[workspaceSlug]/projects/page.tsx:22`
- **Issue**: `getProjects(workspace.id, session.user.id)` is called with 2 arguments, but `getProjects` only accepts 1 argument (`workspaceId`). The session.userId is handled internally via `requireAuth()`. This extra arg is silently ignored, but reveals a pattern of confusion in the codebase. The function internally calls `requireAuth()` which calls `auth()` again -- a redundant auth check since the page already called `auth()`.
- **Fix**: Call `getProjects(workspace.id)` and deduplicate auth via `cache()` (see C2).

### H6. Prisma `$use` middleware converts `findUnique` to `findFirst` for soft-delete

- **Impact**: HIGH
- **File**: `src/lib/db/index.ts:46-59`
- **Issue**: The soft-delete middleware intercepts every `findUnique`/`findUniqueOrThrow` on `Issue` and `Project` models and converts them to `findFirst` to support the `deletedAt` filter. This is problematic because:
  1. `findUnique` uses the primary key index directly; `findFirst` does not have the same query plan guarantee.
  2. This applies to EVERY `findUnique` on these models, even when the caller already has `deletedAt: null` in the where clause, causing unnecessary overhead.
  3. Auth-related queries and internal Prisma operations on these models are all affected.
- **Fix**: Remove the middleware and explicitly add `deletedAt: null` in queries (which is already done in most places). Alternatively, use Prisma's built-in soft-delete feature (available in newer versions) or use Prisma Client Extensions instead of middleware for better performance.

### H7. Board client-side filtering duplicates server-side filter capability

- **Impact**: HIGH
- **File**: `src/components/boards/board-view.tsx:73-82`
- **Issue**: `BoardView` applies client-side filtering over the full dataset:
  ```ts
  const filteredColumns = columns.map((col) => ({
    ...col,
    issues: col.issues.filter((issue) => { ... }),
  }));
  ```
  Meanwhile, `getBoardData` already supports server-side `filters` parameter. The board page does not pass filters to the server -- all issues are loaded then filtered on the client. For large projects (1000+ issues), this means transferring and parsing unnecessary data.
- **Fix**: Wire the board filters as URL search params (using `nuqs`) and pass them to `getBoardData` server-side. Only do client-side filtering for instant optimistic updates before the server response returns.

### H8. Every server action re-fetches the workspace slug for revalidation

- **Impact**: HIGH
- **File**: Multiple action files (see H3 for full list)
- **Issue**: `moveIssue`, `reorderIssue`, `createIssue`, `updateIssue`, `deleteIssue`, `createComment`, `updateComment`, `deleteComment`, `createLabel`, `updateLabel`, `deleteLabel`, `createProject`, `updateProject`, `archiveProject`, `toggleProjectFavorite`, `changeMemberRole`, `removeMember`, `inviteMember` -- all perform an extra `db.workspace.findUnique` at the end just for `revalidatePath`. That is 18+ actions each making a redundant query.
- **Fix**: Same as H3. Store the slug in a local variable from the earlier workspace lookup, or accept it as an input parameter.

---

## MEDIUM

### M1. Board column component not memoized

- **Impact**: MEDIUM
- **File**: `src/components/boards/board-column.tsx`
- **Issue**: `BoardColumn` is a non-memoized component rendered inside a `.map()` in `BoardView`. When any issue is dragged, `setColumns` triggers re-render of ALL columns, even those that did not change. With 5-6 columns and 50+ cards each, this causes unnecessary React reconciliation work.
- **Fix**: Wrap `BoardColumn` in `React.memo` with a custom comparator that checks column ID and issues array reference:
  ```ts
  export const BoardColumn = React.memo(function BoardColumn(...) { ... }, (prev, next) => {
    return prev.column === next.column;
  });
  ```

### M2. Board card component not memoized

- **Impact**: MEDIUM
- **File**: `src/components/boards/board-card.tsx`
- **Issue**: Similar to M1, `BoardCard` re-renders for every parent column re-render. Each card uses `useSortable` hook, which adds overhead. During drag operations, this causes frame drops.
- **Fix**: Wrap in `React.memo`. The `useSortable` hook uses identity-based comparison internally, so memoization of the wrapper helps.

### M3. `filteredColumns` recomputed on every render in `BoardView`

- **Impact**: MEDIUM
- **File**: `src/components/boards/board-view.tsx:73-82`
- **Issue**: `filteredColumns` is computed inline (not memoized) on every render. With many issues, the filter operation runs on each keystroke/drag/state change.
- **Fix**: Wrap in `useMemo`:
  ```ts
  const filteredColumns = useMemo(() => columns.map((col) => ({
    ...col,
    issues: col.issues.filter((issue) => { ... }),
  })), [columns, filterAssignee, filterPriority, filterType, filterLabel]);
  ```

### M4. Missing Suspense boundaries for streaming

- **Impact**: MEDIUM
- **File**: `src/app/(dashboard)/[workspaceSlug]/[projectKey]/board/page.tsx`, `list/page.tsx`, `issues/[issueKey]/page.tsx`
- **Issue**: Page-level Server Components perform `Promise.all` for all data before rendering. If any query is slow (e.g., `getWorkspaceMembers`), the entire page is blocked. No Suspense boundaries exist for partial streaming.
- **Fix**: Wrap independent data sections in Suspense:
  ```tsx
  <Suspense fallback={<BoardSkeleton />}>
    <BoardDataLoader workspaceId={...} projectKey={...} />
  </Suspense>
  ```
  Loading files exist (`board/loading.tsx`, `list/loading.tsx`) but they only show during full page transitions, not for streaming within a page.

### M5. `date-fns` functions imported individually but tree-shaking may not work

- **Impact**: MEDIUM
- **File**: `src/components/boards/board-card.tsx:10`
- **Issue**: `import { format, isPast, isWithinInterval, addDays } from "date-fns"` -- while this looks tree-shakeable, `date-fns` v4 (used here) can still pull in locale data. Each `BoardCard` instance uses `format`, `isPast`, `isWithinInterval`, and `addDays` which together can add significant bundle size.
- **Fix**: Verify bundle size with `bun build --analyze`. Consider using native `Date` comparisons for `isPast` (simple `date < now`) and `isWithinInterval` instead of pulling in date-fns for simple comparisons. Keep `format` for display.

### M6. `lucide-react` icons imported in 30+ files

- **Impact**: MEDIUM
- **File**: 30+ component files (see grep results)
- **Issue**: `lucide-react` icons are imported individually across 30+ files. While lucide-react supports tree-shaking, the total icon count (30+ unique icons) and the lack of dynamic imports means all icons are included in the client bundle.
- **Fix**: Consider using `next/dynamic` for heavy icon sets in components that are not immediately visible (e.g., dialog icons, filter popover icons). For the most common icons (Loader2, Plus, etc.), tree-shaking is sufficient.

### M7. No `next/image` usage anywhere

- **Impact**: MEDIUM
- **File**: Entire codebase
- **Issue**: Grep shows zero usage of `next/image`. User avatars in `UserAvatar` component likely render raw `<img>` tags without automatic optimization (lazy loading, format conversion, size optimization, blur placeholders).
- **Fix**: Use `next/image` for all avatar/image rendering:
  ```tsx
  import Image from "next/image";
  <Image src={image} alt={name} width={32} height={32} className="rounded-full" />
  ```

### M8. `IssuesDataTable` loads all issues without virtualization

- **Impact**: MEDIUM
- **File**: `src/components/issues-table/issues-data-table.tsx`
- **Issue**: The data table renders all rows in the DOM at once. With 500+ issues, this creates hundreds of DOM nodes, each containing multiple sub-components (icons, badges, avatars, links). No row virtualization is used.
- **Fix**: Add `@tanstack/react-virtual` for row virtualization:
  ```ts
  import { useVirtualizer } from "@tanstack/react-virtual";
  ```
  Or implement pagination server-side (see C3) and show 50 rows at a time.

### M9. Sidebar data fetched via missing `/api/sidebar` endpoint

- **Impact**: MEDIUM
- **File**: `src/hooks/use-sidebar-data.ts:29`
- **Issue**: The `useSidebarData` hook fetches from `/api/sidebar` but no such API route exists in the codebase (`src/app/api/` only has `auth/` and `search/`). This means the sidebar always shows loading state or empty projects. This is a correctness bug that causes a wasted network request on every page load.
- **Fix**: Create `src/app/api/sidebar/route.ts` that returns workspace list and sidebar projects. Or better, load sidebar data server-side in `DashboardLayout` and pass via React context or a server component.

### M10. `WorkspaceLayout` calls `getWorkspaceBySlug` but does nothing with result

- **Impact**: MEDIUM
- **File**: `src/app/(dashboard)/[workspaceSlug]/layout.tsx:10-22`
- **Issue**: The workspace layout fetches the full workspace object, verifies membership, then just renders `<>{children}</>` without passing any data down. The workspace data is fetched again by every child page. This layout exists only for authorization, but creates a wasted query.
- **Fix**: Either remove this layout (rely on middleware for auth) or use React `cache()` so the child pages share the same result.

---

## LOW

### L1. `useCallback` and `useMemo` missing in `BoardView` handlers

- **Impact**: LOW
- **File**: `src/components/boards/board-view.tsx:86-185`
- **Issue**: `handleDragStart`, `handleDragEnd`, `handleDragOver`, and `findIssue` are regular functions recreated on every render. While React's reconciliation handles this, the DndContext's `onDragStart`/`onDragEnd`/`onDragOver` props receive new references each time, potentially causing unnecessary child re-renders.
- **Fix**: Wrap handlers in `useCallback`.

### L2. Prisma query logging enabled in development

- **Impact**: LOW
- **File**: `src/lib/db/index.ts:18`
- **Issue**: `log: ['query', 'error', 'warn']` in development logs every SQL query to stdout. While useful for debugging, this adds I/O overhead during development and can slow down the dev server with many queries.
- **Fix**: Use `['error', 'warn']` by default and enable `'query'` only via env var:
  ```ts
  log: process.env.PRISMA_LOG_QUERIES ? ['query', 'error', 'warn'] : ['error', 'warn']
  ```

### L3. Rate limit store has no periodic cleanup

- **Impact**: LOW
- **File**: `src/lib/auth/helpers.ts:141-160`
- **Issue**: The in-memory rate limit `Map` only cleans up when size exceeds 10,000 entries. In a long-running server, stale entries accumulate until the threshold, causing a brief pause during cleanup.
- **Fix**: Use a `setInterval` cleanup or an LRU-based approach. For production, migrate to Redis-based rate limiting as noted in the code.

### L4. `CommandMenu` search URL parameters don't match API route

- **Impact**: LOW
- **File**: `src/components/search/command-menu.tsx:48`
- **Issue**: The command menu fetches `/api/search?workspace=...&q=...` but the search API route at `src/app/api/search/route.ts` expects `?workspaceId=...&query=...`. Parameter names don't match, so search will always fail with a validation error.
- **Fix**: Align parameter names. Either change the fetch URL or the API route.

### L5. `boardData.columns` used as revert state but never updated

- **Impact**: LOW
- **File**: `src/components/boards/board-view.tsx:172-176`
- **Issue**: On drag failure, the board reverts to `boardData.columns` (the initial prop). If the user has already done successful drags that updated `columns` state, reverting goes back to the initial load state, not the last known good state.
- **Fix**: Track last-known-good state separately:
  ```ts
  const [lastGoodColumns, setLastGoodColumns] = useState(boardData.columns);
  // After successful move: setLastGoodColumns(columns);
  // On error: setColumns(lastGoodColumns);
  ```

### L6. `@prisma/client` import path uses relative path to `generated/`

- **Impact**: LOW
- **File**: `src/lib/db/index.ts:8`
- **Issue**: `import { PrismaClient } from '../../../generated/prisma'` uses a deep relative path. While functional, this can break if file is moved and doesn't leverage the standard `@prisma/client` import that Prisma sets up.
- **Fix**: This is a configuration choice (custom output directory). Ensure the `tsconfig.json` paths alias `@prisma/client` to `generated/prisma` for cleaner imports.

---

## Schema Index Coverage

The schema has good index coverage overall. Missing indexes:

| Pattern | Current Index | Status |
|---------|--------------|--------|
| Issue by projectId + statusId + position | `@@index([projectId, statusId, position])` | OK |
| Issue by projectId + assigneeId | `@@index([projectId, assigneeId])` | OK |
| Issue by key | `@unique` (key) | OK |
| Issue by projectId + number | `@@unique([projectId, number])` | OK |
| Issue full-text search | GIN index (custom migration) | OK (but unused -- see H4) |
| Comment by issueId + createdAt | `@@index([issueId, createdAt])` | OK |
| Activity by issueId + createdAt | `@@index([issueId, createdAt])` | OK |
| Activity by projectId + createdAt | `@@index([projectId, createdAt])` | OK |
| Label by workspaceId + name | `@@unique([workspaceId, name])` | OK |
| **Issue by deletedAt** | **MISSING** | **Add `@@index([deletedAt])` or composite indexes including deletedAt** |
| **Project by deletedAt** | **MISSING** | **Same -- every query filters on deletedAt** |

**Recommendation**: Add partial indexes for soft-delete filtering:
```sql
CREATE INDEX "Issue_active_idx" ON "Issue" ("projectId", "statusId", "position") WHERE "deletedAt" IS NULL;
CREATE INDEX "Project_active_idx" ON "Project" ("workspaceId") WHERE "deletedAt" IS NULL;
```
These partial indexes are smaller and faster than full indexes because they only index non-deleted rows.

---

## Caching Strategy Assessment

**Current approach**: `revalidatePath()` after every mutation. No `revalidateTag()`, `unstable_cache()`, or `cache()` usage.

**Problems**:
1. `revalidatePath` is coarse -- it invalidates the entire page, not specific data
2. No deduplication of data fetches within a request (see C2)
3. No time-based caching for rarely-changing data (workspace metadata, labels, project statuses)
4. The sidebar makes a client-side fetch on every navigation, with no SWR/cache layer

**Recommendations**:
1. Use React `cache()` for per-request dedup of `getWorkspaceBySlug`, `requireAuth`, `getProjectByKey`
2. Use `unstable_cache()` with tags for workspace/project metadata (TTL: 60s, tag: `workspace:${id}`)
3. Use `revalidateTag()` instead of `revalidatePath()` for granular invalidation
4. Add `staleTime: 5 * 60 * 1000` to the React Query client for sidebar data (already has 60s)

---

## Priority Fix Order

1. **C2** -- Add `cache()` wrappers (immediate, biggest multiplier)
2. **C3/C4** -- Fix argument mismatches (correctness + performance)
3. **C1/C5** -- Fix dashboard queries (memory + correctness)
4. **H4** -- Use full-text search indexes
5. **H1** -- Add column-level pagination for board
6. **H3/H8** -- Eliminate slug re-fetch in actions
7. **H2** -- Server-side comments/activities loading
8. **H6** -- Remove Prisma middleware, use explicit soft-delete
9. **M1/M2/M3** -- Memoize board components
10. **M9** -- Create `/api/sidebar` route or server-side sidebar
