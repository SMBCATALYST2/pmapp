# Architecture Critique: PMApp (JIRA-like Project Management)

**Reviewer:** ArchCritic (Forge Pipeline)
**Date:** 2026-03-26
**Documents Reviewed:** specification.md, contracts.md, architecture.md, strategy.md

---

## Summary

The architecture is well-structured for an MVP with solid foundations: proper multi-tenant isolation, a clean Server Component / Client Component boundary, and thoughtful indexing. However, there are 3 critical issues (client-side filtering will break at scale, missing soft-delete query exclusion mechanism, and the board data-fetching pattern creates a Server-Client coherence gap), 5 high-severity issues, and several medium/low findings detailed below.

**Verdict:** Address CRITICAL and HIGH items before implementation begins. MEDIUM items can be addressed during build.

---

## CRITICAL Findings

### CRIT-1: Client-Side Filtering Will Break at 500+ Issues

- **Severity:** CRITICAL
- **Affected Requirements:** REQ-039, REQ-044, REQ-046, REQ-048
- **Issue:** The specification (REQ-044) explicitly states: "Filtering is client-side (all issues loaded, filtered in the component) for MVP; if performance degrades (>500 issues), switch to server-side." The architecture then loads ALL project issues into the board Client Component and filters in-memory. The board already caps at 50 issues per column, but with 6 default columns, that is 300 issues loaded initially. A project with 8+ statuses and active backlogs will easily exceed 500 issues. The list view (REQ-046) uses cursor-based pagination (50/page) but the filter toolbar still applies client-side. This creates an inconsistency: list view pagination fetches a page of 50, but client-side filtering over 50 items means filters only work on the current page -- users will miss matching issues on other pages.
- **Recommendation:**
  1. Make filtering **server-side from day one** for both board and list views. Pass filter params from `nuqs` URL state to `getBoardData()` and `getIssuesList()` queries. The Prisma `where` clause additions are trivial (3-4 extra conditions).
  2. For the board, the `getBoardData(projectId, filters?)` query signature already accepts filters -- implement it server-side.
  3. For the list view, pass filters to the cursor-based query so pagination and filtering compose correctly.
  4. Keep the `nuqs` URL state approach -- it works perfectly as a server-compatible filter transport mechanism since the filters are already in search params that Server Components can read.

---

### CRIT-2: No Prisma Middleware or Global Filter for Soft Deletes

- **Severity:** CRITICAL
- **Affected Requirements:** REQ-038, REQ-020, REQ-039, REQ-046, REQ-050
- **Issue:** The architecture states "Soft deletes deferred to Phase 2 (keep MVP simple)" in the strategy, yet the Prisma schema includes `deletedAt` on both Issue and Project, and REQ-038 explicitly requires soft delete for issues in MVP ("sets `deletedAt` timestamp"). There is no Prisma middleware, global filter, or query convention documented to exclude soft-deleted records. Every single query in `src/server/queries/` must manually add `WHERE deletedAt IS NULL`, and if any query forgets this, deleted issues will appear on boards, lists, and search results.
- **Recommendation:**
  1. Add a Prisma client extension (Prisma 5+ supports `$extends`) that automatically injects `{ deletedAt: null }` into all `findMany`, `findFirst`, `findUnique`, and `count` operations for Issue and Project models.
  2. Document a `withDeleted` escape hatch for admin/recovery scenarios.
  3. Alternatively, use Prisma middleware (deprecated but still functional) or create a `baseWhereClause` utility that every query imports.
  4. Add this to the architecture document as a mandatory convention in Layer 1.

---

### CRIT-3: Board Data Fetching Creates a Server-Client Coherence Gap

- **Severity:** CRITICAL
- **Affected Requirements:** REQ-039, REQ-041, REQ-042, REQ-044
- **Issue:** The architecture describes two contradictory data flow patterns for the board:
  - Architecture Section 4 (State Management) shows TanStack Query with `initialData` from Server Component, `refetchInterval: 30_000`, and optimistic mutations via `useMutation`.
  - Architecture Section 8 (Performance) says "Filters change -> URL state (nuqs) triggers refetch -> Server Component re-render."

  These are incompatible. If filters trigger a Server Component re-render (full page navigation since `nuqs` changes the URL), the TanStack Query cache is re-seeded on every filter change, which is wasteful and causes a full page flash. If TanStack Query owns the data, then filter changes should trigger a `queryClient.invalidateQueries` or a new `queryKey`, not a Server Component re-render. The architecture needs to pick one owner for board data lifecycle.
