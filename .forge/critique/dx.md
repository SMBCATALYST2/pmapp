# DX Critique: PMApp (JIRA-like Project Management)

**Critic:** DXCritic (Forge Pipeline)
**Date:** 2026-03-26
**Scope:** Developer Experience review of specification.md and contracts.md
**Verdict:** Generally strong spec with well-structured contracts. 23 findings across 7 categories, 5 HIGH severity, 10 MEDIUM, 8 LOW.

---

## 1. API Ergonomics -- Server Action Signatures

### DX-001: `onFieldChange` callback uses untyped `(field: string, value: unknown)`

- **Severity:** HIGH
- **Affected requirement:** REQ-028 (Inline Field Editing)
- **Issue:** `IssueDetailSidebarProps.onFieldChange` accepts `(field: string, value: unknown)`. This is a stringly-typed API that defeats TypeScript's purpose. Callers can pass any string as `field` and any value, with no compile-time guarantee that the value matches the field type. This will cause runtime bugs (e.g., passing a `Date` for `statusId`) and makes refactoring hazardous.
- **Recommendation:** Replace with a discriminated union callback or individual per-field callbacks:
  ```typescript
  // Option A: Discriminated union (preferred)
  type IssueFieldUpdate =
    | { field: 'statusId'; value: string }
    | { field: 'assigneeId'; value: string | null }
    | { field: 'priority'; value: Priority }
    | { field: 'dueDate'; value: Date | null }
    | { field: 'labelIds'; value: string[] };

  onFieldChange: (update: IssueFieldUpdate) => void;

  // Option B: Per-field callbacks
  onStatusChange: (statusId: string) => void;
  onAssigneeChange: (assigneeId: string | null) => void;
  onPriorityChange: (priority: Priority) => void;
  // ...
  ```

---

### DX-002: Comment update callback uses `(id: string, body: unknown)`

- **Severity:** MEDIUM
- **Affected requirement:** REQ-035 (Issue Comments)
- **Issue:** `IssueCommentItemProps.onUpdate` uses `body: unknown` for the Tiptap JSON content. While Tiptap JSON is complex, `unknown` provides zero guidance to the developer about expected shape. Same issue exists in `IssueDescriptionProps.onSave(content: unknown, plainText: string)` and `createCommentSchema`/`updateCommentSchema` where `body` is `z.any()`.
- **Recommendation:** Define a `TiptapContent` branded type or at minimum a structural type:
  ```typescript
  type TiptapContent = {
    type: 'doc';
    content: Record<string, unknown>[];
  };
  ```
  Then use `TiptapContent` in all Zod schemas (with a custom validator) and component props. Even a loose type is better than `unknown`/`any`.

---

### DX-003: Inconsistent parameter styles -- raw string IDs vs. input objects

- **Severity:** MEDIUM
- **Affected requirement:** REQ-038 (Delete Issue), REQ-021 (Star/Favorite)
- **Issue:** Some server actions take input objects (`deleteComment(input: DeleteCommentInput)` where input is `{ id: string }`), while others take bare string parameters (`deleteIssue(issueId: string)`, `archiveProject(projectId: string)`, `toggleProjectFavorite(projectId: string)`, `acceptInvite(token: string)`). This inconsistency forces developers to remember which pattern each action uses.
- **Recommendation:** Standardize on one approach. The input-object pattern is preferable because it is extensible (can add fields later without breaking the signature), self-documenting (named fields), and consistent with the rest of the codebase. Change `deleteIssue`, `archiveProject`, `toggleProjectFavorite`, and `acceptInvite` to accept input objects:
  ```typescript
  export async function deleteIssue(input: { id: string }): Promise<ActionResult<void>>
  ```

---

### DX-004: `updateWorkspace` allows slug changes but spec says slug is immutable

- **Severity:** MEDIUM
- **Affected requirement:** REQ-010 (Edit Workspace Settings)
- **Issue:** The spec (REQ-010) states "Slug is not editable after creation (to prevent link breakage)" yet `updateWorkspaceSchema` includes `slug` as an optional field, and the `updateWorkspace` server action doc says "Validates slug uniqueness if changing." This contradiction will confuse implementers -- they may implement slug editing only to have it rejected in code review, or vice versa.
- **Recommendation:** Remove `slug` from `updateWorkspaceSchema` to match the spec. If slug editing is intended for a future phase, add a comment explaining the discrepancy.

