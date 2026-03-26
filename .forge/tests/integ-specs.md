# Integration Test Specifications: PMApp

**Date:** 2026-03-26
**Author:** IntegTestWriter (Forge Pipeline)
**Stack:** Next.js 15 + TypeScript + Vitest + Prisma + NextAuth.js
**Phase:** MVP (Phase 1)

---

## Table of Contents

1. [Test Environment & Conventions](#1-test-environment--conventions)
2. [Auth -> Workspace Integration](#2-auth---workspace-integration)
3. [Workspace -> Project Integration](#3-workspace---project-integration)
4. [Project -> Issue Integration](#4-project---issue-integration)
5. [Issue -> Board Integration](#5-issue---board-integration)
6. [Issue -> Comments Integration](#6-issue---comments-integration)
7. [Issue -> Labels Integration](#7-issue---labels-integration)
8. [Search -> Issues Integration](#8-search---issues-integration)
9. [Data Flow: Server Action -> DB -> Revalidation](#9-data-flow-server-action---db---revalidation)
10. [Auth Middleware -> Protected Routes](#10-auth-middleware---protected-routes)
11. [Workspace Isolation (Multi-Tenancy)](#11-workspace-isolation-multi-tenancy)
12. [API Contract Validation: Valid Inputs](#12-api-contract-validation-valid-inputs)
13. [API Contract Validation: Invalid Inputs](#13-api-contract-validation-invalid-inputs)
14. [Zod Boundary Validation](#14-zod-boundary-validation)

---

## 1. Test Environment & Conventions

### Database

- Use a dedicated test PostgreSQL database (`pmapp_test`) via Docker
- Each test suite uses Prisma transactions that roll back after each test (or `deleteMany` cleanup)
- Seed helper functions provide reusable factory methods for User, Workspace, Project, Issue, etc.

### Auth Context

- Mock NextAuth `auth()` via Vitest module mocks to return a controlled `Session` object
- Helper: `mockSession(userId: string)` sets the current auth context
- Helper: `clearSession()` clears auth context to simulate unauthenticated state

### Naming Convention

- Test IDs: `INTEG-{NNN}` (e.g., `INTEG-001`)
- Describe blocks group by integration boundary (e.g., `Auth -> Workspace`)
- Test names use `should` + action + expected outcome format

### Cleanup Strategy

- After each test: delete created records in reverse dependency order
- After each suite: run `prisma.$executeRaw('TRUNCATE ... CASCADE')` on all tables
- Shared fixtures created in `beforeAll` are cleaned in `afterAll`

### Helpers (to be implemented in `src/test/helpers/`)

| Helper | Purpose |
|--------|---------|
| `createTestUser(overrides?)` | Creates a User record with defaults, returns user + cleanup fn |
| `createTestWorkspace(ownerId, overrides?)` | Creates Workspace + WorkspaceMember (OWNER), returns workspace |
| `addMember(workspaceId, userId, role)` | Adds WorkspaceMember record |
| `createTestProject(workspaceId, overrides?)` | Creates Project + default WorkflowStatuses |
| `createTestIssue(projectId, reporterId, overrides?)` | Creates Issue with auto-generated key |
| `createTestLabel(workspaceId, overrides?)` | Creates Label record |
| `createTestComment(issueId, authorId, overrides?)` | Creates Comment record |
| `getStatuses(projectId)` | Returns all WorkflowStatuses for a project |
| `mockSession(userId)` | Mocks `auth()` to return session for the user |
| `clearSession()` | Clears the auth mock |

---

## 2. Auth -> Workspace Integration

### INTEG-001: Sign-up creates default workspace and membership

| Field | Value |
|-------|-------|
| **Test Name** | should create a default workspace with OWNER role on email/password sign-up |
| **REQ References** | REQ-001, REQ-009 |
| **Setup** | Empty database, no existing users |
| **Action Sequence** | 1. Call `signUp({ name: "Alice", email: "alice@test.com", password: "Passw0rd!" })`. 2. Query database for the created User. 3. Query WorkspaceMember records for the user. 4. Query the Workspace linked via the membership. |
| **Expected Outcome** | 1. `signUp` returns `{ success: true, data: { userId } }`. 2. User record exists with hashed password (not plaintext). 3. Exactly 1 WorkspaceMember record exists for the user. 4. The WorkspaceMember has `role: OWNER`. 5. The linked Workspace exists with `ownerId` matching the user. 6. Workspace slug is derived from the name (e.g., "alice" or "alices-workspace"). |
| **Cleanup** | Delete User (cascades to WorkspaceMember, Workspace via relation). |

---

### INTEG-002: OAuth sign-in for first-time user has no workspace

| Field | Value |
|-------|-------|
| **Test Name** | should create user without password on OAuth and have zero workspaces |
| **REQ References** | REQ-002, REQ-016 |
| **Setup** | Empty database |
| **Action Sequence** | 1. Simulate NextAuth OAuth callback by creating a User record with `password: null` and an Account record (provider: "google"). 2. Query WorkspaceMember count for the user. |
| **Expected Outcome** | 1. User record has `password: null`. 2. Account record exists with `provider: "google"`. 3. WorkspaceMember count is 0 (user needs to create or join a workspace). |
| **Cleanup** | Delete User (cascades). |

---

### INTEG-003: Authenticated user can access their workspace

| Field | Value |
|-------|-------|
| **Test Name** | should allow authenticated user to access workspace they belong to |
| **REQ References** | REQ-005, REQ-009, REQ-014 |
| **Setup** | 1. Create User A. 2. Create Workspace W1 with User A as OWNER. |
| **Action Sequence** | 1. Mock session as User A. 2. Call a workspace data-fetching function (e.g., query workspace by slug where user is a member). 3. Verify the workspace data is returned. |
| **Expected Outcome** | 1. Workspace data for W1 is returned successfully. 2. User A's role is OWNER. |
| **Cleanup** | Delete User A (cascades). |

---

### INTEG-004: Authenticated user cannot access workspace they do not belong to

| Field | Value |
|-------|-------|
| **Test Name** | should deny access when user is not a member of the workspace |
| **REQ References** | REQ-005, REQ-014 |
| **Setup** | 1. Create User A with Workspace W1. 2. Create User B with Workspace W2. |
| **Action Sequence** | 1. Mock session as User B. 2. Attempt to fetch workspace W1 data (where User B is not a member). |
| **Expected Outcome** | 1. The query returns null or the server action returns `{ success: false, error: "Not authorized" }`. 2. No data from W1 is exposed to User B. |
| **Cleanup** | Delete Users A and B (cascades). |

---

### INTEG-005: Invite flow adds member to workspace

| Field | Value |
|-------|-------|
| **Test Name** | should create WorkspaceMember with invited role when invite is accepted |
| **REQ References** | REQ-007, REQ-008 |
| **Setup** | 1. Create User A (Owner of Workspace W1). 2. Create User B (not a member of W1). |
| **Action Sequence** | 1. Mock session as User A. 2. Call `inviteMember({ workspaceId: W1.id, email: "b@test.com", role: "MEMBER" })`. 3. Extract the invitation token from the result. 4. Mock session as User B. 5. Call `acceptInvite(token)`. 6. Query WorkspaceMember for User B in W1. |
| **Expected Outcome** | 1. `inviteMember` returns `{ success: true, data: { invitationId, token } }`. 2. WorkspaceInvitation record has status PENDING initially. 3. `acceptInvite` returns `{ success: true, data: { workspaceSlug } }`. 4. WorkspaceMember record exists for User B with `role: MEMBER`. 5. Invitation status is updated to ACCEPTED. |
| **Cleanup** | Delete Users A and B (cascades). |

---

### INTEG-006: Post-signup redirect logic with zero workspaces

| Field | Value |
|-------|-------|
| **Test Name** | should detect zero workspaces and indicate redirect to create-workspace |
| **REQ References** | REQ-016 |
| **Setup** | 1. Create User A with no workspace memberships. |
| **Action Sequence** | 1. Mock session as User A. 2. Query WorkspaceMember count for User A. 3. Evaluate redirect logic: if count === 0, target is `/create-workspace`. |
| **Expected Outcome** | 1. WorkspaceMember count is 0. 2. Redirect target resolves to `/create-workspace`. |
| **Cleanup** | Delete User A. |

---

### INTEG-007: Post-signup redirect logic with existing workspace

| Field | Value |
|-------|-------|
| **Test Name** | should detect existing workspace and redirect to workspace projects |
| **REQ References** | REQ-016 |
| **Setup** | 1. Create User A with Workspace W1 (slug: "acme"). |
| **Action Sequence** | 1. Mock session as User A. 2. Query WorkspaceMember records for User A. 3. Evaluate redirect logic: if count >= 1, target is `/{workspace-slug}/projects`. |
| **Expected Outcome** | 1. WorkspaceMember count is 1. 2. Redirect target resolves to `/acme/projects`. |
| **Cleanup** | Delete User A (cascades). |

---

## 3. Workspace -> Project Integration

### INTEG-008: Create project in workspace seeds default statuses

| Field | Value |
|-------|-------|
| **Test Name** | should create project with 6 default WorkflowStatuses on project creation |
| **REQ References** | REQ-017, REQ-031 |
| **Setup** | 1. Create User A as OWNER of Workspace W1. |
| **Action Sequence** | 1. Mock session as User A. 2. Call `createProject({ name: "Mobile App", prefix: "MA", workspaceId: W1.id })`. 3. Query WorkflowStatus records for the new project. |
| **Expected Outcome** | 1. `createProject` returns `{ success: true, data: { project } }`. 2. Project record exists with `issueCounter: 0`. 3. Exactly 6 WorkflowStatus records created: Backlog (pos 0, BACKLOG), Todo (pos 1, TODO), In Progress (pos 2, IN_PROGRESS), In Review (pos 3, IN_PROGRESS), Done (pos 4, DONE), Cancelled (pos 5, CANCELLED). 4. Project belongs to workspace W1. |
| **Cleanup** | Delete project (cascades to statuses), delete User A. |

---

### INTEG-009: Project key must be unique within workspace

| Field | Value |
|-------|-------|
| **Test Name** | should reject duplicate project prefix within the same workspace |
| **REQ References** | REQ-019 |
| **Setup** | 1. Create User A as OWNER of Workspace W1. 2. Create Project P1 with prefix "MA" in W1. |
| **Action Sequence** | 1. Mock session as User A. 2. Call `createProject({ name: "Another Project", prefix: "MA", workspaceId: W1.id })`. |
| **Expected Outcome** | 1. Returns `{ success: false, error: "Project key already exists" }`. 2. No new Project record is created. |
| **Cleanup** | Delete User A (cascades). |

---

### INTEG-010: Same project key allowed in different workspaces

| Field | Value |
|-------|-------|
| **Test Name** | should allow the same project prefix in different workspaces |
| **REQ References** | REQ-019 |
| **Setup** | 1. Create User A as OWNER of Workspace W1. 2. Create User B as OWNER of Workspace W2. 3. Create Project in W1 with prefix "MA". |
| **Action Sequence** | 1. Mock session as User B. 2. Call `createProject({ name: "Mobile App", prefix: "MA", workspaceId: W2.id })`. |
| **Expected Outcome** | 1. Returns `{ success: true }`. 2. Two projects exist with prefix "MA" in different workspaces. |
| **Cleanup** | Delete Users A and B (cascades). |

---

### INTEG-011: Workspace member access to projects

| Field | Value |
|-------|-------|
| **Test Name** | should allow workspace MEMBER to view projects but not create them |
| **REQ References** | REQ-020, REQ-017 |
| **Setup** | 1. Create User A (OWNER) and User B (MEMBER) in Workspace W1. 2. Create Project P1 in W1. |
| **Action Sequence** | 1. Mock session as User B. 2. Query projects in W1 (should succeed). 3. Call `createProject({ name: "Unauthorized", prefix: "UA", workspaceId: W1.id })`. |
| **Expected Outcome** | 1. Project list query returns P1 successfully. 2. `createProject` returns `{ success: false, error: "Not authorized" }` (MEMBER cannot create projects per auth matrix). |
| **Cleanup** | Delete Users A and B (cascades). |

---

### INTEG-012: Star/unstar project is per-user

| Field | Value |
|-------|-------|
| **Test Name** | should store project favorites per user independently |
| **REQ References** | REQ-021 |
| **Setup** | 1. Create Users A and B, both MEMBERs of Workspace W1. 2. Create Project P1. |
| **Action Sequence** | 1. Mock session as User A. Call `toggleProjectFavorite(P1.id)`. 2. Mock session as User B. Query ProjectFavorite for User B on P1. |
| **Expected Outcome** | 1. ProjectFavorite record exists for User A + P1. 2. No ProjectFavorite record exists for User B + P1 (User B did not star it). 3. Toggling again as User A removes the favorite. |
| **Cleanup** | Delete Users A and B (cascades). |

---

## 4. Project -> Issue Integration

### INTEG-013: Create issue generates sequential key

| Field | Value |
|-------|-------|
| **Test Name** | should auto-generate issue key using project prefix and incrementing counter |
| **REQ References** | REQ-025, REQ-026 |
| **Setup** | 1. Create User A (OWNER) in Workspace W1. 2. Create Project P1 with prefix "PROJ" and `issueCounter: 0`. 3. Get the Backlog status for P1. |
| **Action Sequence** | 1. Mock session as User A. 2. Call `createIssue({ title: "First issue", type: "TASK", priority: "MEDIUM", projectId: P1.id, statusId: backlogStatusId })`. 3. Call `createIssue({ title: "Second issue", type: "BUG", priority: "HIGH", projectId: P1.id, statusId: backlogStatusId })`. 4. Query the project's `issueCounter`. |
| **Expected Outcome** | 1. First issue has `key: "PROJ-1"`, `number: 1`. 2. Second issue has `key: "PROJ-2"`, `number: 2`. 3. Project `issueCounter` is now 2. 4. Both issues have `reporterId` matching User A. 5. Both issues have a valid `position` string. |
| **Cleanup** | Delete User A (cascades). |

---

### INTEG-014: Issue key is unique globally

| Field | Value |
|-------|-------|
| **Test Name** | should enforce global uniqueness on issue keys |
| **REQ References** | REQ-026 |
| **Setup** | 1. Create User A (OWNER) in Workspace W1. 2. Create Projects P1 (prefix "AA") and P2 (prefix "BB"). |
| **Action Sequence** | 1. Create issue in P1 -> key "AA-1". 2. Create issue in P2 -> key "BB-1". 3. Query all issues and verify no key collisions. |
| **Expected Outcome** | 1. Keys "AA-1" and "BB-1" are distinct. 2. Both exist in the database with unique `key` values. |
| **Cleanup** | Delete User A (cascades). |

---

### INTEG-015: Issue counter is atomic under concurrent creation

| Field | Value |
|-------|-------|
| **Test Name** | should not produce duplicate issue numbers under concurrent creation |
| **REQ References** | REQ-026 |
| **Setup** | 1. Create User A (OWNER) in Workspace W1. 2. Create Project P1 with prefix "CONC". |
| **Action Sequence** | 1. Mock session as User A. 2. Fire 5 `createIssue` calls concurrently using `Promise.all`. |
| **Expected Outcome** | 1. All 5 calls succeed (or some may retry due to transaction conflicts). 2. The resulting issue numbers are all distinct. 3. No two issues share the same key. 4. Project `issueCounter` equals the highest issued number. |
| **Cleanup** | Delete User A (cascades). |

---

### INTEG-016: Issue is created in correct status column

| Field | Value |
|-------|-------|
| **Test Name** | should create issue in the specified status |
| **REQ References** | REQ-025, REQ-031 |
| **Setup** | 1. Create User A (OWNER), Workspace W1, Project P1. 2. Get "Todo" status for P1. |
| **Action Sequence** | 1. Mock session as User A. 2. Call `createIssue({ ..., statusId: todoStatusId })`. 3. Query the issue and include its status relation. |
| **Expected Outcome** | 1. Issue's `statusId` matches the "Todo" status. 2. Issue's status category is `TODO`. |
| **Cleanup** | Delete User A (cascades). |

---

### INTEG-017: Deleted issue key is not reused

| Field | Value |
|-------|-------|
| **Test Name** | should not reuse issue key after soft-deleting an issue |
| **REQ References** | REQ-026, REQ-038 |
| **Setup** | 1. Create User A (OWNER), Workspace W1, Project P1 (prefix "DEL"). 2. Create Issue I1 -> key "DEL-1". |
| **Action Sequence** | 1. Mock session as User A. 2. Call `deleteIssue(I1.id)` (soft delete). 3. Call `createIssue({ title: "New", ... })`. 4. Query the new issue's key. |
| **Expected Outcome** | 1. Deleted issue has `deletedAt` set. 2. New issue has key "DEL-2" (not "DEL-1"). 3. Project `issueCounter` is 2. |
| **Cleanup** | Delete User A (cascades). |

---

### INTEG-018: Issue creation logs activity

| Field | Value |
|-------|-------|
| **Test Name** | should create ISSUE_CREATED activity log entry on issue creation |
| **REQ References** | REQ-025, REQ-036 |
| **Setup** | 1. Create User A (OWNER), Workspace W1, Project P1. |
| **Action Sequence** | 1. Mock session as User A. 2. Call `createIssue(...)`. 3. Query Activity records for the project. |
| **Expected Outcome** | 1. Activity record exists with `type: "ISSUE_CREATED"`. 2. `actorId` matches User A. 3. `issueId` matches the created issue. 4. `projectId` matches P1. |
| **Cleanup** | Delete User A (cascades). |

---

### INTEG-019: VIEWER cannot create issues

| Field | Value |
|-------|-------|
| **Test Name** | should reject issue creation from VIEWER role |
| **REQ References** | REQ-025 (Auth matrix) |
| **Setup** | 1. Create User A (OWNER) and User V (VIEWER) in Workspace W1. 2. Create Project P1. |
| **Action Sequence** | 1. Mock session as User V. 2. Call `createIssue({ title: "Blocked", ..., projectId: P1.id })`. |
| **Expected Outcome** | 1. Returns `{ success: false, error: "Not authorized" }`. 2. No Issue record created. 3. Project `issueCounter` unchanged. |
| **Cleanup** | Delete Users A and V (cascades). |

---

## 5. Issue -> Board Integration

### INTEG-020: Move issue between status columns (drag-and-drop)

| Field | Value |
|-------|-------|
| **Test Name** | should update issue status and position when moved between columns |
| **REQ References** | REQ-041 |
| **Setup** | 1. Create User A (OWNER), Workspace W1, Project P1. 2. Create Issue I1 in "Backlog" status. 3. Get "In Progress" status ID. |
| **Action Sequence** | 1. Mock session as User A. 2. Call `moveIssue({ id: I1.id, statusId: inProgressStatusId, position: "a0" })`. 3. Query Issue I1. 4. Query Activity records. |
| **Expected Outcome** | 1. Issue I1 `statusId` is now the "In Progress" status. 2. Issue I1 `position` is "a0". 3. Activity record exists with `type: "STATUS_CHANGED"`, `metadata: { field: "status", from: "Backlog", to: "In Progress" }`. |
| **Cleanup** | Delete User A (cascades). |

---

### INTEG-021: Reorder issue within same column

| Field | Value |
|-------|-------|
| **Test Name** | should update issue position without changing status |
| **REQ References** | REQ-042 |
| **Setup** | 1. Create User A (OWNER), Workspace W1, Project P1. 2. Create Issues I1 (position "a0"), I2 (position "a1"), I3 (position "a2") all in "Backlog". |
| **Action Sequence** | 1. Mock session as User A. 2. Call `reorderIssue({ id: I3.id, position: "a0V" })` (move I3 between I1 and I2). 3. Query all three issues. |
| **Expected Outcome** | 1. I3's position is "a0V" (between "a0" and "a1"). 2. I3's `statusId` is unchanged (still "Backlog"). 3. I1 and I2 positions are unchanged. 4. No STATUS_CHANGED activity logged (status did not change). |
| **Cleanup** | Delete User A (cascades). |

---

### INTEG-022: Board column issue counts reflect reality

| Field | Value |
|-------|-------|
| **Test Name** | should correctly count issues per status column |
| **REQ References** | REQ-045 |
| **Setup** | 1. Create User A (OWNER), Workspace W1, Project P1. 2. Create 3 issues in "Backlog", 2 in "Todo", 0 in "In Progress". |
| **Action Sequence** | 1. Query issues grouped by statusId for P1. 2. Count issues per status. |
| **Expected Outcome** | 1. Backlog count: 3. 2. Todo count: 2. 3. In Progress count: 0. 4. Done count: 0. 5. Cancelled count: 0. |
| **Cleanup** | Delete User A (cascades). |

---

### INTEG-023: Moving issue updates source and target column counts

| Field | Value |
|-------|-------|
| **Test Name** | should decrement source column count and increment target column count after move |
| **REQ References** | REQ-041, REQ-045 |
| **Setup** | 1. Create User A (OWNER), Workspace W1, Project P1. 2. Create 3 issues in "Backlog", 1 issue in "Todo". |
| **Action Sequence** | 1. Mock session as User A. 2. Move one issue from "Backlog" to "Todo". 3. Re-count issues per status. |
| **Expected Outcome** | 1. Backlog count: 2 (was 3). 2. Todo count: 2 (was 1). |
| **Cleanup** | Delete User A (cascades). |

---

### INTEG-024: VIEWER cannot move issues

| Field | Value |
|-------|-------|
| **Test Name** | should reject moveIssue from VIEWER role |
| **REQ References** | REQ-041 (Auth matrix) |
| **Setup** | 1. Create User A (OWNER) and User V (VIEWER) in Workspace W1. 2. Create Project P1 with Issue I1 in "Backlog". |
| **Action Sequence** | 1. Mock session as User V. 2. Call `moveIssue({ id: I1.id, statusId: todoStatusId, position: "a0" })`. |
| **Expected Outcome** | 1. Returns `{ success: false, error: "Not authorized" }`. 2. Issue I1's `statusId` is unchanged. |
| **Cleanup** | Delete Users A and V (cascades). |

---

### INTEG-025: Quick-add issue from board column

| Field | Value |
|-------|-------|
| **Test Name** | should create issue with the column's status when quick-added from board |
| **REQ References** | REQ-043, REQ-025 |
| **Setup** | 1. Create User A (OWNER), Workspace W1, Project P1. 2. Get "In Progress" status. |
| **Action Sequence** | 1. Mock session as User A. 2. Call `createIssue({ title: "Quick task", type: "TASK", priority: "MEDIUM", projectId: P1.id, statusId: inProgressStatusId })`. |
| **Expected Outcome** | 1. Issue created with status "In Progress". 2. Issue has `type: TASK`, `priority: MEDIUM`. 3. Issue key is correctly generated. 4. Issue position places it at the bottom of the column. |
| **Cleanup** | Delete User A (cascades). |

---

## 6. Issue -> Comments Integration

### INTEG-026: Add comment to issue

| Field | Value |
|-------|-------|
| **Test Name** | should create comment and log activity |
| **REQ References** | REQ-035, REQ-036 |
| **Setup** | 1. Create User A (OWNER), Workspace W1, Project P1, Issue I1. |
| **Action Sequence** | 1. Mock session as User A. 2. Call `createComment({ issueId: I1.id, body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Test comment" }] }] } })`. 3. Query Comment records for I1. 4. Query Activity records for I1. |
| **Expected Outcome** | 1. `createComment` returns `{ success: true, data: { comment } }`. 2. Comment record exists with `authorId` matching User A. 3. `bodyText` contains "Test comment". 4. Activity record exists with `type: "COMMENT_ADDED"`. |
| **Cleanup** | Delete User A (cascades). |

---

### INTEG-027: VIEWER can add comments

| Field | Value |
|-------|-------|
| **Test Name** | should allow VIEWER to add comments to issues |
| **REQ References** | REQ-035 (All roles including VIEWER can comment) |
| **Setup** | 1. Create User A (OWNER) and User V (VIEWER) in Workspace W1. 2. Create Project P1, Issue I1. |
| **Action Sequence** | 1. Mock session as User V. 2. Call `createComment({ issueId: I1.id, body: tiptapContent })`. |
| **Expected Outcome** | 1. Returns `{ success: true }`. 2. Comment record exists with `authorId` matching User V. |
| **Cleanup** | Delete Users A and V (cascades). |

---

### INTEG-028: Edit own comment

| Field | Value |
|-------|-------|
| **Test Name** | should allow comment author to edit their own comment |
| **REQ References** | REQ-035 |
| **Setup** | 1. Create User A (OWNER), Workspace W1, Project P1, Issue I1. 2. Create Comment C1 by User A. |
| **Action Sequence** | 1. Mock session as User A. 2. Call `updateComment({ id: C1.id, body: updatedTiptapContent })`. 3. Query the comment. |
| **Expected Outcome** | 1. Returns `{ success: true }`. 2. Comment body is updated. 3. Comment `updatedAt` is later than `createdAt`. |
| **Cleanup** | Delete User A (cascades). |

---

### INTEG-029: Cannot edit another user's comment

| Field | Value |
|-------|-------|
| **Test Name** | should reject editing a comment authored by another user |
| **REQ References** | REQ-035 |
| **Setup** | 1. Create Users A (OWNER) and B (MEMBER) in Workspace W1. 2. Create Project P1, Issue I1, Comment C1 by User A. |
| **Action Sequence** | 1. Mock session as User B. 2. Call `updateComment({ id: C1.id, body: newContent })`. |
| **Expected Outcome** | 1. Returns `{ success: false, error: "Not the author" }`. 2. Comment body is unchanged. |
| **Cleanup** | Delete Users A and B (cascades). |

---

### INTEG-030: ADMIN can delete any comment

| Field | Value |
|-------|-------|
| **Test Name** | should allow ADMIN to delete any user's comment |
| **REQ References** | REQ-035 |
| **Setup** | 1. Create User A (ADMIN) and User B (MEMBER) in Workspace W1. 2. Create Project P1, Issue I1, Comment C1 by User B. |
| **Action Sequence** | 1. Mock session as User A. 2. Call `deleteComment({ id: C1.id })`. 3. Query Comment records for I1. |
| **Expected Outcome** | 1. Returns `{ success: true }`. 2. Comment C1 no longer exists in the database. |
| **Cleanup** | Delete Users A and B (cascades). |

---

### INTEG-031: Comments ordered chronologically

| Field | Value |
|-------|-------|
| **Test Name** | should return comments in chronological order (oldest first) |
| **REQ References** | REQ-035 |
| **Setup** | 1. Create User A (OWNER), Workspace W1, Project P1, Issue I1. 2. Create Comments C1, C2, C3 with slight time gaps (or explicit createdAt). |
| **Action Sequence** | 1. Query comments for I1 ordered by `createdAt ASC`. |
| **Expected Outcome** | 1. Comments returned in order: C1, C2, C3. 2. Each comment's `createdAt` is <= the next one's. |
| **Cleanup** | Delete User A (cascades). |

---

## 7. Issue -> Labels Integration

### INTEG-032: Assign labels to issue on creation

| Field | Value |
|-------|-------|
| **Test Name** | should attach specified labels to issue when created with labelIds |
| **REQ References** | REQ-032, REQ-025 |
| **Setup** | 1. Create User A (OWNER), Workspace W1, Project P1. 2. Create Labels L1 ("Bug"), L2 ("Frontend") in W1. |
| **Action Sequence** | 1. Mock session as User A. 2. Call `createIssue({ ..., labelIds: [L1.id, L2.id] })`. 3. Query the issue with its labels relation. |
| **Expected Outcome** | 1. Issue has exactly 2 labels attached. 2. Labels are L1 and L2. |
| **Cleanup** | Delete User A (cascades). |

---

### INTEG-033: Add and remove labels via issue update

| Field | Value |
|-------|-------|
| **Test Name** | should update label associations when labelIds are changed |
| **REQ References** | REQ-032, REQ-037 |
| **Setup** | 1. Create User A (OWNER), Workspace W1, Project P1. 2. Create Labels L1, L2, L3. 3. Create Issue I1 with labels [L1, L2]. |
| **Action Sequence** | 1. Mock session as User A. 2. Call `updateIssue({ id: I1.id, labelIds: [L2.id, L3.id], updatedAt: I1.updatedAt })`. 3. Query Issue I1's labels. |
| **Expected Outcome** | 1. Issue now has labels [L2, L3]. 2. L1 was removed, L3 was added, L2 was retained. 3. Activity records exist for "LABEL_REMOVED" (L1) and "LABEL_ADDED" (L3). |
| **Cleanup** | Delete User A (cascades). |

---

### INTEG-034: Labels are workspace-scoped, shared across projects

| Field | Value |
|-------|-------|
| **Test Name** | should allow the same label to be applied to issues in different projects |
| **REQ References** | REQ-032 |
| **Setup** | 1. Create User A (OWNER), Workspace W1, Projects P1 and P2. 2. Create Label L1 in W1. 3. Create Issue I1 in P1, Issue I2 in P2. |
| **Action Sequence** | 1. Assign L1 to both I1 and I2 via `updateIssue`. 2. Query issues with labels. |
| **Expected Outcome** | 1. Both I1 and I2 have label L1 attached. 2. Only one Label record exists (workspace-scoped, shared). |
| **Cleanup** | Delete User A (cascades). |

---

### INTEG-035: Deleting a label removes it from all issues

| Field | Value |
|-------|-------|
| **Test Name** | should cascade-remove label from all issues when label is deleted |
| **REQ References** | REQ-032 |
| **Setup** | 1. Create User A (OWNER), Workspace W1, Project P1. 2. Create Label L1. 3. Create Issues I1, I2 both with L1 assigned. |
| **Action Sequence** | 1. Mock session as User A. 2. Call `deleteLabel({ id: L1.id })`. 3. Query I1 and I2's labels. |
| **Expected Outcome** | 1. Label L1 no longer exists. 2. Both I1 and I2 have empty label arrays. |
| **Cleanup** | Delete User A (cascades). |

---

### INTEG-036: Duplicate label name rejected within workspace

| Field | Value |
|-------|-------|
| **Test Name** | should reject creating a label with a name that already exists in the workspace |
| **REQ References** | REQ-032 |
| **Setup** | 1. Create User A (OWNER), Workspace W1. 2. Create Label "Critical" in W1. |
| **Action Sequence** | 1. Mock session as User A. 2. Call `createLabel({ workspaceId: W1.id, name: "Critical", color: "#FF0000" })`. |
| **Expected Outcome** | 1. Returns `{ success: false, error: "Label name already exists" }`. 2. Only one "Critical" label exists. |
| **Cleanup** | Delete User A (cascades). |

---

## 8. Search -> Issues Integration

### INTEG-037: Search by issue key returns exact match

| Field | Value |
|-------|-------|
| **Test Name** | should return exact match when searching by full issue key |
| **REQ References** | REQ-050, REQ-051 |
| **Setup** | 1. Create User A (OWNER), Workspace W1, Project P1 (prefix "SRCH"). 2. Create Issues: "SRCH-1" ("Login page"), "SRCH-2" ("Dashboard"), "SRCH-3" ("Login fix"). |
| **Action Sequence** | 1. Mock session as User A. 2. Search with query "SRCH-2". |
| **Expected Outcome** | 1. Results contain exactly 1 item. 2. The result has key "SRCH-2" and title "Dashboard". |
| **Cleanup** | Delete User A (cascades). |

---

### INTEG-038: Search by title keyword returns matching issues

| Field | Value |
|-------|-------|
| **Test Name** | should return issues whose titles contain the search query |
| **REQ References** | REQ-050 |
| **Setup** | 1. Create User A (OWNER), Workspace W1, Project P1. 2. Create Issues: "Login page redesign", "Dashboard widgets", "Login fix for mobile". |
| **Action Sequence** | 1. Mock session as User A. 2. Search with query "Login". |
| **Expected Outcome** | 1. Results contain 2 items ("Login page redesign" and "Login fix for mobile"). 2. "Dashboard widgets" is not in results. |
| **Cleanup** | Delete User A (cascades). |

---

### INTEG-039: Search results scoped to current workspace

| Field | Value |
|-------|-------|
| **Test Name** | should not return issues from other workspaces |
| **REQ References** | REQ-050 |
| **Setup** | 1. Create User A (OWNER of W1). 2. Create User B (OWNER of W2). 3. Create Project P1 in W1 with issue "Shared title". 4. Create Project P2 in W2 with issue "Shared title". |
| **Action Sequence** | 1. Mock session as User A. 2. Search in W1 with query "Shared". |
| **Expected Outcome** | 1. Results contain only the issue from W1. 2. The issue from W2 is not included. |
| **Cleanup** | Delete Users A and B (cascades). |

---

### INTEG-040: Search excludes soft-deleted issues

| Field | Value |
|-------|-------|
| **Test Name** | should not return soft-deleted issues in search results |
| **REQ References** | REQ-050, REQ-038 |
| **Setup** | 1. Create User A (OWNER), Workspace W1, Project P1. 2. Create Issue I1 ("Important task"), Issue I2 ("Deleted task"). 3. Soft-delete I2. |
| **Action Sequence** | 1. Mock session as User A. 2. Search with query "task". |
| **Expected Outcome** | 1. Results contain only I1. 2. I2 (soft-deleted) is excluded. |
| **Cleanup** | Delete User A (cascades). |

---

### INTEG-041: Search with minimum character requirement

| Field | Value |
|-------|-------|
| **Test Name** | should not search with fewer than 2 characters |
| **REQ References** | REQ-050 |
| **Setup** | 1. Create User A (OWNER), Workspace W1, Project P1 with issues. |
| **Action Sequence** | 1. Mock session as User A. 2. Search with query "a" (1 character). |
| **Expected Outcome** | 1. Returns empty results or validation error (min 1 char per schema, but UI requires 2). 2. No database query executed for single-character input (enforced by validation or client guard). |
| **Cleanup** | Delete User A (cascades). |

---

## 9. Data Flow: Server Action -> DB -> Revalidation

### INTEG-042: createIssue produces correct DB state and activity

| Field | Value |
|-------|-------|
| **Test Name** | should persist all issue fields and create activity record in a single transaction |
| **REQ References** | REQ-025, REQ-036, REQ-037 |
| **Setup** | 1. Create User A (OWNER), Workspace W1, Project P1. 2. Create Labels L1, L2 in W1. 3. Get "Todo" status. |
| **Action Sequence** | 1. Mock session as User A. 2. Call `createIssue({ title: "Full issue", description: tiptapJson, type: "STORY", priority: "HIGH", projectId: P1.id, statusId: todoStatusId, assigneeId: UserA.id, labelIds: [L1.id, L2.id], dueDate: "2026-04-15" })`. 3. Query the issue with all relations. 4. Query activity for the project. |
| **Expected Outcome** | 1. Issue record: title "Full issue", type STORY, priority HIGH, reporterId = User A, assigneeId = User A, dueDate set, position is non-empty string. 2. descriptionText extracted from tiptap JSON (plain text). 3. Issue has 2 labels attached. 4. Issue key is "{PREFIX}-1". 5. Project issueCounter = 1. 6. Activity record: type "ISSUE_CREATED", actorId = User A. |
| **Cleanup** | Delete User A (cascades). |

---

### INTEG-043: updateIssue with optimistic locking (conflict)

| Field | Value |
|-------|-------|
| **Test Name** | should reject update when updatedAt does not match (optimistic locking) |
| **REQ References** | REQ-037 |
| **Setup** | 1. Create User A (OWNER), Workspace W1, Project P1, Issue I1. |
| **Action Sequence** | 1. Mock session as User A. 2. Record I1.updatedAt. 3. Update I1 title directly via Prisma (simulating another user's edit). 4. Call `updateIssue({ id: I1.id, title: "My change", updatedAt: originalUpdatedAt })`. |
| **Expected Outcome** | 1. Returns `{ success: false, error: "Conflict: issue was modified" }` (or 409 equivalent). 2. Issue title remains as set by the direct Prisma update (not "My change"). |
| **Cleanup** | Delete User A (cascades). |

---

### INTEG-044: updateIssue logs activity for each changed field

| Field | Value |
|-------|-------|
| **Test Name** | should create separate activity entries for each changed field |
| **REQ References** | REQ-036, REQ-037 |
| **Setup** | 1. Create User A (OWNER), Workspace W1, Project P1. 2. Create Issue I1 with status "Backlog", priority MEDIUM, assignee null. |
| **Action Sequence** | 1. Mock session as User A. 2. Call `updateIssue({ id: I1.id, statusId: todoStatusId, priority: "HIGH", assigneeId: UserA.id, updatedAt: I1.updatedAt })`. 3. Query Activity records for I1. |
| **Expected Outcome** | 1. Three Activity records created: one for status change, one for priority change, one for assignee change. 2. Status activity: `metadata.field = "status"`, `metadata.from = "Backlog"`, `metadata.to = "Todo"`. 3. Priority activity: `metadata.field = "priority"`, `metadata.from = "MEDIUM"`, `metadata.to = "HIGH"`. 4. Assignee activity: `metadata.field = "assignee"`, `metadata.from = null`, `metadata.to = UserA.name`. |
| **Cleanup** | Delete User A (cascades). |

---

### INTEG-045: deleteIssue soft-deletes and excludes from queries

| Field | Value |
|-------|-------|
| **Test Name** | should set deletedAt and exclude issue from board and list queries |
| **REQ References** | REQ-038 |
| **Setup** | 1. Create User A (OWNER), Workspace W1, Project P1. 2. Create Issues I1, I2 in "Backlog". |
| **Action Sequence** | 1. Mock session as User A. 2. Call `deleteIssue(I1.id)`. 3. Query issues for P1 (excluding soft-deleted). 4. Query the raw I1 record (without soft-delete filter). |
| **Expected Outcome** | 1. `deleteIssue` returns `{ success: true }`. 2. Filtered query returns only I2. 3. Raw I1 still exists with `deletedAt` set to a valid timestamp. |
| **Cleanup** | Delete User A (cascades). |

---

### INTEG-046: MEMBER can delete only own issues

| Field | Value |
|-------|-------|
| **Test Name** | should allow MEMBER to delete issues they reported but not others |
| **REQ References** | REQ-038 (Auth matrix) |
| **Setup** | 1. Create User A (OWNER) and User B (MEMBER) in Workspace W1. 2. Create Project P1. 3. Create Issue I1 reported by User A. 4. Create Issue I2 reported by User B. |
| **Action Sequence** | 1. Mock session as User B. 2. Call `deleteIssue(I1.id)` (not User B's issue). 3. Call `deleteIssue(I2.id)` (User B's issue). |
| **Expected Outcome** | 1. First call returns `{ success: false, error: "Not authorized" }`. I1 still exists. 2. Second call returns `{ success: true }`. I2 is soft-deleted. |
| **Cleanup** | Delete Users A and B (cascades). |

---

## 10. Auth Middleware -> Protected Routes

### INTEG-047: Unauthenticated request to protected route

| Field | Value |
|-------|-------|
| **Test Name** | should redirect unauthenticated request to /sign-in with callbackUrl |
| **REQ References** | REQ-005 |
| **Setup** | No session mocked (unauthenticated). |
| **Action Sequence** | 1. Simulate a request to a protected route (e.g., `/acme/projects`). 2. Evaluate middleware logic: check for valid session. |
| **Expected Outcome** | 1. Middleware redirects to `/sign-in?callbackUrl=%2Facme%2Fprojects`. 2. No protected data is returned. |
| **Cleanup** | None. |

---

### INTEG-048: Public routes bypass auth check

| Field | Value |
|-------|-------|
| **Test Name** | should allow access to public routes without authentication |
| **REQ References** | REQ-005 |
| **Setup** | No session mocked (unauthenticated). |
| **Action Sequence** | 1. Simulate requests to: `/sign-in`, `/sign-up`, `/forgot-password`, `/invite/some-token`, `/api/auth/session`. 2. Check that middleware does not redirect. |
| **Expected Outcome** | 1. All public routes pass through middleware without redirect. |
| **Cleanup** | None. |

---

### INTEG-049: Server Action verifies session independently

| Field | Value |
|-------|-------|
| **Test Name** | should return error when server action is called without valid session |
| **REQ References** | REQ-005 |
| **Setup** | Clear session (no auth context). |
| **Action Sequence** | 1. Clear session mock. 2. Call `createWorkspace({ name: "Test", slug: "test" })`. |
| **Expected Outcome** | 1. Returns `{ success: false, error }` with an auth-related error (e.g., "Not authenticated" or "Session expired"). 2. No Workspace record created. |
| **Cleanup** | None. |

---

### INTEG-050: Callback URL preserved after sign-in

| Field | Value |
|-------|-------|
| **Test Name** | should redirect to original URL after successful sign-in with callbackUrl |
| **REQ References** | REQ-005, REQ-003 |
| **Setup** | 1. Create User A with workspace W1 (slug: "acme"). |
| **Action Sequence** | 1. Evaluate middleware redirect for unauthenticated `/acme/projects` -> `/sign-in?callbackUrl=/acme/projects`. 2. Simulate successful sign-in as User A. 3. Evaluate post-sign-in redirect logic with callbackUrl present. |
| **Expected Outcome** | 1. After sign-in, redirect target is `/acme/projects` (the original callbackUrl). |
| **Cleanup** | Delete User A (cascades). |

---

## 11. Workspace Isolation (Multi-Tenancy)

### INTEG-051: User A cannot see Workspace B's projects

| Field | Value |
|-------|-------|
| **Test Name** | should not return projects from a workspace the user does not belong to |
| **REQ References** | REQ-005, REQ-020 |
| **Setup** | 1. Create User A (OWNER of W1) with Project P1. 2. Create User B (OWNER of W2) with Project P2. |
| **Action Sequence** | 1. Mock session as User A. 2. Query projects for workspace W2 (User A is not a member). |
| **Expected Outcome** | 1. Query returns empty array or authorization error. 2. P2 data is never exposed to User A. |
| **Cleanup** | Delete Users A and B (cascades). |

---

### INTEG-052: User A cannot see Workspace B's issues

| Field | Value |
|-------|-------|
| **Test Name** | should not return issues from a workspace the user does not belong to |
| **REQ References** | REQ-005, REQ-025 |
| **Setup** | 1. Create User A (OWNER of W1). 2. Create User B (OWNER of W2) with Project P2 and Issue I2. |
| **Action Sequence** | 1. Mock session as User A. 2. Attempt to read Issue I2 by ID. |
| **Expected Outcome** | 1. Returns null/not-found or authorization error. 2. Issue I2 data is never exposed to User A. |
| **Cleanup** | Delete Users A and B (cascades). |

---

### INTEG-053: User A cannot modify Workspace B's data

| Field | Value |
|-------|-------|
| **Test Name** | should reject mutations targeting a workspace the user does not belong to |
| **REQ References** | REQ-005, REQ-037 |
| **Setup** | 1. Create User A (OWNER of W1). 2. Create User B (OWNER of W2) with Project P2 and Issue I2. |
| **Action Sequence** | 1. Mock session as User A. 2. Call `updateIssue({ id: I2.id, title: "Hacked", updatedAt: I2.updatedAt })`. 3. Call `createProject({ name: "Rogue", prefix: "RG", workspaceId: W2.id })`. |
| **Expected Outcome** | 1. Both calls return `{ success: false, error: "Not authorized" }`. 2. I2 title is unchanged. 3. No new project in W2. |
| **Cleanup** | Delete Users A and B (cascades). |

---

### INTEG-054: Labels from Workspace A not visible in Workspace B

| Field | Value |
|-------|-------|
| **Test Name** | should scope labels to their workspace |
| **REQ References** | REQ-032 |
| **Setup** | 1. Create User A (OWNER of W1) with Label "Urgent" in W1. 2. Create User B (OWNER of W2). |
| **Action Sequence** | 1. Mock session as User B. 2. Query labels for workspace W2. |
| **Expected Outcome** | 1. W2 labels are empty (no "Urgent" label). 2. Label created in W1 does not appear in W2 queries. |
| **Cleanup** | Delete Users A and B (cascades). |

---

### INTEG-055: Search is scoped to workspace

| Field | Value |
|-------|-------|
| **Test Name** | should only search issues within the specified workspace |
| **REQ References** | REQ-050 |
| **Setup** | 1. Create User A (member of both W1 and W2). 2. Create Issue in W1: "Authentication bug". 3. Create Issue in W2: "Authentication feature". |
| **Action Sequence** | 1. Mock session as User A. 2. Search with query "Authentication" scoped to W1. |
| **Expected Outcome** | 1. Results contain only the W1 issue ("Authentication bug"). 2. W2 issue is not returned. |
| **Cleanup** | Delete User A (cascades). |

---

### INTEG-056: Member removal revokes access immediately

| Field | Value |
|-------|-------|
| **Test Name** | should prevent removed member from accessing workspace data |
| **REQ References** | REQ-013 |
| **Setup** | 1. Create User A (OWNER) and User B (MEMBER) in Workspace W1 with Project P1. |
| **Action Sequence** | 1. Mock session as User A. Call `removeMember({ workspaceId: W1.id, userId: UserB.id })`. 2. Mock session as User B. Query projects in W1. |
| **Expected Outcome** | 1. `removeMember` returns `{ success: true }`. 2. User B's query returns empty or authorization error. 3. No WorkspaceMember record for User B in W1. |
| **Cleanup** | Delete Users A and B (cascades). |

---

### INTEG-057: Member removal unassigns from all issues

| Field | Value |
|-------|-------|
| **Test Name** | should set assigneeId to null on all issues assigned to the removed member |
| **REQ References** | REQ-013 |
| **Setup** | 1. Create User A (OWNER) and User B (MEMBER) in Workspace W1. 2. Create Project P1, Issues I1 (assigned to B), I2 (assigned to B), I3 (assigned to A). |
| **Action Sequence** | 1. Mock session as User A. 2. Call `removeMember({ workspaceId: W1.id, userId: UserB.id })`. 3. Query Issues I1, I2, I3. |
| **Expected Outcome** | 1. I1.assigneeId = null. 2. I2.assigneeId = null. 3. I3.assigneeId = UserA.id (unchanged). |
| **Cleanup** | Delete Users A and B (cascades). |

---

## 12. API Contract Validation: Valid Inputs

### INTEG-058: signUp with valid input

| Field | Value |
|-------|-------|
| **Test Name** | should create user and workspace with valid sign-up input |
| **REQ References** | REQ-001 |
| **Setup** | Empty database. |
| **Action Sequence** | Call `signUp({ name: "Test User", email: "valid@test.com", password: "Str0ngP@ss" })`. |
| **Expected Outcome** | `{ success: true, data: { userId } }`. User exists. Password is hashed (not "Str0ngP@ss"). |
| **Cleanup** | Delete created user. |

---

### INTEG-059: createWorkspace with valid input

| Field | Value |
|-------|-------|
| **Test Name** | should create workspace with valid input |
| **REQ References** | REQ-009 |
| **Setup** | Create User A (authenticated). |
| **Action Sequence** | Call `createWorkspace({ name: "Acme Corp", slug: "acme-corp", description: "Our team workspace" })`. |
| **Expected Outcome** | `{ success: true, data: { workspace } }`. Workspace record exists with matching slug. WorkspaceMember (OWNER) exists. |
| **Cleanup** | Delete User A (cascades). |

---

### INTEG-060: createProject with valid input

| Field | Value |
|-------|-------|
| **Test Name** | should create project with all optional fields |
| **REQ References** | REQ-017 |
| **Setup** | Create User A (OWNER) in Workspace W1. |
| **Action Sequence** | Call `createProject({ name: "Mobile App", prefix: "MA", description: "iOS and Android", icon: "rocket", color: "#3B82F6", workspaceId: W1.id, leadId: UserA.id })`. |
| **Expected Outcome** | Project record: name, prefix, description, icon, color, leadId all match. 6 default statuses seeded. |
| **Cleanup** | Delete User A (cascades). |

---

### INTEG-061: createIssue with valid input (minimal)

| Field | Value |
|-------|-------|
| **Test Name** | should create issue with only required fields |
| **REQ References** | REQ-025 |
| **Setup** | Create User A (OWNER), Workspace W1, Project P1 (prefix "MIN"). |
| **Action Sequence** | Call `createIssue({ title: "Minimal issue", type: "TASK", priority: "MEDIUM", projectId: P1.id, statusId: backlogStatusId })`. |
| **Expected Outcome** | Issue created: title, type, priority, status correct. assigneeId null. labelIds empty. dueDate null. Key "MIN-1". |
| **Cleanup** | Delete User A (cascades). |

---

### INTEG-062: moveIssue with valid input

| Field | Value |
|-------|-------|
| **Test Name** | should move issue to new status and position |
| **REQ References** | REQ-041 |
| **Setup** | Create User A (OWNER), Workspace W1, Project P1. Create Issue I1 in Backlog. |
| **Action Sequence** | Call `moveIssue({ id: I1.id, statusId: doneStatusId, position: "a0" })`. |
| **Expected Outcome** | `{ success: true }`. I1 statusId updated. I1 position is "a0". Activity logged. |
| **Cleanup** | Delete User A (cascades). |

---

### INTEG-063: inviteMember with valid input

| Field | Value |
|-------|-------|
| **Test Name** | should create invitation with correct token and expiry |
| **REQ References** | REQ-007 |
| **Setup** | Create User A (OWNER) in Workspace W1. |
| **Action Sequence** | Call `inviteMember({ workspaceId: W1.id, email: "newbie@test.com", role: "MEMBER" })`. Query the WorkspaceInvitation record. |
| **Expected Outcome** | Invitation: email matches, role MEMBER, status PENDING. Token is non-empty unique string. expiresAt is ~7 days from now. |
| **Cleanup** | Delete User A (cascades). |

---

### INTEG-064: changeMemberRole with valid input

| Field | Value |
|-------|-------|
| **Test Name** | should update member role from MEMBER to ADMIN |
| **REQ References** | REQ-012 |
| **Setup** | Create User A (OWNER) and User B (MEMBER) in Workspace W1. |
| **Action Sequence** | Mock session as User A. Call `changeMemberRole({ workspaceId: W1.id, userId: UserB.id, role: "ADMIN" })`. |
| **Expected Outcome** | WorkspaceMember for User B now has `role: ADMIN`. |
| **Cleanup** | Delete Users A and B (cascades). |

---

### INTEG-065: createComment with valid input

| Field | Value |
|-------|-------|
| **Test Name** | should create comment with tiptap content and extract plain text |
| **REQ References** | REQ-035 |
| **Setup** | Create User A (OWNER), Workspace W1, Project P1, Issue I1. |
| **Action Sequence** | Call `createComment({ issueId: I1.id, body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hello world" }] }] } })`. |
| **Expected Outcome** | Comment: body is JSON, bodyText is "Hello world". authorId matches User A. |
| **Cleanup** | Delete User A (cascades). |

---

### INTEG-066: createLabel with valid input

| Field | Value |
|-------|-------|
| **Test Name** | should create label with name and color in workspace |
| **REQ References** | REQ-032 |
| **Setup** | Create User A (OWNER) in Workspace W1. |
| **Action Sequence** | Call `createLabel({ workspaceId: W1.id, name: "Feature", color: "#10B981" })`. |
| **Expected Outcome** | Label record: name "Feature", color "#10B981", workspaceId W1.id. |
| **Cleanup** | Delete User A (cascades). |

---

### INTEG-067: bulkUpdateIssues with valid input

| Field | Value |
|-------|-------|
| **Test Name** | should update multiple issues' status in a single operation |
| **REQ References** | REQ-037 |
| **Setup** | Create User A (OWNER), Workspace W1, Project P1. Create Issues I1, I2, I3 in "Backlog". |
| **Action Sequence** | Call `bulkUpdateIssues({ issueIds: [I1.id, I2.id, I3.id], statusId: todoStatusId })`. |
| **Expected Outcome** | `{ success: true, data: { updatedCount: 3 } }`. All 3 issues now have "Todo" status. Activity records created for each. |
| **Cleanup** | Delete User A (cascades). |

---

## 13. API Contract Validation: Invalid Inputs

### INTEG-068: signUp with duplicate email

| Field | Value |
|-------|-------|
| **Test Name** | should reject sign-up when email is already registered |
| **REQ References** | REQ-001 |
| **Setup** | Create existing User with email "taken@test.com". |
| **Action Sequence** | Call `signUp({ name: "New", email: "taken@test.com", password: "Passw0rd!" })`. |
| **Expected Outcome** | `{ success: false, error: "Email already in use" }`. No duplicate user created. |
| **Cleanup** | Delete existing user. |

---

### INTEG-069: createWorkspace with taken slug

| Field | Value |
|-------|-------|
| **Test Name** | should reject workspace creation when slug is already taken |
| **REQ References** | REQ-009, REQ-015 |
| **Setup** | Create User A with Workspace slug "acme". Create User B. |
| **Action Sequence** | Mock session as User B. Call `createWorkspace({ name: "Acme Too", slug: "acme" })`. |
| **Expected Outcome** | `{ success: false, error: "Slug already taken" }`. |
| **Cleanup** | Delete Users A and B. |

---

### INTEG-070: createProject with invalid prefix format

| Field | Value |
|-------|-------|
| **Test Name** | should reject project creation with lowercase or numeric prefix |
| **REQ References** | REQ-019 |
| **Setup** | Create User A (OWNER) in Workspace W1. |
| **Action Sequence** | 1. Call `createProject({ name: "Bad", prefix: "abc", workspaceId: W1.id })` (lowercase). 2. Call `createProject({ name: "Bad", prefix: "A1", workspaceId: W1.id })` (contains number). 3. Call `createProject({ name: "Bad", prefix: "A", workspaceId: W1.id })` (too short). |
| **Expected Outcome** | All three return `{ success: false, error }` with validation messages. No projects created. |
| **Cleanup** | Delete User A (cascades). |

---

### INTEG-071: createIssue with empty title

| Field | Value |
|-------|-------|
| **Test Name** | should reject issue creation with empty title |
| **REQ References** | REQ-025 |
| **Setup** | Create User A (OWNER), Workspace W1, Project P1. |
| **Action Sequence** | Call `createIssue({ title: "", type: "TASK", priority: "MEDIUM", projectId: P1.id, statusId: backlogStatusId })`. |
| **Expected Outcome** | `{ success: false, error }` containing "Title is required". No issue created. Counter unchanged. |
| **Cleanup** | Delete User A (cascades). |

---

### INTEG-072: createIssue with title exceeding max length

| Field | Value |
|-------|-------|
| **Test Name** | should reject issue with title longer than 255 characters |
| **REQ References** | REQ-025 |
| **Setup** | Create User A (OWNER), Workspace W1, Project P1. |
| **Action Sequence** | Call `createIssue({ title: "A".repeat(256), type: "TASK", priority: "MEDIUM", projectId: P1.id, statusId: backlogStatusId })`. |
| **Expected Outcome** | `{ success: false, error }` containing "Title too long". No issue created. |
| **Cleanup** | Delete User A (cascades). |

---

### INTEG-073: createIssue with invalid status (wrong project)

| Field | Value |
|-------|-------|
| **Test Name** | should reject issue creation with a statusId from a different project |
| **REQ References** | REQ-025, REQ-031 |
| **Setup** | Create User A (OWNER), Workspace W1, Projects P1 and P2. Get "Todo" status from P2. |
| **Action Sequence** | Call `createIssue({ ..., projectId: P1.id, statusId: P2_todoStatusId })`. |
| **Expected Outcome** | `{ success: false, error: "Invalid status" }`. No issue created. |
| **Cleanup** | Delete User A (cascades). |

---

### INTEG-074: createIssue with invalid assignee (not a workspace member)

| Field | Value |
|-------|-------|
| **Test Name** | should reject issue creation with an assignee who is not a workspace member |
| **REQ References** | REQ-025 |
| **Setup** | Create User A (OWNER of W1). Create User C (not a member of W1). |
| **Action Sequence** | Mock session as User A. Call `createIssue({ ..., assigneeId: UserC.id })`. |
| **Expected Outcome** | `{ success: false, error }` related to invalid assignee. No issue created. |
| **Cleanup** | Delete Users A and C. |

---

### INTEG-075: inviteMember with already-member email

| Field | Value |
|-------|-------|
| **Test Name** | should reject inviting someone who is already a workspace member |
| **REQ References** | REQ-007 |
| **Setup** | Create User A (OWNER) and User B (MEMBER) in Workspace W1. User B's email is "b@test.com". |
| **Action Sequence** | Mock session as User A. Call `inviteMember({ workspaceId: W1.id, email: "b@test.com", role: "MEMBER" })`. |
| **Expected Outcome** | `{ success: false, error: "User is already a member" }`. No invitation created. |
| **Cleanup** | Delete Users A and B (cascades). |

---

### INTEG-076: acceptInvite with expired token

| Field | Value |
|-------|-------|
| **Test Name** | should reject accepting an expired invitation |
| **REQ References** | REQ-008 |
| **Setup** | 1. Create User A (OWNER of W1). 2. Create invitation with `expiresAt` set to past date. 3. Create User B. |
| **Action Sequence** | Mock session as User B. Call `acceptInvite(expiredToken)`. |
| **Expected Outcome** | `{ success: false, error: "Invalid or expired invitation" }`. No WorkspaceMember created. |
| **Cleanup** | Delete Users A and B. |

---

### INTEG-077: changeMemberRole - cannot change own role

| Field | Value |
|-------|-------|
| **Test Name** | should reject self role change |
| **REQ References** | REQ-012 |
| **Setup** | Create User A (OWNER of W1). |
| **Action Sequence** | Mock session as User A. Call `changeMemberRole({ workspaceId: W1.id, userId: UserA.id, role: "ADMIN" })`. |
| **Expected Outcome** | `{ success: false, error: "Cannot change own role" }`. User A still OWNER. |
| **Cleanup** | Delete User A. |

---

### INTEG-078: changeMemberRole - cannot change OWNER role

| Field | Value |
|-------|-------|
| **Test Name** | should reject changing the workspace owner's role |
| **REQ References** | REQ-012 |
| **Setup** | Create User A (OWNER) and User B (ADMIN) in Workspace W1. |
| **Action Sequence** | Mock session as User B. Call `changeMemberRole({ workspaceId: W1.id, userId: UserA.id, role: "MEMBER" })`. |
| **Expected Outcome** | `{ success: false, error: "Cannot change owner role" }`. User A still OWNER. |
| **Cleanup** | Delete Users A and B (cascades). |

---

### INTEG-079: removeMember - cannot remove sole owner

| Field | Value |
|-------|-------|
| **Test Name** | should reject removing the sole workspace owner |
| **REQ References** | REQ-013 |
| **Setup** | Create User A (OWNER, sole owner) in Workspace W1. |
| **Action Sequence** | Mock session as User A. Call `removeMember({ workspaceId: W1.id, userId: UserA.id })`. |
| **Expected Outcome** | `{ success: false, error: "Cannot remove workspace owner" }`. User A still a member. |
| **Cleanup** | Delete User A. |

---

### INTEG-080: createLabel with duplicate name in workspace

| Field | Value |
|-------|-------|
| **Test Name** | should reject duplicate label name within the same workspace |
| **REQ References** | REQ-032 |
| **Setup** | Create User A (OWNER) in Workspace W1. Create Label "Bug" in W1. |
| **Action Sequence** | Call `createLabel({ workspaceId: W1.id, name: "Bug", color: "#FF0000" })`. |
| **Expected Outcome** | `{ success: false, error: "Label name already exists" }`. Only one "Bug" label in W1. |
| **Cleanup** | Delete User A (cascades). |

---

### INTEG-081: updateComment with non-author user (non-admin)

| Field | Value |
|-------|-------|
| **Test Name** | should reject comment update by non-author MEMBER |
| **REQ References** | REQ-035 |
| **Setup** | Create Users A (OWNER) and B (MEMBER) in W1. Create comment by User A on Issue I1. |
| **Action Sequence** | Mock session as User B. Call `updateComment({ id: commentId, body: newContent })`. |
| **Expected Outcome** | `{ success: false, error: "Not the author" }`. Comment body unchanged. |
| **Cleanup** | Delete Users A and B (cascades). |

---

## 14. Zod Boundary Validation

### INTEG-082: Workspace slug validation boundaries

| Field | Value |
|-------|-------|
| **Test Name** | should validate slug format at Zod schema boundaries |
| **REQ References** | REQ-015 |
| **Setup** | Create User A (authenticated). |
| **Action Sequence** | 1. Call `createWorkspace({ name: "X", slug: "a" })` (slug too short: min 2). 2. Call `createWorkspace({ name: "X", slug: "ab" })` (slug at minimum: 2 chars). 3. Call `createWorkspace({ name: "X", slug: "UPPER" })` (invalid: uppercase). 4. Call `createWorkspace({ name: "X", slug: "has spaces" })` (invalid: spaces). 5. Call `createWorkspace({ name: "X", slug: "valid-slug-123" })` (valid). |
| **Expected Outcome** | 1. Rejected (too short). 2. Accepted. 3. Rejected (format). 4. Rejected (format). 5. Accepted. |
| **Cleanup** | Delete User A and any created workspaces. |

---

### INTEG-083: Project prefix validation boundaries

| Field | Value |
|-------|-------|
| **Test Name** | should validate project prefix format at boundaries |
| **REQ References** | REQ-019 |
| **Setup** | Create User A (OWNER) in Workspace W1. |
| **Action Sequence** | 1. `createProject({ ..., prefix: "A" })` (too short: min 2). 2. `createProject({ ..., prefix: "AB" })` (at minimum). 3. `createProject({ ..., prefix: "ABCDEFGHIJK" })` (too long: max 10). 4. `createProject({ ..., prefix: "ABCDEFGHIJ" })` (at maximum: 10). 5. `createProject({ ..., prefix: "A1B" })` (invalid: contains number). |
| **Expected Outcome** | 1. Rejected. 2. Accepted. 3. Rejected. 4. Accepted. 5. Rejected. |
| **Cleanup** | Delete User A (cascades). |

---

### INTEG-084: Issue title validation boundaries

| Field | Value |
|-------|-------|
| **Test Name** | should validate issue title at length boundaries |
| **REQ References** | REQ-025 |
| **Setup** | Create User A (OWNER), Workspace W1, Project P1. |
| **Action Sequence** | 1. `createIssue({ title: "", ... })` (empty: min 1). 2. `createIssue({ title: "A", ... })` (at minimum: 1 char). 3. `createIssue({ title: "A".repeat(255), ... })` (at maximum: 255 chars). 4. `createIssue({ title: "A".repeat(256), ... })` (over maximum). |
| **Expected Outcome** | 1. Rejected. 2. Accepted. 3. Accepted. 4. Rejected. |
| **Cleanup** | Delete User A (cascades). |

---

### INTEG-085: Label name validation boundaries

| Field | Value |
|-------|-------|
| **Test Name** | should validate label name at length boundaries |
| **REQ References** | REQ-032 |
| **Setup** | Create User A (OWNER) in Workspace W1. |
| **Action Sequence** | 1. `createLabel({ ..., name: "" })` (empty). 2. `createLabel({ ..., name: "A" })` (min 1). 3. `createLabel({ ..., name: "A".repeat(50) })` (at max). 4. `createLabel({ ..., name: "A".repeat(51) })` (over max). |
| **Expected Outcome** | 1. Rejected. 2. Accepted. 3. Accepted. 4. Rejected. |
| **Cleanup** | Delete User A (cascades). |

---

### INTEG-086: Color hex validation

| Field | Value |
|-------|-------|
| **Test Name** | should validate hex color format on labels and projects |
| **REQ References** | REQ-023, REQ-032 |
| **Setup** | Create User A (OWNER) in Workspace W1. |
| **Action Sequence** | 1. `createLabel({ ..., color: "#GGGGGG" })` (invalid hex chars). 2. `createLabel({ ..., color: "3B82F6" })` (missing #). 3. `createLabel({ ..., color: "#3B82F6" })` (valid). 4. `createLabel({ ..., color: "#abc" })` (3-char shorthand, invalid per regex). |
| **Expected Outcome** | 1. Rejected. 2. Rejected. 3. Accepted. 4. Rejected (schema requires 6-char hex). |
| **Cleanup** | Delete User A (cascades). |

---

### INTEG-087: InviteMember role validation

| Field | Value |
|-------|-------|
| **Test Name** | should only allow ADMIN, MEMBER, or VIEWER role in invitations |
| **REQ References** | REQ-007 |
| **Setup** | Create User A (OWNER) in Workspace W1. |
| **Action Sequence** | 1. `inviteMember({ ..., role: "OWNER" })` (cannot invite as OWNER). 2. `inviteMember({ ..., role: "MEMBER" })` (valid). 3. `inviteMember({ ..., role: "SUPERADMIN" as any })` (invalid enum value). |
| **Expected Outcome** | 1. Rejected (Zod enum does not include OWNER). 2. Accepted. 3. Rejected (invalid enum). |
| **Cleanup** | Delete User A (cascades). |

---

### INTEG-088: Issue type and priority enum validation

| Field | Value |
|-------|-------|
| **Test Name** | should reject invalid issue type and priority values |
| **REQ References** | REQ-029, REQ-030 |
| **Setup** | Create User A (OWNER), Workspace W1, Project P1. |
| **Action Sequence** | 1. `createIssue({ ..., type: "FEATURE" as any })` (invalid type). 2. `createIssue({ ..., priority: "CRITICAL" as any })` (invalid priority). 3. `createIssue({ ..., type: "BUG", priority: "URGENT" })` (valid). |
| **Expected Outcome** | 1. Rejected. 2. Rejected. 3. Accepted. |
| **Cleanup** | Delete User A (cascades). |

---

### INTEG-089: CUID validation on foreign keys

| Field | Value |
|-------|-------|
| **Test Name** | should reject non-CUID strings for ID fields |
| **REQ References** | REQ-025, REQ-037 |
| **Setup** | Create User A (OWNER), Workspace W1, Project P1. |
| **Action Sequence** | 1. `createIssue({ ..., projectId: "not-a-cuid" })`. 2. `createIssue({ ..., statusId: "12345" })`. 3. `updateIssue({ id: "garbage", title: "X", updatedAt: new Date() })`. |
| **Expected Outcome** | All three rejected with validation errors (Zod `.cuid()` fails). |
| **Cleanup** | Delete User A (cascades). |

---

### INTEG-090: Search query validation

| Field | Value |
|-------|-------|
| **Test Name** | should validate search query length boundaries |
| **REQ References** | REQ-050 |
| **Setup** | Create User A (OWNER) in Workspace W1. |
| **Action Sequence** | 1. Search with query "" (empty: min 1). 2. Search with query "A" (at minimum). 3. Search with query "A".repeat(200) (at max). 4. Search with query "A".repeat(201) (over max). |
| **Expected Outcome** | 1. Rejected. 2. Accepted. 3. Accepted. 4. Rejected. |
| **Cleanup** | Delete User A (cascades). |

---

## Summary

| Section | Test Count | Coverage |
|---------|-----------|----------|
| Auth -> Workspace | 7 (INTEG-001 to INTEG-007) | Sign-up, OAuth, access, invite, redirect |
| Workspace -> Project | 5 (INTEG-008 to INTEG-012) | Creation, key uniqueness, member access, favorites |
| Project -> Issue | 7 (INTEG-013 to INTEG-019) | Key generation, atomicity, status, deletion, activity, auth |
| Issue -> Board | 6 (INTEG-020 to INTEG-025) | Move, reorder, counts, auth, quick-add |
| Issue -> Comments | 6 (INTEG-026 to INTEG-031) | Create, viewer access, edit, delete, ordering |
| Issue -> Labels | 5 (INTEG-032 to INTEG-036) | Assign, update, workspace scope, cascade, uniqueness |
| Search -> Issues | 5 (INTEG-037 to INTEG-041) | Key match, title match, workspace scope, soft-delete, min chars |
| Data Flow (Server Action -> DB) | 5 (INTEG-042 to INTEG-046) | Full create, optimistic locking, activity, soft delete, MEMBER delete auth |
| Auth Middleware | 4 (INTEG-047 to INTEG-050) | Protected routes, public routes, server action auth, callback URL |
| Workspace Isolation | 7 (INTEG-051 to INTEG-057) | Projects, issues, mutations, labels, search, member removal |
| Valid Input Contracts | 10 (INTEG-058 to INTEG-067) | All server actions with correct input |
| Invalid Input Contracts | 14 (INTEG-068 to INTEG-081) | Duplicate email, taken slug, invalid formats, auth violations |
| Zod Boundary Validation | 9 (INTEG-082 to INTEG-090) | Slug, prefix, title, label, color, role, type, CUID, search |

**Total: 90 integration test specifications**

All tests reference specific REQ IDs from the specification (REQ-001 through REQ-060) and validate against the Prisma schema, Zod validation schemas, and server action contracts defined in `contracts.md`.