- **Recommendation:**
  1. **Pick TanStack Query as the single owner of board data on the client.** The Server Component fetches initial data (SSR), hydrates it into TanStack Query via `initialData`, and then TanStack Query owns all subsequent fetches.
  2. When filters change (via `nuqs`), include filter values in the TanStack Query `queryKey`: `['board', projectId, filters]`. This triggers a client-side refetch, not a Server Component re-render.
  3. The `fetchBoardData` function called by TanStack Query should hit a thin API route or use a Server Action that returns data (not a mutation). Alternatively, use the experimental `use(serverAction())` pattern if on Next.js 15.
  4. Do NOT use `revalidatePath` for filter changes -- that is only for mutations. Use `revalidatePath` only after create/update/delete issue actions.

---

## HIGH Findings

### HIGH-1: Missing Index on `Issue.key` Text Search Pattern

- **Severity:** HIGH
- **Affected Requirements:** REQ-050, REQ-051
- **Issue:** Search (REQ-050) uses `Prisma contains` (maps to `LIKE '%query%'`) on `Issue.key` and `Issue.title`. The `Issue.key` has a `@unique` index, which is a B-tree -- it supports prefix matching (`LIKE 'PROJ%'`) but NOT infix matching (`LIKE '%123%'`). For title search, there is no index at all on `Issue.title`. With `contains` (case-insensitive), Prisma generates `WHERE title ILIKE '%query%'`, which forces a sequential scan on every issue in the workspace. At 5,000+ issues across multiple projects, this will be slow (100ms+ per search keystroke even with debounce).
- **Recommendation:**
  1. For MVP, add a PostgreSQL `pg_trgm` (trigram) GIN index on `descriptionText` and `title` columns. This makes `ILIKE` queries use the index: `CREATE INDEX idx_issue_title_trgm ON "Issue" USING gin (title gin_trgm_ops);`
  2. Add the same for `Issue.key` if infix search is needed (e.g., searching "123" to find "PROJ-123").
  3. Document this as a raw SQL migration since Prisma does not natively support GIN trigram indexes.
  4. Long-term (Phase 2+): consider PostgreSQL full-text search (`tsvector`) or a dedicated search service.

---

### HIGH-2: `updateWorkspace` Allows Slug Change but Spec Says Slug Is Immutable

- **Severity:** HIGH
- **Affected Requirements:** REQ-010, REQ-015
- **Issue:** REQ-010 explicitly states "Slug is not editable after creation (to prevent link breakage)." However, the `updateWorkspaceSchema` in contracts.md includes `slug` as an optional updatable field, and the `updateWorkspace` Server Action signature in the architecture accepts slug changes. This is a direct contradiction that will cause confusion during implementation.
- **Recommendation:**
  1. Remove `slug` from `updateWorkspaceSchema` entirely.
  2. Remove slug from the `updateWorkspace` action input type.
  3. Show slug as read-only on the settings page (already specified in the UI behavior).

---

### HIGH-3: Workspace Context Resolution Is Missing from Architecture

- **Severity:** HIGH
- **Affected Requirements:** REQ-014, REQ-009, REQ-005
- **Issue:** Every route under `(dashboard)/[workspaceSlug]/` needs to resolve the workspace from the slug, verify the current user is a member, and make the workspace context available to all child routes. The architecture shows a `[workspaceSlug]/layout.tsx` that "loads workspace context" but does not specify the mechanism. Key questions left unanswered:
  - Is the workspace loaded in the layout and passed via React context, or does each page re-fetch it?
  - How does the sidebar (which lives in the `(dashboard)/layout.tsx`, one level above `[workspaceSlug]`) know which workspace is active?
  - If a user is removed from a workspace while viewing it, when/how is this detected?