---

### DX-005: `signUp` action conflates auth + workspace creation

- **Severity:** LOW
- **Affected requirement:** REQ-001 (Email/Password Sign-Up)
- **Issue:** The spec says sign-up auto-creates a default workspace, but the `signUp` action signature returns `{ userId: string }` without any workspace data. It is unclear from the contract alone whether workspace creation is internal to `signUp` or must be called separately. The redirect logic ("redirect to workspace") also requires knowing the workspace slug, which is not returned.
- **Recommendation:** Either expand the return type to include workspace info (`{ userId: string; workspaceSlug: string }`) or explicitly document in the contract that workspace creation happens internally and the redirect path is hardcoded to `/create-workspace` (matching the OAuth flow).

---

## 2. Naming Clarity

### DX-006: `prefix` vs. `key` vs. `projectKey` naming confusion

- **Severity:** HIGH
- **Affected requirement:** REQ-019 (Project Key Validation), REQ-026 (Issue Key Generation)
- **Issue:** The project identifier is called `prefix` in the Prisma schema and Zod schemas, `key` in the spec prose and UI labels ("project key"), and `projectKey` in URL route params. The issue identifier is called `key` in the schema and `issueKey` in the URL. This three-way naming split between schema, validation, and URL layers will cause persistent developer confusion and bugs (e.g., using `project.key` which does not exist).
- **Recommendation:** Unify on a single term. Since the URL and spec both use "key", rename the Prisma field from `prefix` to `key` (with a `@map("prefix")` if the column name matters). Then `createProjectSchema` uses `key` instead of `prefix`, and everything aligns. If `prefix` must stay in the DB, add a TS type alias and document the mapping clearly.

---

### DX-007: `StatusCategory` enum value `IN_PROGRESS` doesn't match CSS/URL conventions

- **Severity:** LOW
- **Affected requirement:** REQ-031 (Issue Status Workflow)
- **Issue:** The enum value `IN_PROGRESS` contains an underscore which does not match the kebab-case convention used in query params (`?status=in_progress`). When developers build filter logic, they must remember to convert between `IN_PROGRESS` (TypeScript enum) and `in_progress` (URL param) or `In Progress` (display label). This is three different representations of the same concept.
- **Recommendation:** Document the mapping explicitly in the constants file, or better yet, add a `slug` field to `STATUS_CATEGORY_CONFIG` that holds the URL-safe representation. Alternatively, store filter params as enum values directly (e.g., `?status=IN_PROGRESS`).

---

### DX-008: `Activity.type` is a loose `String` instead of an enum

- **Severity:** MEDIUM
- **Affected requirement:** REQ-036 (Issue Activity Log)
- **Issue:** `Activity.type` is defined as `String` in the Prisma schema with example values like `"ISSUE_CREATED"`, `"STATUS_CHANGED"`, etc. in comments. Without a Prisma enum or at least a TypeScript union type, developers will inevitably use inconsistent type strings (`"STATUS_CHANGED"` vs. `"status_changed"` vs. `"statusChanged"`). The `ActivityMetadata` union type partially compensates but does not constrain the `type` field itself.
- **Recommendation:** Create an `ActivityType` enum in Prisma (or at minimum a TypeScript string union exported from constants):
  ```typescript
  export const ACTIVITY_TYPES = [
    'ISSUE_CREATED', 'STATUS_CHANGED', 'ASSIGNEE_CHANGED',
    'PRIORITY_CHANGED', 'TYPE_CHANGED', 'TITLE_CHANGED',
    'DESCRIPTION_EDITED', 'DUE_DATE_CHANGED', 'LABEL_ADDED',
    'LABEL_REMOVED', 'COMMENT_ADDED', 'COMMENT_EDITED',
    'COMMENT_DELETED', 'ISSUE_DELETED',
  ] as const;
  export type ActivityType = typeof ACTIVITY_TYPES[number];
  ```

---

### DX-009: `EmptyStateProps.icon` is a string instead of a component reference

