# Quality Review: PMApp (JIRA-like Project Management)

**Reviewer:** QualityReviewer (Forge Pipeline)
**Date:** 2026-03-26
**Scope:** All TypeScript/TSX files in `src/`, `prisma/`, root config

---

## Summary

**Total findings: 28**
- HIGH: 8
- MEDIUM: 12
- LOW: 8

Overall the codebase is well-structured with consistent patterns, proper use of server/client directives, comprehensive auth guards, and strong workspace isolation. The main concerns are function signature mismatches between callers and implementations, missing contract implementations (status actions, bulkUpdateIssues), `as any` type escapes, and missing error boundaries.

---

## 1. Contract Mismatches (Contracts vs Implementation)

### FINDING-01: getUserWorkspaces called with arg but defined with zero params
- **Severity:** HIGH
- **File:** `src/app/(dashboard)/page.tsx:12`
- **Issue:** `getUserWorkspaces(session.user.id)` passes `userId` as an argument, but the implementation at `src/server/queries/workspace-queries.ts:21` takes zero parameters (it calls `requireAuth()` internally to get the userId).
- **Fix:** Change the call site to `getUserWorkspaces()` with no arguments. The function already extracts userId from the session internally.

### FINDING-02: getWorkspaceBySlug called with 2 args but defined with 1
- **Severity:** HIGH
- **File:** `src/app/(dashboard)/[workspaceSlug]/[projectKey]/board/page.tsx:18` (and 9+ other pages)
- **Issue:** All page files call `getWorkspaceBySlug(workspaceSlug, session.user.id)` with two arguments, but the implementation `getWorkspace(slug: string)` at `src/server/queries/workspace-queries.ts:46` takes only one parameter (slug). It gets the userId from `requireAuth()` internally.
- **Fix:** Change all call sites to `getWorkspaceBySlug(workspaceSlug)` with a single argument. Affected files:
  - `src/app/(dashboard)/[workspaceSlug]/layout.tsx:18`
  - `src/app/(dashboard)/[workspaceSlug]/settings/page.tsx:15`
  - `src/app/(dashboard)/[workspaceSlug]/settings/members/page.tsx:17`
  - `src/app/(dashboard)/[workspaceSlug]/projects/page.tsx:19`
  - `src/app/(dashboard)/[workspaceSlug]/[projectKey]/layout.tsx:20`
  - `src/app/(dashboard)/[workspaceSlug]/[projectKey]/board/page.tsx:18`
  - `src/app/(dashboard)/[workspaceSlug]/[projectKey]/list/page.tsx:19`
  - `src/app/(dashboard)/[workspaceSlug]/[projectKey]/issues/[issueKey]/page.tsx:18`
  - `src/app/(dashboard)/[workspaceSlug]/[projectKey]/settings/page.tsx:16`

### FINDING-03: getIssueByKey called with 1 arg but defined with 2
- **Severity:** HIGH
- **File:** `src/app/(dashboard)/[workspaceSlug]/[projectKey]/issues/[issueKey]/page.tsx:22`
- **Issue:** `getIssueByKey(issueKey)` is called with only the issueKey, but `getIssue(workspaceId, issueKey)` at `src/server/queries/issue-queries.ts:26` requires both `workspaceId` and `issueKey` parameters.
- **Fix:** Change to `getIssueByKey(workspace.id, issueKey)`.

### FINDING-04: getProjects called with 2 args but defined with 1
- **Severity:** HIGH
- **File:** `src/app/(dashboard)/[workspaceSlug]/projects/page.tsx:22`
- **Issue:** `getProjects(workspace.id, session.user.id)` passes two arguments, but the implementation at `src/server/queries/project-queries.ts:26` only takes `workspaceId`. It gets userId from `requireAuth()` internally.
- **Fix:** Change to `getProjects(workspace.id)`.

### FINDING-05: getProjectIssues called with 1 arg but expects 2+
- **Severity:** HIGH
- **File:** `src/app/(dashboard)/[workspaceSlug]/[projectKey]/list/page.tsx:26`
- **Issue:** `getProjectIssues(project.id)` passes only `projectId`, but the aliased function `getIssuesByProject(workspaceId, projectId, options?)` requires `workspaceId` as the first parameter.
- **Fix:** Change to `getProjectIssues(workspace.id, project.id)`.