- **Recommendation:**
  1. The `[workspaceSlug]/layout.tsx` should fetch the workspace + membership in a Server Component and pass it as props or via a React context provider (`WorkspaceProvider`).
  2. The sidebar in `(dashboard)/layout.tsx` should read the `workspaceSlug` from `params` and fetch the workspace list for the switcher. The active workspace is determined by matching the slug.
  3. Document the "workspace not found / access denied" flow: the layout should return a `notFound()` or `redirect()` if the user is not a member, not render child content.
  4. Add a `WorkspaceContext` type and provider to the component architecture section.

---

### HIGH-4: Activity Log Insert Per Field Creates N+1 Write Pattern

- **Severity:** HIGH
- **Affected Requirements:** REQ-036, REQ-037, REQ-028
- **Issue:** The strategy says "Generate one Activity row per changed field" when an issue is updated. If a user changes status, assignee, and priority in the same update (which the `updateIssue` action supports via partial updates), this creates 3 separate INSERT statements for the Activity table plus the Issue UPDATE, all ideally in one transaction. The architecture does not specify whether these are batched in a single `$transaction` or fired sequentially. Without batching, this is 4 round-trips to the database for a single user action.
- **Recommendation:**
  1. Use `prisma.$transaction([...])` (batch transaction) to bundle the issue update and all activity inserts into a single database round-trip.
  2. Use `prisma.activity.createMany()` for the activity records (single INSERT with multiple rows).
  3. Document the transaction pattern in the strategy's "Issue Creation Server Action Pattern" section.

---

### HIGH-5: `Issue.number` Field Not Indexed for Key Generation

- **Severity:** HIGH
- **Affected Requirements:** REQ-026, REQ-025
- **Issue:** The Issue model has a `number` Int field that represents the per-project sequence number, and `key` is the composed string (e.g., "PROJ-123"). The `issueCounter` on Project is used for atomic increment, which is correct. However, there is no index on `(projectId, number)`. If a query ever needs to find an issue by project + number (e.g., parsing "PROJ-123" into projectId + number 123 for lookup), it would require a scan. While the current design uses the globally unique `Issue.key` for lookups, any future query pattern (e.g., "get the latest issue number for project X") would benefit from this index.
- **Recommendation:**
  1. Add `@@index([projectId, number])` to the Issue model for forward compatibility.
  2. This is a low-cost index (one integer column appended to an existing prefix) with high future value.

---

## MEDIUM Findings

### MED-1: TanStack Query + Server Actions Boundary Is Unclear

- **Severity:** MEDIUM
- **Affected Requirements:** REQ-041, REQ-042, REQ-037
- **Issue:** The architecture uses TanStack Query for board optimistic updates but Server Actions for mutations. Server Actions return `ActionResult<T>`, but TanStack Query's `useMutation` expects a function that returns a promise. The architecture shows `mutationFn: moveIssueAction` directly, but Server Actions invoked this way from a `useMutation` context bypass the `startTransition` wrapper that Next.js expects. This can cause hydration mismatches or missed revalidations.
- **Recommendation:**
  1. Wrap Server Action calls inside the `mutationFn` explicitly: `mutationFn: (input) => moveIssueAction(input)`.
  2. Do NOT call `revalidatePath` inside Server Actions that are used via TanStack Query mutations -- the TanStack Query `onSettled` handler already calls `invalidateQueries`. Double revalidation (server cache + client cache) causes unnecessary re-renders.
  3. Document which Server Actions use `revalidatePath` (form-based mutations) vs. which rely on TanStack Query invalidation (board DnD mutations).

---

### MED-2: Fractional Indexing Degradation Not Addressed

- **Severity:** MEDIUM
- **Affected Requirements:** REQ-042, REQ-041
- **Issue:** Fractional indexing (via `fractional-indexing` npm package) generates string keys like "a0", "a1", "a0V". After many reorderings in the same column, the string length grows unboundedly (each bisection adds characters). With 500+ reorder operations in a hot column, position strings can become 20+ characters. More importantly, repeated insertions at the same position (e.g., always dropping at position 0) can cause the fractional index to approach precision limits.
- **Recommendation:**
  1. Implement a periodic "rebalance" operation that re-indexes all positions in a column to clean fractional strings. This can be triggered when any position string exceeds 10 characters.
  2. The rebalance should run inside a `$transaction` to avoid race conditions.
  3. Document this as a background maintenance task, not user-facing.

---

### MED-3: `description: z.any()` Is a Validation Hole