- **Severity:** LOW
- **Affected requirement:** REQ-054 (Empty States)
- **Issue:** `EmptyStateProps.icon` is typed as `string` (icon name from lucide-react). This means the component must do a dynamic icon lookup at runtime, which is error-prone (typo in icon name = silent failure), not tree-shakeable, and requires maintaining a mapping of all lucide icon names. Other components in the spec (e.g., `DataTableFacetedFilterProps.options[].icon`) correctly use `React.ComponentType<{ className?: string }>`.
- **Recommendation:** Change to `icon?: React.ComponentType<{ className?: string }>` for consistency and type safety. Callers pass `icon={FolderOpen}` instead of `icon="FolderOpen"`.

---

### DX-010: `BoardFiltersProps` has `activeFilterCount` but filters are managed by nuqs

- **Severity:** LOW
- **Affected requirement:** REQ-044 (Board Quick Filters)
- **Issue:** `BoardFiltersProps` accepts `activeFilterCount` as a prop, but filter state is managed by URL query params via `nuqs`. The filter component itself should be able to derive the count from its own state. Passing it as a prop creates a source-of-truth duplication where the parent must compute it and the component could compute it independently.
- **Recommendation:** Remove `activeFilterCount` from props. Let the filter component derive it internally from nuqs state. If a parent needs the count (e.g., to show in a tab badge), expose it via a shared hook like `useActiveFilterCount()`.

---

## 3. Complexity

### DX-011: Status management CRUD is over-engineered for MVP

- **Severity:** HIGH
- **Affected requirement:** REQ-031 (Issue Status Workflow)
- **Issue:** The contracts define full CRUD for workflow statuses (`createStatus`, `updateStatus`, `reorderStatuses`, `deleteStatus` with migration) including Zod schemas, but the spec says "in MVP statuses are not deletable" and only provides default statuses seeded on project creation. There is no REQ for a status management UI. Implementing four server actions, four Zod schemas, and a status management page that is not in the spec adds ~2-3 days of wasted effort for a feature explicitly deferred.
- **Recommendation:** For MVP, keep only the status seeding logic (in `createProject`). Remove `createStatus`, `updateStatus`, `reorderStatuses`, and `deleteStatus` actions and their Zod schemas. Keep the `WorkflowStatus` model (it is needed for the board) but do not build management UI. Add a `// Phase 2` comment to signal intent.

---

### DX-012: Bulk update issues is not referenced by any requirement

- **Severity:** MEDIUM
- **Affected requirement:** None (orphaned contract)
- **Issue:** `bulkUpdateIssues` server action and `bulkUpdateIssuesSchema` are defined in contracts.md but no requirement in the specification mentions multi-select or bulk operations. The board view and list view have no spec for multi-select UI, checkbox selection, or bulk action toolbars. This is a contract without a consumer.
- **Recommendation:** Remove `bulkUpdateIssues` and `bulkUpdateIssuesSchema` from the MVP contracts. If bulk operations are planned for Phase 2, move them to a Phase 2 section or a separate future-contracts document.

---

### DX-013: Password complexity rules in spec exceed Zod schema validation

- **Severity:** MEDIUM
- **Affected requirement:** REQ-001 (Email/Password Sign-Up)
- **Issue:** Section 9 (Data Validation Rules) requires passwords to have "at least 1 uppercase, 1 lowercase, 1 number" but the `signUpSchema` only validates `min(8)` and `max(100)`. This discrepancy means either the Zod schema is incomplete or the spec over-specifies. Either way, a developer implementing the form will get conflicting requirements.
- **Recommendation:** Decide which is canonical. If complexity rules are desired, add a regex to the Zod schema:
  ```typescript
  password: z.string()
    .min(8)
    .max(100)
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[a-z]/, 'Must contain a lowercase letter')
    .regex(/[0-9]/, 'Must contain a number')
  ```
  If not desired for MVP (simpler UX), remove the complexity requirement from Section 9.

---

### DX-014: Optimistic locking via `updatedAt` in `UpdateIssueInput` is error-prone for rapid edits

- **Severity:** MEDIUM
- **Affected requirement:** REQ-037 (Update Issue)
- **Issue:** Each inline field edit sends the issue's `updatedAt` timestamp. But on the issue detail page, multiple fields can be edited in rapid succession (status, then assignee, then priority). The first edit updates `updatedAt` on the server. The second edit still sends the original `updatedAt` from the initial page load and will fail with a 409 conflict. This makes the optimistic locking unusable for the inline editing UX described in REQ-028.
- **Recommendation:** Either (a) return the new `updatedAt` in each `ActionResult` and have the client update its local state after each save, or (b) use a dedicated version counter (`Issue.version: Int`) that is cheaper to track and less prone to clock skew, or (c) drop optimistic locking for MVP inline edits (last-write-wins) since single-user editing is the common case and real-time collaboration is not in scope.