### FINDING-06: Missing status actions module
- **Severity:** HIGH
- **File:** Contract `src/server/actions/status.ts` (referenced in contracts.md)
- **Issue:** The contracts define `createStatus`, `updateStatus`, `reorderStatuses`, and `deleteStatus` server actions, plus a `src/lib/validations/status.ts` schema file. Neither file exists in the codebase. Status management is part of the contract but has no implementation.
- **Fix:** Implement `src/lib/validations/status.ts` and `src/server/actions/status-actions.ts` (with `src/server/actions/status.ts` re-export) per the contract specification.

### FINDING-07: Missing bulkUpdateIssues action
- **Severity:** HIGH
- **File:** Contracts define `bulkUpdateIssues` in `src/server/actions/issue.ts`
- **Issue:** The contract specifies a `bulkUpdateIssues(input: BulkUpdateIssuesInput)` action, and the Zod schema `bulkUpdateIssuesSchema` is defined in `src/lib/validations/issue.ts`, but no implementation exists in `issue-actions.ts`. The re-export file `issue.ts` also does not export it.
- **Fix:** Implement `bulkUpdateIssues` in `src/server/actions/issue-actions.ts` and add it to the re-export in `src/server/actions/issue.ts`.

### FINDING-08: updateWorkspace contract mismatch - slug field removed
- **Severity:** MEDIUM
- **File:** `src/lib/validations/workspace.ts:32`
- **Issue:** The contract specifies `updateWorkspaceSchema` includes an optional `slug` field, but the implementation removes it (comment: "Slug is immutable after creation per critique"). This is a deliberate security improvement, but it's an undocumented contract deviation. The contract should be updated to match.
- **Fix:** Update `contracts.md` section 2 to remove `slug` from `updateWorkspaceSchema`, or document the deviation.

---

## 2. Type Safety Issues

### FINDING-09: `as any` type escapes throughout codebase
- **Severity:** MEDIUM
- **File:** Multiple locations
- **Issue:** There are 7 instances of `as any` type assertions that bypass TypeScript's type checking:
  1. `src/server/actions/issue-actions.ts:371` -- `data: activities as any` in `createMany`
  2. `src/server/queries/project-queries.ts:57` -- `favorites: undefined as any`
  3. `src/server/queries/project-queries.ts:199` -- `where: issueWhere as any`
  4. `src/server/queries/issue-queries.ts:130` -- `where: where as any`
  5. `src/server/queries/issue-queries.ts:151` -- `where: where as any`
  6. `src/components/issues/create-issue-dialog.tsx:141` -- `e.target.value as any`
  7. `src/components/issues/create-issue-dialog.tsx:171` -- `e.target.value as any`
- **Fix:** For #1, type the `activities` array properly using `Prisma.ActivityCreateManyInput[]`. For #2, use `Omit<>` or destructure to exclude `favorites`. For #3-5, use proper Prisma `Where` types. For #6-7, use the specific enum type from the Zod schema.

### FINDING-10: SortIcon component uses `any` type
- **Severity:** MEDIUM
- **File:** `src/components/issues-table/issues-data-table.tsx:332`
- **Issue:** `function SortIcon({ column }: { column: any })` uses `any` for the column parameter.
- **Fix:** Import `Column` from `@tanstack/react-table` and type it as `Column<IssueListItem, unknown>`.

### FINDING-11: z.any() in create-issue-dialog client schema
- **Severity:** MEDIUM
- **File:** `src/components/issues/create-issue-dialog.tsx:24`
- **Issue:** The local `createIssueSchema` in the dialog uses `description: z.any().optional()`, which was specifically flagged and fixed in the server-side validation (`src/lib/validations/issue.ts`) with `tiptapJsonSchema`. The client-side form should use the same schema for consistency.
- **Fix:** Import and reuse `tiptapJsonSchema` from `@/lib/validations/issue` or import the entire `createIssueSchema` from the validations module instead of redefining it locally.