- **Severity:** MEDIUM
- **Affected Requirements:** REQ-034, REQ-035, REQ-025
- **Issue:** Both `createIssueSchema` and `createCommentSchema` use `z.any()` for the `description` / `body` fields (Tiptap JSON). This means literally any value passes validation -- a number, a 10MB string, a deeply nested object, or executable code. While Tiptap JSON has a known structure, `z.any()` provides zero server-side protection.
- **Recommendation:**
  1. Create a `tiptapJsonSchema` that validates the basic structure: `z.object({ type: z.literal('doc'), content: z.array(z.any()) }).nullable().optional()`. This validates the top-level shape without deeply parsing every node.
  2. Add a size guard: `z.any().refine((val) => JSON.stringify(val).length < 100_000, 'Content too large')`.
  3. This prevents storing arbitrary large payloads and ensures the value is at least shaped like Tiptap output.

---

### MED-4: Session Model Included But JWT Strategy Used

- **Severity:** MEDIUM
- **Affected Requirements:** REQ-005
- **Issue:** The Prisma schema includes the `Session` model (database sessions), but the architecture explicitly chooses JWT strategy: "JWT strategy (stateless, edge-compatible) over database sessions." The Session model is dead code that creates an unused table, adds migration complexity, and could confuse implementers into thinking database sessions are in use.
- **Recommendation:**
  1. Remove the `Session` model from the Prisma schema if JWT is the definitive strategy.
  2. Keep it only if you plan to support database sessions as a fallback. Auth.js v5 does not require the Session model when using JWT strategy.
  3. Similarly, the `VerificationToken` model is needed for email verification and password reset flows (REQ-006), so keep it.

---

### MED-5: Board Polling (30s) vs. `revalidatePath` Creates Double Fetching

- **Severity:** MEDIUM
- **Affected Requirements:** REQ-039, REQ-041
- **Issue:** When User A moves an issue, the `moveIssue` Server Action calls `revalidatePath` (invalidating the Next.js cache), and TanStack Query has `refetchInterval: 30_000`. If User B is viewing the same board, they receive the update via the 30s poll. However, if User B also performs an action, their `revalidatePath` fires AND their TanStack Query poll fires, resulting in two fetches within the same second.
- **Recommendation:**
  1. For board mutations that use TanStack Query optimistic updates, skip `revalidatePath` and rely solely on `invalidateQueries` (client-side) + the 30s poll for other users.
  2. Use `revalidatePath` only for mutations triggered by form submissions (non-TanStack-Query paths), such as issue creation from a dialog.
  3. This avoids the double-fetch and keeps the cache ownership clean.

---

### MED-6: No Rate Limiting or Debounce on Server Actions

- **Severity:** MEDIUM
- **Affected Requirements:** REQ-025, REQ-037, REQ-043
- **Issue:** Server Actions are exposed as POST endpoints by Next.js. There is no rate limiting documented. The quick-add form (REQ-043) fires a `createIssue` Server Action on every Enter press. A malicious or misbehaving client could spam issue creation. Similarly, the inline field editing (REQ-028) fires `updateIssue` on every field change -- rapid clicking could cause a burst of mutations.
- **Recommendation:**
  1. Add client-side debounce (already mentioned for description auto-save at 500ms) to all inline edit mutations.
  2. For MVP, add a simple in-memory rate limiter middleware for Server Actions (e.g., max 30 mutations per user per minute).
  3. Document this as a cross-cutting concern in the architecture.

---

### MED-7: `resetPassword` Token Flow Missing from Contracts

- **Severity:** MEDIUM
- **Affected Requirements:** REQ-006
- **Issue:** REQ-006 specifies a full password reset flow (request token, validate token, set new password). The contracts.md defines `forgotPasswordSchema` (email input) but does not define a `resetPasswordSchema` (token + new password + confirm password). There is also no `resetPassword` Server Action signature in the contracts. This will be discovered during implementation and cause ad-hoc schema creation.
- **Recommendation:**
  1. Add to `src/lib/validations/auth.ts`:
     ```typescript
     export const resetPasswordSchema = z.object({
       token: z.string().min(1),
       password: z.string().min(8).max(100),
       confirmPassword: z.string(),
     }).refine(data => data.password === data.confirmPassword, {
       message: "Passwords do not match",
       path: ["confirmPassword"],
     });
     ```
  2. Add `requestPasswordReset(input: ForgotPasswordInput)` and `resetPassword(input: ResetPasswordInput)` Server Action signatures to the contracts.