---

### DX-015: `searchIssuesSchema` requires `workspaceId` but `CommandMenuProps` already has it

- **Severity:** LOW
- **Affected requirement:** REQ-050 (Global Search)
- **Issue:** The search API route requires `workspaceId` as a query param, and `CommandMenuProps` already receives `workspaceId` as a prop. This means the component must thread the workspace ID into each fetch call. Since the workspace is already known from the URL route (`[workspaceSlug]`), deriving `workspaceId` from a server-side layout or middleware would eliminate one more ID the client must manage.
- **Recommendation:** Consider making the search API route derive the workspace from the session or from the `workspaceSlug` route param (via a middleware-injected header) rather than requiring the client to pass `workspaceId`. This also prevents workspace ID spoofing where a user searches a workspace they are not a member of.

---

## 4. Type Safety

### DX-016: `description: z.any()` in issue and comment schemas is a type safety hole

- **Severity:** HIGH
- **Affected requirement:** REQ-034 (Rich Text Description), REQ-035 (Issue Comments)
- **Issue:** Using `z.any()` for Tiptap JSON content means literally any value passes validation -- `null`, `42`, `"hello"`, an empty object. This is the most permissive possible validation for one of the most complex data structures in the app. A malformed description could crash the Tiptap editor on render, corrupt the plain-text extraction, or break search indexing.
- **Recommendation:** At minimum, validate that the value is a non-null object with a `type` field:
  ```typescript
  const tiptapContentSchema = z.object({
    type: z.literal('doc'),
    content: z.array(z.record(z.unknown())).optional(),
  });
  ```
  This catches the most common mistakes (passing null, strings, numbers) while remaining flexible for Tiptap's internal format variations.

---

### DX-017: `ActivityMetadata` discriminated union uses two different discriminator keys

- **Severity:** MEDIUM
- **Affected requirement:** REQ-036 (Issue Activity Log)
- **Issue:** The `ActivityMetadata` type uses `field` as the discriminator for field-change events but `type` as the discriminator for lifecycle events (`created`, `deleted`, `comment_added`). This makes it impossible to write a single type narrowing check:
  ```typescript
  // This doesn't work cleanly:
  if ('field' in metadata) { /* field change */ }
  else if ('type' in metadata) { /* lifecycle event */ }
  ```
  The `labels` variant also uses a different shape (`added/removed` instead of `from/to`).
- **Recommendation:** Unify on a single discriminator key. Add `kind: 'field_change' | 'lifecycle' | 'label_change'` at the top level, or restructure so all variants use `type` as discriminator:
  ```typescript
  type ActivityMetadata =
    | { type: 'status_changed'; from: string; to: string }
    | { type: 'assignee_changed'; from: string | null; to: string | null }
    | { type: 'labels_changed'; added: string[]; removed: string[] }
    | { type: 'created' }
    | { type: 'deleted' }
    | { type: 'comment_added'; commentId: string };
  ```

---

### DX-018: `ProjectWithCounts.isFavorite` is a computed boolean not from Prisma

- **Severity:** LOW
- **Affected requirement:** REQ-021 (Star/Favorite Project)
- **Issue:** `ProjectWithCounts` extends the Prisma `Project` type and adds `isFavorite: boolean`. But Prisma cannot generate this field -- it must be computed in the query layer by checking `ProjectFavorite` for the current user. The type definition makes it look like a database field, which will confuse developers writing queries.
- **Recommendation:** Add a JSDoc comment clarifying this is a computed field:
  ```typescript
  export type ProjectWithCounts = Project & {
    _count: { issues: number };
    /** Computed: true if current user has a ProjectFavorite record for this project */
    isFavorite: boolean;
  };
  ```
  Alternatively, separate the Prisma query result type from the view model type.

---

## 5. Testability

### DX-019: Server actions have no dependency injection for auth or database