### FINDING-12: Duplicate ActionResult type definition
- **Severity:** MEDIUM
- **File:** `src/types/api.ts:6` and `src/lib/errors.ts:56`
- **Issue:** `ActionResult<T>` is defined identically in both files. The server actions import from `@/lib/errors`, but the types file also exports it. This creates ambiguity about which is canonical.
- **Fix:** Keep the definition in `src/lib/errors.ts` (used by server actions) and have `src/types/api.ts` re-export it: `export type { ActionResult } from '@/lib/errors'`.

---

## 3. Next.js Best Practices

### FINDING-13: No error.tsx boundary anywhere in the app
- **Severity:** HIGH
- **File:** `src/app/` (missing)
- **Issue:** There are zero `error.tsx` files in the entire application. If any server component or data fetch throws an unhandled error, the user will see the Next.js default error page with no recovery path. The app has `loading.tsx` and `not-found.tsx` in key routes but no error boundaries.
- **Fix:** Add `error.tsx` at minimum to:
  - `src/app/error.tsx` (root catch-all)
  - `src/app/(dashboard)/error.tsx` (dashboard catch-all)
  - `src/app/(dashboard)/[workspaceSlug]/[projectKey]/error.tsx` (project-level errors)

### FINDING-14: Missing metadata exports on page components
- **Severity:** MEDIUM
- **File:** All page.tsx files except root layout
- **Issue:** Only `src/app/layout.tsx` exports `metadata`. No individual page exports metadata or `generateMetadata()`. Pages like sign-in, sign-up, project board, issue detail, etc. should have page-specific titles for SEO and browser tab clarity.
- **Fix:** Add `generateMetadata()` to key server component pages:
  - `src/app/(auth)/sign-in/page.tsx` -- but this is `"use client"`, so add metadata via the loading.tsx or a parent layout
  - `src/app/(dashboard)/[workspaceSlug]/projects/page.tsx` -- `export const metadata = { title: "Projects" }`
  - `src/app/(dashboard)/[workspaceSlug]/[projectKey]/board/page.tsx` -- `generateMetadata` using projectKey
  - `src/app/(dashboard)/[workspaceSlug]/[projectKey]/issues/[issueKey]/page.tsx` -- `generateMetadata` using issueKey

### FINDING-15: Auth pages are "use client" but could benefit from metadata
- **Severity:** LOW
- **File:** `src/app/(auth)/sign-in/page.tsx:1`, `src/app/(auth)/sign-up/page.tsx:1`
- **Issue:** Sign-in and sign-up pages are `"use client"` components, which means they cannot export `metadata`. Consider wrapping them in a server component layout with metadata, or using the `sign-in/loading.tsx` pattern.
- **Fix:** Add metadata to `src/app/(auth)/layout.tsx`:
  ```tsx
  export const metadata = { title: "Sign In | PMApp" };
  ```
  Or better, create page-specific layouts under each auth route.

### FINDING-16: Root page redirects to /dashboard which doesn't exist as a route
- **Severity:** MEDIUM
- **File:** `src/app/page.tsx:16`
- **Issue:** The root page redirects to `/dashboard`, but there is no `src/app/dashboard/` route. The actual dashboard lives at `src/app/(dashboard)/page.tsx` which is mounted at `/` (since `(dashboard)` is a route group). This redirect creates an infinite loop: `/` -> `/dashboard` -> 404 or falls through to `(dashboard)/page.tsx` which redirects again.
- **Fix:** The root `page.tsx` logic duplicates what `(dashboard)/page.tsx` already does. Either: (a) remove root `page.tsx` and let `(dashboard)/page.tsx` handle `/` directly, or (b) change the redirect to go directly to the workspace slug.

---

## 4. Code Quality Issues