---

## LOW Findings

### LOW-1: `board-filter-store.ts` Zustand Store Is Redundant with `nuqs`

- **Severity:** LOW
- **Affected Requirements:** REQ-044
- **Issue:** The architecture lists `board-filter-store.ts` as a Zustand store for "Active board filters (synced with URL via nuqs)." If filters are already in URL state via `nuqs`, maintaining a parallel Zustand store creates a synchronization burden. The `nuqs` hooks (`useQueryState`) already provide reactive state that re-renders components on change.
- **Recommendation:**
  1. Remove `board-filter-store.ts` entirely.
  2. Use `nuqs` hooks directly in the filter components and the board view.
  3. If derived state is needed (e.g., "are any filters active?"), compute it from the `nuqs` values in a custom hook like `useBoardFilters()` (already shown in the architecture).

---

### LOW-2: Issue Detail Page Is Full-Page but Architecture Shows Slide-Over Panel

- **Severity:** LOW
- **Affected Requirements:** REQ-027
- **Issue:** The spec (REQ-027) describes a full-page issue detail view at `/{workspace}/{project}/issues/{issueKey}`. However, the strategy (Layer 4, item 4.4) says "Issue detail view (slide-over panel)" and the Zustand store has `issue-detail-store.ts` with `openIssue`/`closeIssue` for a panel. The board's item 5.14 says "Click card -> open issue detail panel." These are two different UX patterns (full page vs. slide-over), and the architecture should clarify which is MVP.
- **Recommendation:**
  1. For MVP, implement the full-page issue detail view (as specified in REQ-027). It is simpler and avoids the complexity of maintaining board state while a panel is open.
  2. Remove the `issue-detail-store.ts` Zustand store for now.
  3. Phase 2 can add a slide-over panel for quick preview from the board, with the full-page view as the "expand" option.

---

### LOW-3: `Project.leadId` Has No Foreign Key Relation

- **Severity:** LOW
- **Affected Requirements:** REQ-018
- **Issue:** The `Project` model has `leadId String?` but no `@relation` directive linking it to `User`. This means Prisma cannot enforce referential integrity, and eager loading the lead user requires a separate query.
- **Recommendation:**
  1. Add the relation: `lead User? @relation("ProjectLead", fields: [leadId], references: [id], onDelete: SetNull)`.
  2. Add the inverse relation on User: `ledProjects Project[] @relation("ProjectLead")`.

---

### LOW-4: No `@db.Text` on Large String Fields

- **Severity:** LOW
- **Affected Requirements:** REQ-034, REQ-035
- **Issue:** The `descriptionText` and `bodyText` fields (plain text extraction for search) are `String?` / `String` without `@db.Text`. In PostgreSQL, `String` maps to `text` by default in Prisma (not `varchar`), so this is technically fine. However, for clarity and to prevent future confusion if the database provider changes, it is good practice to be explicit about large text fields.
- **Recommendation:** Add `@db.Text` to `descriptionText`, `bodyText`, and `Activity.metadata` description text if any are long.

---

### LOW-5: Workspace Invitation `invitedById` Has No Relation

- **Severity:** LOW
- **Affected Requirements:** REQ-007
- **Issue:** `WorkspaceInvitation.invitedById` is a raw `String` with no `@relation`. This means the "invited by" information cannot be eagerly loaded and there is no referential integrity.
- **Recommendation:**
  1. Add `invitedBy User @relation(fields: [invitedById], references: [id])` to `WorkspaceInvitation`.
  2. Add the inverse relation on `User`.

---

### LOW-6: `WorkspaceInvitation` Has Redundant Index on `token`

- **Severity:** LOW
- **Affected Requirements:** REQ-008
- **Issue:** `WorkspaceInvitation` has both `token String @unique` and `@@index([token])`. The `@unique` constraint already creates a unique index on `token`, making the explicit `@@index([token])` redundant.
- **Recommendation:** Remove `@@index([token])` from the WorkspaceInvitation model.

---

### LOW-7: `Issue.status` Relation Has No `onDelete` Strategy