- **Severity:** HIGH
- **Affected requirement:** All server actions (REQ-001 through REQ-060)
- **Issue:** Every server action is defined as a standalone `'use server'` function that internally calls `auth()` (NextAuth) and uses the global Prisma client. This makes unit testing extremely difficult -- there is no way to inject a mock auth context or a test database client without either (a) mocking module imports globally, or (b) running integration tests against a real database for every test. For 25+ server actions, this creates a slow, fragile test suite.
- **Recommendation:** Introduce a thin dependency-injection layer. Each action should accept or internally use a `context` that can be overridden in tests:
  ```typescript
  // Option A: Internal helper (simpler)
  async function getActionContext() {
    const session = await auth();
    if (!session?.user) throw new AuthError();
    return { userId: session.user.id, db: prisma };
  }

  // In tests, mock getActionContext
  ```
  Or define actions as a class/factory pattern with injectable deps. Even just extracting the auth check into a single `requireAuth()` helper makes mocking centralized.

---

### DX-020: No contract for test data factories or seed data

- **Severity:** MEDIUM
- **Affected requirement:** Cross-cutting
- **Issue:** The contracts define 16 models with complex relationships (workspace -> project -> status -> issue -> comment -> activity) but provide no guidance on how to create test fixtures. A developer writing their first test must figure out the correct creation order, required relations, and valid enum combinations. Without factories, every test file will duplicate setup boilerplate.
- **Recommendation:** Add a test utilities section to the contracts (or a separate `testing.md`):
  ```typescript
  // src/test/factories.ts
  export function createTestUser(overrides?: Partial<User>): Promise<User>;
  export function createTestWorkspace(ownerId: string, overrides?: Partial<Workspace>): Promise<Workspace>;
  export function createTestProject(workspaceId: string, overrides?: Partial<Project>): Promise<Project>;
  export function createTestIssue(projectId: string, reporterId: string, overrides?: Partial<Issue>): Promise<Issue>;
  ```
  This is essential for developer velocity when the team grows beyond one person.

---

## 6. Developer Onboarding

### DX-021: No architecture decision records (ADRs) for key technical choices

- **Severity:** LOW
- **Affected requirement:** Cross-cutting
- **Issue:** The spec makes several non-obvious architectural decisions -- fractional indexing for card positions, Tiptap JSON stored in a `Json` column with a parallel plain-text column for search, workspace-scoped labels vs. project-scoped, `nuqs` for URL state management -- but does not explain the reasoning. A new developer joining the project must reverse-engineer why these choices were made or risk replacing them with inferior alternatives.
- **Recommendation:** The contracts doc includes a "Key Schema Design Decisions" table which is a good start. Expand this to cover client-side decisions too: why `nuqs` over React state for filters, why `dnd-kit` over other DnD libraries, why fractional indexing over integer reindexing, why Tiptap over other rich text editors. Even a short "ADR" section with one-liner rationales is valuable.

---

### DX-022: 60 requirements is a steep ramp for a new developer

- **Severity:** LOW
- **Affected requirement:** Cross-cutting
- **Issue:** The spec contains 60 requirements across 8 modules. While individually well-structured, there is no high-level architecture diagram, dependency graph, or suggested implementation order. A new developer cannot easily determine "what should I build first?" or "which requirements depend on which?"
- **Recommendation:** Add a dependency/implementation order section:
  ```
  Phase 1A (Foundation): REQ-001-005 (Auth), REQ-009 (Workspace), REQ-015-016 (Slug/Routing)
  Phase 1B (Core Models): REQ-017-019 (Project), REQ-025-026 (Issue CRUD + Keys)
  Phase 1C (Views): REQ-039-042 (Board), REQ-046-047 (List), REQ-027-028 (Issue Detail)
  Phase 1D (Polish): REQ-050-053 (Search), REQ-054-060 (Cross-cutting)
  ```

---

## 7. Component Composition

### DX-023: `IssueDetailProps` is a god-prop with 8 data dependencies