### FINDING-17: Duplicate Zod schema definitions in client components
- **Severity:** MEDIUM
- **File:** `src/components/issues/create-issue-dialog.tsx:18-26`, `src/app/(auth)/sign-in/page.tsx:13-17`, `src/app/(auth)/sign-up/page.tsx:13-17`
- **Issue:** Three client components redefine Zod schemas that already exist in `src/lib/validations/`. The create-issue-dialog defines its own `createIssueSchema`, sign-in defines `signInSchema`, and sign-up defines `signUpSchema`. This violates DRY and means validation rules can diverge (e.g., the sign-up page doesn't enforce password complexity like the server schema does).
- **Fix:** Import the canonical schemas from `@/lib/validations/auth` and `@/lib/validations/issue` instead of redefining them. The validation modules are already designed to be shared between client and server.

### FINDING-18: Duplicate requireWorkspaceMember function
- **Severity:** MEDIUM
- **File:** `src/lib/db/workspace-scope.ts:206` and `src/lib/auth/helpers.ts:40`
- **Issue:** `requireWorkspaceMember` is implemented in both files with slightly different signatures and error handling. The one in `auth/helpers.ts` throws `AppError` (structured), while the one in `workspace-scope.ts` throws a plain `Error`. All server actions use the `auth/helpers.ts` version.
- **Fix:** Remove the duplicate from `workspace-scope.ts` or have it delegate to `auth/helpers.ts`. Similarly, `requireWorkspaceRole` in `workspace-scope.ts` is never used anywhere -- remove it.

### FINDING-19: Inconsistent error handling in IssueComments/IssueActivity
- **Severity:** MEDIUM
- **File:** `src/components/issues/issue-comments.tsx:34`, `src/components/issues/issue-activity.tsx:23`
- **Issue:** Both components fetch data client-side via `useEffect` and silently swallow errors with empty catch blocks (`catch { // Silently fail }`). No user feedback is provided when data loading fails. The comments component calls server query functions (`getIssueComments`) directly from a client component, which works in Next.js but is unusual -- server queries are typically called from server components and passed as props.
- **Fix:** Either: (a) fetch comments/activities from server components and pass as props, or (b) add proper error states with retry UI in the catch blocks.

### FINDING-20: Due date input not wired to form in CreateIssueDialog
- **Severity:** MEDIUM
- **File:** `src/components/issues/create-issue-dialog.tsx:229-233`
- **Issue:** The due date `<input type="date">` in the create issue dialog is not connected to the react-hook-form via `register("dueDate")`. The value is never collected or sent to the server action. The input is purely decorative.
- **Fix:** Add `{...register("dueDate")}` or handle it via `setValue("dueDate", ...)` on change, and include `dueDate` in the local schema definition.

### FINDING-21: Description textarea not wired to form in CreateIssueDialog
- **Severity:** MEDIUM
- **File:** `src/components/issues/create-issue-dialog.tsx:239-244`
- **Issue:** Similar to FINDING-20, the description `<textarea>` is not connected to react-hook-form. The description value is never collected or passed to `createIssue()`.
- **Fix:** Wire it up with `register("description")` or handle description content separately and include it in the submit data.

### FINDING-22: Comment hover actions never visible (missing group class)
- **Severity:** LOW
- **File:** `src/components/issues/issue-comments.tsx:168`
- **Issue:** The edit/delete buttons have `opacity-0 group-hover:opacity-100` CSS, but the parent `<div>` (line 121) does not have a `group` class. The buttons will never become visible on hover.
- **Fix:** Add `className="group"` to the comment item wrapper `<div>` at line 121: `<div key={comment.id} data-testid="comment-item" className="group flex gap-3">`.

### FINDING-23: Status dropdown only shows current status option
- **Severity:** LOW
- **File:** `src/components/issues/issue-detail-sidebar.tsx:41-44`
- **Issue:** The status `<select>` in the issue detail sidebar only renders the current status as a single `<option>`. It does not render all available project statuses, making it impossible for the user to actually change the status.
- **Fix:** Pass the project's workflow statuses as a prop to the sidebar and render all status options. Currently `issue.project` is available but doesn't include `statuses`.

---

## 5. Dead Code & Unused Imports

### FINDING-24: Unused imports in auth/helpers.ts
- **Severity:** LOW
- **File:** `src/lib/auth/helpers.ts:8`
- **Issue:** `AppError` is imported but never used directly in this file. Only `errors` factory functions are used.
- **Fix:** Remove the `AppError` import.

### FINDING-25: Unused requireIssueInWorkspace/requireProjectInWorkspace
- **Severity:** LOW
- **File:** `src/lib/auth/helpers.ts:86,109`
- **Issue:** `requireProjectInWorkspace` and `requireIssueInWorkspace` are defined and imported in `issue-actions.ts:28` but never actually called. The issue actions manually fetch and verify projects/issues inline instead.
- **Fix:** Either use these helpers in the actions (preferred, reduces code duplication) or remove them if the inline approach is intentional.

### FINDING-26: workspace-scope.ts largely unused
- **Severity:** LOW
- **File:** `src/lib/db/workspace-scope.ts`
- **Issue:** The `withWorkspace()` helper and all its methods (`project.findMany`, `label.findMany`, `member.isMember`, etc.) are never imported or used anywhere in the codebase. The entire 243-line file is dead code. All server actions and queries use direct Prisma calls with manual workspace filtering.
- **Fix:** Either adopt `withWorkspace()` across queries/actions for consistency, or remove the file to reduce maintenance burden.

---

## 6. Consistency & Style Issues

### FINDING-27: Inconsistent naming of re-export modules
- **Severity:** LOW
- **File:** `src/server/actions/workspace.ts`, `src/server/actions/project.ts`, etc.
- **Issue:** The pattern of having `*-actions.ts` (implementation) and `*.ts` (re-export) files is consistent, but the re-export files add unnecessary indirection. The `"use server"` directive is on the `-actions.ts` files, and the bare `.ts` re-export files lack it. This means imports from the re-export won't have the server boundary marker -- though Next.js traverses to the source, so it works, it's still confusing.
- **Fix:** This is a minor concern. Either add `"use server"` to the re-export files for clarity, or consolidate to single files.

### FINDING-28: Prisma import path inconsistency
- **Severity:** LOW
- **File:** `src/lib/db/index.ts:8`, `src/lib/db/workspace-scope.ts:9`
- **Issue:** The Prisma client is imported via relative path `'../../../generated/prisma'` in db files, while the rest of the codebase uses `'@prisma/client'` for types. This works because the generator output is configured to `../generated/prisma`, but it creates two different import sources for the same types.
- **Fix:** Ensure the `@prisma/client` re-export maps to the generated output, or standardize all imports to use the relative generated path. The type re-exports in `src/types/index.ts` use `@prisma/client`, which may resolve to a different (or missing) package.

---

## Positive Observations

The following areas are well-executed and worth noting:

1. **Server/client boundary discipline** -- All 6 server action files have `"use server"`, all interactive components have `"use client"`. No boundary violations found.
2. **Auth guard consistency** -- Every server action calls `requireAuth()` + `requireRole()`/`requireWorkspaceMember()`. Every query function also has auth checks.
3. **Workspace isolation** -- All data queries scope to workspaceId. No cross-workspace data leaks detected.
4. **Soft delete middleware** -- The Prisma middleware at `src/lib/db/index.ts:32` automatically filters soft-deleted records, preventing accidental exposure of deleted data.
5. **Input validation** -- All server actions validate input with Zod `safeParse` before processing. The Tiptap JSON validation improvement over `z.any()` is a good security practice.
6. **Error handling pattern** -- The `withErrorHandling` wrapper in `src/lib/errors.ts` provides consistent error serialization across all actions.
7. **Accessibility** -- Skip-to-content link in root layout, proper ARIA attributes on forms, `role="dialog"` on modals, `aria-label` on interactive elements.
8. **Loading/not-found coverage** -- Loading and not-found states are present for all major routes.
9. **Optimistic locking** -- The `updatedAt` check in `updateIssue` prevents lost updates from concurrent edits.
10. **Function length** -- All functions are under 50 lines (within the action wrappers). The longest is `updateIssue` at ~220 lines total, but the core logic blocks are well-segmented.