- **Severity:** LOW
- **Affected Requirements:** REQ-031
- **Issue:** The `Issue.status` relation (`@relation(fields: [statusId], references: [id])`) has no `onDelete` clause. If a `WorkflowStatus` is deleted, the database will use the default behavior (which in PostgreSQL with Prisma is typically RESTRICT/error). The spec says statuses are not deletable in MVP, but the contracts define a `deleteStatus` action with `migrateToStatusId`. If the migration step fails or is skipped, the delete will cascade errors.
- **Recommendation:**
  1. Add `onDelete: Restrict` explicitly to make the intention clear.
  2. Ensure the `deleteStatus` Server Action migrates all issues BEFORE deleting the status, within a transaction.

---

## Over-Engineering Assessment

### Appropriately Scoped
- Phase 2 schema fields (Sprint, IssueLink, parentId, storyPoints) are nullable and have zero runtime cost -- this is good forward-compatible design.
- The three-layer state management split (URL/Server/UI) is well-reasoned and not over-engineered for this app's complexity.

### Borderline Over-Engineering
- **BulkUpdateIssues action** (contracts.md): No UI in the MVP spec actually triggers bulk updates. The list view has no row selection or bulk actions specified. This action should be deferred to Phase 2 when bulk operations are added.
- **Status CRUD actions** (create, update, reorder, delete): REQ-031 says statuses are not user-customizable in MVP ("Default statuses are seeded on project creation"). The full status management UI and actions can be deferred.

### Under-Engineering Concerns
- **No offline/optimistic queue**: The board drag-and-drop uses optimistic updates but has no retry queue. If a user performs multiple rapid drags and the first one fails, all subsequent optimistic updates are built on a stale base. Consider a simple mutation queue.
- **No WebSocket/SSE for real-time**: The 30s polling is acceptable for MVP but should be flagged as a Phase 2 priority. In a team setting, stale boards cause drag-and-drop conflicts.

---

## Consistency with Next.js 15 App Router Best Practices

| Practice | Status | Notes |
|----------|--------|-------|
| Server Components by default | GOOD | Architecture correctly marks interactive components as Client |
| Data fetching in Server Components | GOOD | `src/server/queries/` pattern is idiomatic |
| Server Actions for mutations | GOOD | Properly used with Zod validation |
| Route groups for layouts | GOOD | `(auth)` and `(dashboard)` groups are correct |
| Middleware for auth | GOOD | Follows Auth.js v5 pattern |
| `revalidatePath` after mutations | PARTIAL | See CRIT-3 and MED-5 about conflicting with TanStack Query |
| Streaming / Suspense | MENTIONED | Architecture mentions it but does not detail which components use `<Suspense>` boundaries |
| `loading.tsx` files | MISSING | No mention of `loading.tsx` convention for route-level loading states |
| `error.tsx` files | MENTIONED | Error boundaries mentioned but `error.tsx` convention not explicitly listed in project structure |
| `not-found.tsx` files | MISSING | Not mentioned in the project structure despite 404 handling being required |
| Parallel routes | NOT NEEDED | Correct to omit for MVP |
| Intercepting routes | NOT NEEDED | Could be useful for issue detail modal in Phase 2 |

---

## Findings Summary

| Severity | Count | IDs |
|----------|-------|-----|
| CRITICAL | 3 | CRIT-1, CRIT-2, CRIT-3 |
| HIGH | 5 | HIGH-1, HIGH-2, HIGH-3, HIGH-4, HIGH-5 |
| MEDIUM | 7 | MED-1 through MED-7 |
| LOW | 7 | LOW-1 through LOW-7 |
| **Total** | **22** | |

### Priority Actions Before Implementation

1. **CRIT-1**: Switch to server-side filtering immediately. Do not build client-side filtering.
2. **CRIT-2**: Implement Prisma client extension for soft-delete exclusion in Layer 1.
3. **CRIT-3**: Clarify board data ownership -- TanStack Query should own post-hydration. Remove `revalidatePath` from DnD mutations.
4. **HIGH-2**: Remove slug from `updateWorkspaceSchema`.
5. **HIGH-3**: Document workspace context resolution pattern in architecture.
6. **HIGH-4**: Use `createMany` + `$transaction` for activity log batching.