- **Severity:** MEDIUM
- **Affected requirement:** REQ-027 (Issue Detail View)
- **Issue:** `IssueDetailProps` receives `issue`, `members`, `labels`, `statuses`, `comments`, `activities`, `canEdit`, and `workspaceSlug` -- 8 props in total. This means the parent Server Component page must fetch all 8 pieces of data and orchestrate them. The component is monolithic and cannot be loaded incrementally. If any one of the 8 data sources is slow, the entire page is slow.
- **Recommendation:** Split `IssueDetailProps` into composed sub-components, each with its own data boundary:
  ```
  <IssueDetailPage>           -- Server Component, fetches issue + statuses + members
    <Suspense fallback={<CommentsSkeleton />}>
      <IssueComments />       -- Server Component, fetches comments independently
    </Suspense>
    <Suspense fallback={<ActivitySkeleton />}>
      <IssueActivity />       -- Server Component, fetches activities independently
    </Suspense>
  </IssueDetailPage>
  ```
  This enables streaming SSR: the issue metadata appears first, then comments/activity load independently. The current monolithic prop interface prevents this optimization.

---

## Summary Table

| ID | Severity | Category | Affected REQ | Synopsis |
|----|----------|----------|-------------|----------|
| DX-001 | HIGH | API Ergonomics | REQ-028 | `onFieldChange(field: string, value: unknown)` is stringly-typed |
| DX-002 | MEDIUM | API Ergonomics | REQ-035 | Tiptap content typed as `unknown` everywhere |
| DX-003 | MEDIUM | API Ergonomics | REQ-038, REQ-021 | Inconsistent bare-string vs. input-object action params |
| DX-004 | MEDIUM | API Ergonomics | REQ-010 | `updateWorkspaceSchema` allows slug edit, spec forbids it |
| DX-005 | LOW | API Ergonomics | REQ-001 | signUp return type missing workspace data |
| DX-006 | HIGH | Naming | REQ-019, REQ-026 | `prefix`/`key`/`projectKey` triple naming for same concept |
| DX-007 | LOW | Naming | REQ-031 | `IN_PROGRESS` enum vs. kebab-case URL conventions |
| DX-008 | MEDIUM | Naming | REQ-036 | `Activity.type` is loose String, not enum |
| DX-009 | LOW | Naming | REQ-054 | `EmptyStateProps.icon` is string, not component |
| DX-010 | LOW | Naming | REQ-044 | `activeFilterCount` prop duplicates derived state |
| DX-011 | HIGH | Complexity | REQ-031 | Full status CRUD contracts for a feature not in MVP scope |
| DX-012 | MEDIUM | Complexity | N/A | `bulkUpdateIssues` has no matching requirement |
| DX-013 | MEDIUM | Complexity | REQ-001 | Password complexity rules in spec not reflected in Zod |
| DX-014 | MEDIUM | Complexity | REQ-037 | `updatedAt` optimistic locking breaks on rapid inline edits |
| DX-015 | LOW | Complexity | REQ-050 | Search API requires `workspaceId` client-side when derivable server-side |
| DX-016 | HIGH | Type Safety | REQ-034, REQ-035 | `z.any()` for Tiptap content is a validation hole |
| DX-017 | MEDIUM | Type Safety | REQ-036 | `ActivityMetadata` uses mixed discriminator keys |
| DX-018 | LOW | Type Safety | REQ-021 | `ProjectWithCounts.isFavorite` looks like a DB field |
| DX-019 | HIGH | Testability | All | Server actions have no dependency injection for testing |
| DX-020 | MEDIUM | Testability | All | No test data factories or fixture guidance |
| DX-021 | LOW | Naming/Onboarding | All | No ADRs for key technical decisions |
| DX-022 | LOW | Onboarding | All | No implementation order or dependency graph |
| DX-023 | MEDIUM | Composition | REQ-027 | `IssueDetailProps` is monolithic with 8 data dependencies |

---

## Priority Recommendations (Top 5 to Fix Before Implementation)

1. **DX-001 + DX-016**: Fix type safety holes (`onFieldChange` and `z.any()`) -- these will cause the most runtime bugs.
2. **DX-006**: Unify `prefix`/`key`/`projectKey` naming -- this will cause the most developer confusion.
3. **DX-011 + DX-012**: Remove orphaned contracts (status CRUD, bulk update) -- this saves 3+ days of wasted implementation.
4. **DX-019**: Add dependency injection or at least a centralized `requireAuth()` helper -- essential for test velocity.
5. **DX-014**: Fix optimistic locking strategy before implementing inline edits -- the current design will produce constant 409 errors.
