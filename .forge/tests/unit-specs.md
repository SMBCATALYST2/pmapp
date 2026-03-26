# Unit Test Specifications: PMApp

**Author:** UnitTestWriter (Forge Pipeline)
**Date:** 2026-03-26
**Stack:** Vitest + @testing-library/react + TypeScript
**Phase:** MVP (Pre-scaffolding test-first specs)

---

## Table of Contents

1. [Test Infrastructure & Config](#1-test-infrastructure--config)
2. [Auth Module Tests](#2-auth-module-tests)
3. [Workspace Module Tests](#3-workspace-module-tests)
4. [Project Module Tests](#4-project-module-tests)
5. [Issue Module Tests](#5-issue-module-tests)
6. [Board View Module Tests](#6-board-view-module-tests)
7. [List View Module Tests](#7-list-view-module-tests)
8. [Search Module Tests](#8-search-module-tests)
9. [Labels Module Tests](#9-labels-module-tests)
10. [Cross-Cutting Tests](#10-cross-cutting-tests)
11. [Validation Schema Tests](#11-validation-schema-tests)

---

## 1. Test Infrastructure & Config

### 1.1 Vitest Configuration (`vitest.config.ts`)

```
Recommendations:
- Use vitest workspace config to separate unit / integration
- Environment: jsdom for component tests, node for server action / validation tests
- Globals: true (no explicit import of describe/it/expect)
- Coverage: v8 provider, thresholds at 80% lines/branches
- Setup files: src/test/setup.ts (global mocks), src/test/setup-dom.ts (testing-library cleanup)
- Path aliases: resolve @/ to src/ (match tsconfig)
- Exclude: node_modules, .next, prisma/migrations
- Test file pattern: **/*.test.ts, **/*.test.tsx
```

### 1.2 Mock Patterns

#### Prisma Mock (`src/test/mocks/prisma.ts`)

```
Pattern: Use vitest vi.mock to mock @/lib/prisma
- Export a mockPrisma object using vitest-mock-extended's mockDeep<PrismaClient>()
- Mock $transaction to execute the callback with the mock client
- Reset all mocks in beforeEach
- Each test specifies return values per-call using mockResolvedValueOnce
```

#### Auth Session Mock (`src/test/mocks/auth.ts`)

```
Pattern: Mock next-auth/react and @/lib/auth
- mockSession(overrides?: Partial<Session>): sets up auth() mock to return a session
- mockUnauthenticated(): sets up auth() to return null
- mockSessionUser: default user fixture { id: 'user-1', name: 'Test User', email: 'test@example.com', image: null }
- Mock useSession() for client component tests
- Mock getServerSession() for server action tests
```

#### Server Action Test Helper (`src/test/helpers/action.ts`)

```
Pattern: Call server actions directly in tests (they are async functions)
- Import the action
- Set up Prisma mock return values
- Set up auth mock
- Call the action with input
- Assert on the return value and mock calls
```

#### Component Render Helper (`src/test/helpers/render.tsx`)

```
Pattern: Custom render function wrapping testing-library render
- Wraps component in required providers: SessionProvider, ThemeProvider, QueryClientProvider, Toaster
- Accepts optional overrides for session, theme, queryClient
- Exports: renderWithProviders(ui, options?)
- Re-exports all testing-library utilities
```

#### Fixture Factories (`src/test/fixtures/`)

```
Files:
- user.ts: createUser(overrides?) -> User fixture
- workspace.ts: createWorkspace(overrides?) -> Workspace fixture
- member.ts: createMember(overrides?) -> WorkspaceMember fixture
- project.ts: createProject(overrides?) -> Project fixture
- issue.ts: createIssue(overrides?) -> Issue fixture
- status.ts: createStatus(overrides?) -> WorkflowStatus fixture, createDefaultStatuses() -> array
- label.ts: createLabel(overrides?) -> Label fixture
- comment.ts: createComment(overrides?) -> Comment fixture
- activity.ts: createActivity(overrides?) -> Activity fixture
- invitation.ts: createInvitation(overrides?) -> WorkspaceInvitation fixture

Each factory returns a complete, valid object matching the Prisma model shape with sensible defaults.
All IDs use deterministic test values (e.g., 'user-1', 'workspace-1') rather than cuid().
```

#### Router Mock (`src/test/mocks/router.ts`)

```
Pattern: Mock next/navigation
- mockRouter: { push, replace, refresh, back, forward, prefetch } all vi.fn()
- mockParams(params): mock useParams to return given params
- mockSearchParams(params): mock useSearchParams
- mockPathname(path): mock usePathname
```

---

## 2. Auth Module Tests

### 2.1 Sign-Up Validation (REQ-001)

**File:** `src/lib/validations/__tests__/auth.test.ts`

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | accepts valid sign-up input | None | Parse `{ name: 'Alice', email: 'alice@example.com', password: 'Passw0rd!' }` with signUpSchema | Success, returns parsed object | REQ-001 |
| 2 | rejects empty name | None | Parse `{ name: '', email: 'a@b.com', password: 'Passw0rd!' }` | ZodError with name path | REQ-001 |
| 3 | rejects name shorter than 2 chars | None | Parse `{ name: 'A', email: 'a@b.com', password: 'Passw0rd!' }` | ZodError: "Name must be at least 2 characters" | REQ-001 |
| 4 | rejects name longer than 50 chars | None | Parse with name of 51 chars | ZodError: "Name too long" | REQ-001 |
| 5 | rejects invalid email format | None | Parse with email: 'not-an-email' | ZodError: "Invalid email address" | REQ-001 |
| 6 | rejects empty email | None | Parse with email: '' | ZodError on email path | REQ-001 |
| 7 | rejects password shorter than 8 chars | None | Parse with password: 'short' | ZodError: "Password must be at least 8 characters" | REQ-001 |
| 8 | rejects password longer than 100 chars | None | Parse with password of 101 chars | ZodError: "Password too long" | REQ-001 |
| 9 | accepts minimum valid password (8 chars) | None | Parse with password: 'Abcdefg1' | Success | REQ-001 |
| 10 | rejects missing fields entirely | None | Parse `{}` | ZodError with multiple paths | REQ-001 |

### 2.2 Sign-Up Server Action (REQ-001)

**File:** `src/server/actions/__tests__/auth.test.ts`

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | creates user with hashed password and default workspace | Mock prisma.user.create, prisma.workspace.create, prisma.workspaceMember.create | Call signUp({ name, email, password }) | Returns { success: true, data: { userId } }; bcrypt.hash called; workspace created with OWNER role | REQ-001 |
| 2 | returns error when email already exists | Mock prisma.user.findUnique to return existing user | Call signUp with duplicate email | Returns { success: false, error: "Email already in use" } | REQ-001 |
| 3 | returns error for invalid input (Zod validation) | None | Call signUp with empty name | Returns { success: false, error: "Validation error" } | REQ-001 |
| 4 | lowercases email before storage | Mock prisma.user.create | Call signUp with email 'Alice@EXAMPLE.COM' | prisma.user.create called with email 'alice@example.com' | REQ-001 |
| 5 | trims name whitespace | Mock prisma.user.create | Call signUp with name '  Alice  ' | prisma.user.create called with name 'Alice' | REQ-001 |

### 2.3 Sign-In Validation (REQ-003)

**File:** `src/lib/validations/__tests__/auth.test.ts` (continued)

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | accepts valid sign-in input | None | Parse `{ email: 'a@b.com', password: 'mypassword' }` with signInSchema | Success | REQ-003 |
| 2 | rejects invalid email format | None | Parse with email: 'bad' | ZodError | REQ-003 |
| 3 | rejects empty password | None | Parse with password: '' | ZodError: "Password is required" | REQ-003 |
| 4 | accepts single-character password (min=1 for sign-in, server validates) | None | Parse with password: 'x' | Success (sign-in schema only checks non-empty) | REQ-003 |

### 2.4 Sign-In Server Action (REQ-003)

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | signs in with correct credentials | Mock user lookup + bcrypt.compare true | Call signIn({ email, password }) | Returns { success: true } | REQ-003 |
| 2 | returns error for wrong password | Mock user lookup + bcrypt.compare false | Call signIn({ email, password }) | Returns { success: false, error: "Invalid credentials" } | REQ-003 |
| 3 | returns error for non-existent email | Mock user lookup returns null | Call signIn({ email, password }) | Returns { success: false, error: "Invalid credentials" } (same message, no enumeration) | REQ-003 |
| 4 | returns error for OAuth-only account (no password) | Mock user with password: null | Call signIn({ email, password }) | Returns { success: false, error: "This account uses [Provider] sign-in" } | REQ-003 |

### 2.5 Sign Out (REQ-004)

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | calls NextAuth signOut | Mock next-auth signOut | Call signOut() | signOut function called | REQ-004 |

### 2.6 Session & Route Protection (REQ-005)

**File:** `src/middleware/__tests__/auth-middleware.test.ts`

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | allows access to public routes without auth | Mock request to /sign-in | Run middleware | NextResponse.next() (no redirect) | REQ-005 |
| 2 | allows access to /sign-up without auth | Mock request to /sign-up | Run middleware | No redirect | REQ-005 |
| 3 | allows access to /invite/[token] without auth | Mock request to /invite/abc123 | Run middleware | No redirect | REQ-005 |
| 4 | allows access to /api/auth/* without auth | Mock request to /api/auth/signin | Run middleware | No redirect | REQ-005 |
| 5 | redirects unauthenticated user to /sign-in with callbackUrl | Mock request to /acme/projects without session | Run middleware | Redirect to /sign-in?callbackUrl=%2Facme%2Fprojects | REQ-005 |
| 6 | allows authenticated user to access protected routes | Mock request with valid session | Run middleware | NextResponse.next() | REQ-005 |
| 7 | preserves callbackUrl through sign-in flow | Mock request to /acme/projects/PROJ/board | Run middleware with no session | Redirect URL includes full callbackUrl | REQ-005 |

### 2.7 Forgot Password Validation (REQ-006)

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | accepts valid email for forgot password | None | Parse `{ email: 'a@b.com' }` with forgotPasswordSchema | Success | REQ-006 |
| 2 | rejects invalid email format | None | Parse with email: 'bad' | ZodError | REQ-006 |

### 2.8 Invite Member (REQ-007)

**File:** `src/server/actions/__tests__/workspace.test.ts`

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | creates invitation with unique token and 7-day expiry | Mock auth as OWNER; mock prisma | Call inviteMember({ workspaceId, email, role: 'MEMBER' }) | Invitation created; expiresAt ~7 days from now; token is unique string | REQ-007 |
| 2 | rejects invite when email is already a member | Mock existing member lookup | Call inviteMember with existing member email | Returns error "User is already a member" | REQ-007 |
| 3 | rejects invite when active pending invitation exists | Mock existing pending invitation | Call inviteMember with pending email | Returns error "Invitation already pending" | REQ-007 |
| 4 | rejects invite from MEMBER role | Mock auth as MEMBER | Call inviteMember | Returns error "Not authorized" (403) | REQ-007 |
| 5 | rejects invite from VIEWER role | Mock auth as VIEWER | Call inviteMember | Returns error "Not authorized" | REQ-007 |
| 6 | allows ADMIN to invite | Mock auth as ADMIN; mock prisma | Call inviteMember | Success | REQ-007 |
| 7 | prevents inviting as OWNER role | Mock auth as OWNER | Call inviteMember with role: 'OWNER' | Zod validation error (role enum excludes OWNER) | REQ-007 |
| 8 | rejects invalid email format | None | Validate inviteMemberSchema with bad email | ZodError | REQ-007 |

### 2.9 Accept Invite (REQ-008)

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | creates workspace member on valid token acceptance | Mock valid invitation; mock auth | Call acceptInvite(token) | WorkspaceMember created with invited role; invitation status = ACCEPTED | REQ-008 |
| 2 | returns error for invalid token | Mock no invitation found | Call acceptInvite('bad-token') | Returns error "Invalid or expired invitation" | REQ-008 |
| 3 | returns error for expired token | Mock invitation with expiresAt in past | Call acceptInvite(token) | Returns error "Invalid or expired invitation" | REQ-008 |
| 4 | returns error for revoked token | Mock invitation with status REVOKED | Call acceptInvite(token) | Returns error "Invalid or expired invitation" | REQ-008 |
| 5 | returns error if user is already a member | Mock existing WorkspaceMember | Call acceptInvite(token) | Returns error "Already a member" | REQ-008 |
| 6 | allows acceptance by any authenticated user (transferable link) | Mock invitation for different email; mock auth as different user | Call acceptInvite(token) | Success -- invitations are transferable by link | REQ-008 |

---

## 3. Workspace Module Tests

### 3.1 Create Workspace Validation (REQ-009, REQ-015)

**File:** `src/lib/validations/__tests__/workspace.test.ts`

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | accepts valid workspace input | None | Parse `{ name: 'Acme Corp', slug: 'acme-corp', description: 'Our workspace' }` | Success | REQ-009 |
| 2 | rejects name shorter than 2 chars | None | Parse with name: 'A' | ZodError | REQ-009 |
| 3 | rejects name longer than 50 chars | None | Parse with 51-char name | ZodError: "Name too long" | REQ-009 |
| 4 | rejects slug shorter than 2 chars | None | Parse with slug: 'a' | ZodError | REQ-015 |
| 5 | rejects slug longer than 30 chars | None | Parse with 31-char slug | ZodError: "Slug too long" | REQ-015 |
| 6 | rejects slug with uppercase letters | None | Parse with slug: 'Acme' | ZodError: lowercase only | REQ-015 |
| 7 | rejects slug with special characters | None | Parse with slug: 'acme_corp' | ZodError | REQ-015 |
| 8 | accepts slug with hyphens | None | Parse with slug: 'acme-corp' | Success | REQ-015 |
| 9 | rejects slug with spaces | None | Parse with slug: 'acme corp' | ZodError | REQ-015 |
| 10 | accepts empty description (optional) | None | Parse without description field | Success | REQ-009 |
| 11 | rejects description longer than 500 chars | None | Parse with 501-char description | ZodError | REQ-009 |

### 3.2 Workspace Slug Validation (REQ-015)

**File:** `src/lib/__tests__/slug-validation.test.ts` (or within workspace validation)

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | rejects reserved slugs (admin, api, auth, settings, etc.) | List of reserved slugs | Check each against reserved slug list | All rejected | REQ-015 |
| 2 | rejects slug starting with a number | None | Validate slug: '123abc' | Error: "Must start with a letter" | REQ-015 |
| 3 | rejects slug ending with a hyphen | None | Validate slug: 'acme-' | Error | REQ-015 |
| 4 | rejects slug with consecutive hyphens | None | Validate slug: 'acme--corp' | Error | REQ-015 |
| 5 | accepts minimum valid slug (3 chars per spec) | None | Validate slug: 'abc' | Success | REQ-015 |
| 6 | accepts maximum valid slug (48 chars per spec) | None | Validate slug of 48 chars | Success | REQ-015 |

> **Note:** The Zod schema in contracts uses min(2) but the spec says 3-48 chars. Tests should verify spec requirement (3 min). This discrepancy should be flagged to builders.

### 3.3 Create Workspace Server Action (REQ-009)

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | creates workspace and assigns OWNER role | Mock auth; mock prisma | Call createWorkspace({ name, slug }) | Workspace created; WorkspaceMember with OWNER role created | REQ-009 |
| 2 | returns error for duplicate slug | Mock prisma unique constraint violation | Call createWorkspace with taken slug | Returns error "Slug already taken" | REQ-009 |
| 3 | rejects unauthenticated request | Mock auth returns null | Call createWorkspace | Returns error (unauthorized) | REQ-009 |
| 4 | slug is immutable after creation (contract) | N/A -- updateWorkspaceSchema should not allow slug change | Verify updateWorkspaceSchema does not include slug field OR slug field is documented as ignored | REQ-015, Revision |

### 3.4 Update Workspace (REQ-010)

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | updates workspace name and description | Mock auth as OWNER; mock prisma | Call updateWorkspace({ id, name: 'New Name' }) | Workspace updated | REQ-010 |
| 2 | rejects update from MEMBER role | Mock auth as MEMBER | Call updateWorkspace | Returns error "Not authorized" | REQ-010 |
| 3 | rejects update from VIEWER role | Mock auth as VIEWER | Call updateWorkspace | Returns error "Not authorized" | REQ-010 |
| 4 | allows ADMIN to update | Mock auth as ADMIN | Call updateWorkspace | Success | REQ-010 |
| 5 | rejects empty name | None | Call updateWorkspace with name: '' | Validation error | REQ-010 |
| 6 | returns error for non-existent workspace | Mock prisma returns null | Call updateWorkspace with bad id | Returns error | REQ-010 |

### 3.5 Member List (REQ-011)

**File:** `src/components/__tests__/member-list.test.tsx`

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | renders all members with name, email, role, avatar | Create 3 member fixtures | Render MemberList with members | All 3 members visible with correct data | REQ-011 |
| 2 | shows role dropdown for OWNER/ADMIN viewing other members | Create fixtures; render as OWNER | Render MemberList | Role dropdowns visible for non-OWNER members | REQ-011 |
| 3 | hides role dropdown for MEMBER role viewer | Create fixtures; render as MEMBER | Render MemberList | No role dropdowns visible | REQ-011 |
| 4 | shows Remove button for OWNER/ADMIN | Render as OWNER | Render MemberList | Remove buttons visible | REQ-011 |
| 5 | hides Remove button for MEMBER/VIEWER | Render as MEMBER | Render MemberList | No Remove buttons | REQ-011 |
| 6 | disables remove for sole OWNER | Single OWNER member | Render MemberList | Remove button disabled for OWNER row | REQ-011 |

### 3.6 Change Member Role (REQ-012)

**File:** `src/server/actions/__tests__/workspace.test.ts`

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | OWNER can change member role to ADMIN | Mock auth as OWNER | Call changeMemberRole({ userId, role: 'ADMIN' }) | Success; role updated | REQ-012 |
| 2 | OWNER can change member role to VIEWER | Mock auth as OWNER | Call changeMemberRole({ userId, role: 'VIEWER' }) | Success | REQ-012 |
| 3 | ADMIN can change MEMBER to VIEWER | Mock auth as ADMIN; target is MEMBER | Call changeMemberRole | Success | REQ-012 |
| 4 | ADMIN cannot promote MEMBER to ADMIN | Mock auth as ADMIN; target is MEMBER | Call changeMemberRole({ role: 'ADMIN' }) | Error: not authorized | REQ-012 |
| 5 | ADMIN cannot change another ADMIN's role | Mock auth as ADMIN; target is ADMIN | Call changeMemberRole | Error: not authorized | REQ-012 |
| 6 | cannot change OWNER's role | Mock auth as OWNER; target is OWNER | Call changeMemberRole | Error: "Cannot change owner role" | REQ-012 |
| 7 | cannot change own role | Mock auth userId = target userId | Call changeMemberRole | Error: "Cannot change own role" | REQ-012 |
| 8 | MEMBER cannot change roles | Mock auth as MEMBER | Call changeMemberRole | Error: not authorized | REQ-012 |
| 9 | VIEWER cannot change roles | Mock auth as VIEWER | Call changeMemberRole | Error: not authorized | REQ-012 |

### 3.7 Remove Member (REQ-013)

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | removes member and unassigns their issues | Mock auth as OWNER; mock member with assigned issues | Call removeMember({ userId }) | WorkspaceMember deleted; issues unassigned (assigneeId = null) | REQ-013 |
| 2 | cannot remove workspace OWNER | Mock auth as ADMIN; target is OWNER | Call removeMember | Error: "Cannot remove workspace owner" | REQ-013 |
| 3 | ADMIN cannot remove another ADMIN | Mock auth as ADMIN; target is ADMIN | Call removeMember | Error: not authorized | REQ-013 |
| 4 | MEMBER cannot remove anyone | Mock auth as MEMBER | Call removeMember | Error: not authorized | REQ-013 |
| 5 | allows removing self (non-Owner) | Mock auth as MEMBER; target is self | Call removeMember | Success (user removes themselves) | REQ-013 |
| 6 | returns error for non-existent member | Mock prisma returns null | Call removeMember | Error: member not found | REQ-013 |

### 3.8 Workspace Switcher (REQ-014)

**File:** `src/components/__tests__/workspace-switcher.test.tsx`

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | renders current workspace name | Create workspace fixture | Render WorkspaceSwitcher | Current workspace name visible | REQ-014 |
| 2 | lists all user workspaces in dropdown | Create 3 workspace fixtures | Click switcher, render dropdown | All 3 workspaces listed | REQ-014 |
| 3 | highlights current workspace in list | Create fixtures | Open dropdown | Current workspace has highlight/check mark | REQ-014 |
| 4 | shows 'Create workspace' option | Create fixtures | Open dropdown | "Create workspace" option visible at bottom | REQ-014 |
| 5 | navigates to selected workspace | Create fixtures; mock router | Click on workspace B | router.push called with /workspace-b/projects | REQ-014 |

### 3.9 Post-Signup Onboarding Redirect (REQ-016)

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | redirects to /create-workspace when user has no workspaces | Mock user with 0 workspaces | Execute redirect logic | Redirect to /create-workspace | REQ-016 |
| 2 | redirects to first workspace when user has workspaces | Mock user with 2 workspaces | Execute redirect logic | Redirect to /{first-workspace-slug}/projects | REQ-016 |
| 3 | root route (/) redirects authenticated user to workspace | Mock authenticated user with workspace | Access / | Redirect to /{workspace-slug}/projects | REQ-016 |
| 4 | root route (/) redirects unauthenticated user to sign-in | Mock no session | Access / | Redirect to /sign-in | REQ-016 |

---

## 4. Project Module Tests

### 4.1 Create Project Validation (REQ-017, REQ-019)

**File:** `src/lib/validations/__tests__/project.test.ts`

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | accepts valid project input | None | Parse `{ name: 'Mobile App', prefix: 'MA', workspaceId: 'cuid', description: 'An app' }` | Success | REQ-017 |
| 2 | rejects empty project name | None | Parse with name: '' | ZodError: "Name is required" | REQ-017 |
| 3 | rejects name longer than 100 chars | None | Parse with 101-char name | ZodError: "Name too long" | REQ-017 |
| 4 | rejects prefix shorter than 2 chars | None | Parse with prefix: 'A' | ZodError: "Key must be 2-10 characters" | REQ-019 |
| 5 | rejects prefix longer than 10 chars | None | Parse with prefix: 'ABCDEFGHIJK' | ZodError: "Key must be 2-10 characters" | REQ-019 |
| 6 | rejects lowercase prefix | None | Parse with prefix: 'ma' | ZodError: "Key must be uppercase letters only" | REQ-019 |
| 7 | rejects prefix with numbers | None | Parse with prefix: 'M1' | ZodError | REQ-019 |
| 8 | rejects prefix with special characters | None | Parse with prefix: 'M-A' | ZodError | REQ-019 |
| 9 | accepts 2-char prefix (minimum) | None | Parse with prefix: 'MA' | Success | REQ-019 |
| 10 | accepts 10-char prefix (maximum) | None | Parse with prefix: 'ABCDEFGHIJ' | Success | REQ-019 |
| 11 | rejects description longer than 1000 chars | None | Parse with 1001-char description | ZodError | REQ-017 |
| 12 | accepts valid hex color | None | Parse with color: '#3B82F6' | Success | REQ-023 |
| 13 | rejects invalid hex color | None | Parse with color: 'red' | ZodError | REQ-023 |
| 14 | rejects hex color without hash | None | Parse with color: '3B82F6' | ZodError | REQ-023 |
| 15 | accepts optional fields as undefined | None | Parse without description, icon, color, leadId | Success | REQ-017 |

### 4.2 Project Key Auto-Generation (REQ-019)

**File:** `src/lib/__tests__/project-key-generator.test.ts`

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | generates key from single word (first 2-4 chars) | None | generateProjectKey('Frontend') | 'FE' or 'FR' or 'FRON' (implementation-dependent, 2-4 uppercase) | REQ-019 |
| 2 | generates key from two words (first letters) | None | generateProjectKey('Mobile App') | 'MA' | REQ-019 |
| 3 | generates key from three words | None | generateProjectKey('Backend API Service') | 'BAS' | REQ-019 |
| 4 | generates key from single short word | None | generateProjectKey('AI') | 'AI' | REQ-019 |
| 5 | handles names with special characters | None | generateProjectKey('E-Commerce Platform') | 'EP' or 'ECP' | REQ-019 |
| 6 | uppercases all letters | None | generateProjectKey('mobile app') | 'MA' (uppercase) | REQ-019 |
| 7 | limits key to max 4 chars from auto-generation | None | generateProjectKey('Very Long Project Name Here') | Max 4 chars | REQ-019 |

### 4.3 Create Project Server Action (REQ-017)

**File:** `src/server/actions/__tests__/project.test.ts`

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | creates project with default statuses seeded | Mock auth as OWNER; mock prisma | Call createProject({ name, prefix, workspaceId }) | Project created with issueCounter=0; 6 default WorkflowStatuses created | REQ-017 |
| 2 | returns error for duplicate prefix in workspace | Mock prisma unique constraint error | Call createProject with existing prefix | Error: "Project key already exists" | REQ-017, REQ-019 |
| 3 | rejects request from MEMBER role | Mock auth as MEMBER | Call createProject | Error: "Not authorized" | REQ-017 |
| 4 | rejects request from VIEWER role | Mock auth as VIEWER | Call createProject | Error: "Not authorized" | REQ-017 |
| 5 | allows ADMIN to create | Mock auth as ADMIN | Call createProject | Success | REQ-017 |
| 6 | includes workspaceId filter in all queries | Mock auth; mock prisma | Call createProject | Verify workspaceId is passed in the create call | Revision: workspace isolation |
| 7 | default statuses match defined seed data | Mock auth; mock prisma | Call createProject | createMany called with 6 statuses matching DEFAULT_STATUSES constant | REQ-031 |

### 4.4 Update Project (REQ-018)

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | updates project name and description | Mock auth as OWNER | Call updateProject({ id, name: 'New Name' }) | Success; updated values | REQ-018 |
| 2 | does not allow changing prefix | None | Verify updateProjectSchema does not have prefix field | No prefix field in schema | REQ-018 |
| 3 | rejects update from VIEWER role | Mock auth as VIEWER | Call updateProject | Error: "Not authorized" | REQ-018 |
| 4 | rejects update from MEMBER (unless project lead) | Mock auth as MEMBER (not lead) | Call updateProject | Error: "Not authorized" | REQ-018 |
| 5 | allows project lead (MEMBER) to update | Mock auth as MEMBER who is project lead | Call updateProject | Success | REQ-018 |
| 6 | validates leadId is a workspace member | Mock prisma member lookup returns null for leadId | Call updateProject({ id, leadId: 'non-member' }) | Error: validation | REQ-018 |

### 4.5 Star/Favorite Project (REQ-021)

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | creates ProjectFavorite when starring | Mock auth; mock no existing favorite | Call toggleProjectFavorite(projectId) | ProjectFavorite created; returns { isFavorite: true } | REQ-021 |
| 2 | deletes ProjectFavorite when unstarring | Mock auth; mock existing favorite | Call toggleProjectFavorite(projectId) | ProjectFavorite deleted; returns { isFavorite: false } | REQ-021 |
| 3 | returns error for non-existent project | Mock prisma project not found | Call toggleProjectFavorite('bad-id') | Error | REQ-021 |
| 4 | returns error for user not in workspace | Mock auth user not a member | Call toggleProjectFavorite | Error: "Not authorized" | REQ-021 |

### 4.6 Archive Project (REQ-017 implied, contracts)

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | sets deletedAt on project (soft delete) | Mock auth as OWNER | Call archiveProject(projectId) | Project.deletedAt set to current time | REQ-017 |
| 2 | rejects archive from MEMBER role | Mock auth as MEMBER | Call archiveProject | Error: "Not authorized" | REQ-017 |
| 3 | rejects archive of non-existent project | Mock prisma returns null | Call archiveProject('bad-id') | Error: "Project not found" | REQ-017 |
| 4 | archived projects excluded from list queries | Mock prisma with deletedAt set | Query projects | Soft-deleted projects not returned | Revision: soft-delete query exclusion |

### 4.7 Project Sub-Navigation (REQ-024)

**File:** `src/components/__tests__/project-nav.test.tsx`

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | renders Board, List, Settings tabs | Create project fixture | Render ProjectSubNav | Three tab links visible | REQ-024 |
| 2 | highlights active tab (Board) | Mock pathname to /acme/PROJ/board | Render ProjectSubNav | Board tab has active styling | REQ-024 |
| 3 | highlights active tab (List) | Mock pathname to /acme/PROJ/list | Render ProjectSubNav | List tab has active styling | REQ-024 |
| 4 | Board tab links to correct URL | Create fixtures | Render ProjectSubNav | Board href = /acme/PROJ/board | REQ-024 |
| 5 | List tab links to correct URL | Create fixtures | Render ProjectSubNav | List href = /acme/PROJ/list | REQ-024 |
| 6 | Settings tab links to correct URL | Create fixtures | Render ProjectSubNav | Settings href = /acme/PROJ/settings | REQ-024 |

---

## 5. Issue Module Tests

### 5.1 Create Issue Validation (REQ-025)

**File:** `src/lib/validations/__tests__/issue.test.ts`

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | accepts valid issue input with all fields | None | Parse full createIssueSchema input | Success | REQ-025 |
| 2 | accepts minimal issue input (title + required fields only) | None | Parse `{ title: 'Bug fix', type: 'TASK', priority: 'MEDIUM', projectId: 'cuid', statusId: 'cuid' }` | Success | REQ-025 |
| 3 | rejects empty title | None | Parse with title: '' | ZodError: "Title is required" | REQ-025 |
| 4 | rejects title longer than 255 chars | None | Parse with 256-char title | ZodError: "Title too long" | REQ-025 |
| 5 | accepts title of exactly 255 chars | None | Parse with 255-char title | Success | REQ-025 |
| 6 | rejects invalid issue type | None | Parse with type: 'FEATURE' | ZodError | REQ-029 |
| 7 | accepts all valid issue types (EPIC, STORY, TASK, BUG) | None | Parse each type | All succeed | REQ-029 |
| 8 | rejects invalid priority | None | Parse with priority: 'CRITICAL' | ZodError | REQ-030 |
| 9 | accepts all valid priorities (URGENT, HIGH, MEDIUM, LOW, NONE) | None | Parse each priority | All succeed | REQ-030 |
| 10 | accepts null assigneeId | None | Parse with assigneeId: null | Success | REQ-025 |
| 11 | accepts empty labelIds array | None | Parse with labelIds: [] | Success | REQ-025 |
| 12 | accepts null dueDate | None | Parse with dueDate: null | Success | REQ-033 |
| 13 | coerces valid date string to Date | None | Parse with dueDate: '2026-04-01' | Success; dueDate is Date object | REQ-033 |
| 14 | rejects invalid projectId format | None | Parse with projectId: 'not-cuid' | ZodError | REQ-025 |
| 15 | rejects invalid statusId format | None | Parse with statusId: 'not-cuid' | ZodError | REQ-025 |

### 5.2 Update Issue Validation (REQ-037)

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | accepts valid partial update (title only) | None | Parse `{ id: 'cuid', title: 'Updated', updatedAt: new Date() }` | Success | REQ-037 |
| 2 | requires updatedAt for optimistic locking | None | Parse without updatedAt field | ZodError | REQ-037 |
| 3 | accepts any combination of optional fields | None | Parse with title + priority + assigneeId | Success | REQ-037 |
| 4 | requires id field | None | Parse without id | ZodError | REQ-037 |

### 5.3 Move Issue Validation (REQ-041)

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | accepts valid move input | None | Parse `{ id: 'cuid', statusId: 'cuid', position: 'a0' }` | Success | REQ-041 |
| 2 | rejects empty position | None | Parse with position: '' | ZodError (string type, but semantically should be non-empty) | REQ-041 |
| 3 | requires all three fields | None | Parse with missing statusId | ZodError | REQ-041 |

### 5.4 Create Issue Server Action (REQ-025, REQ-026)

**File:** `src/server/actions/__tests__/issue.test.ts`

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | creates issue with auto-generated key (PREFIX-1) | Mock auth as MEMBER; mock project with issueCounter=0; mock prisma.$transaction | Call createIssue({ title, projectId, ... }) | Issue created with key 'PROJ-1', number 1; project.issueCounter incremented to 1 | REQ-025, REQ-026 |
| 2 | increments issue counter atomically | Mock project with issueCounter=41 | Call createIssue | Issue key = 'PROJ-42', number = 42; counter = 42 | REQ-026 |
| 3 | uses $transaction for atomic counter + create | Mock prisma | Call createIssue | prisma.$transaction called (not separate queries) | REQ-026 |
| 4 | sets reporterId to current user | Mock auth as user-1 | Call createIssue | Issue.reporterId = 'user-1' | REQ-025 |
| 5 | sets default values (type=TASK, priority=MEDIUM) | Mock auth; mock prisma | Call createIssue with defaults | Issue has type TASK and priority MEDIUM | REQ-025, REQ-029, REQ-030 |
| 6 | creates activity log entry for issue creation | Mock auth; mock prisma | Call createIssue | Activity record created with type 'ISSUE_CREATED' | REQ-025, REQ-036 |
| 7 | rejects VIEWER from creating issues | Mock auth as VIEWER | Call createIssue | Error: "Not authorized" | REQ-025 |
| 8 | validates statusId belongs to the project | Mock status from different project | Call createIssue with wrong statusId | Error: "Invalid status" | REQ-025 |
| 9 | validates assigneeId is workspace member | Mock assignee not in workspace | Call createIssue with invalid assigneeId | Error: validation | REQ-025 |
| 10 | extracts descriptionText from Tiptap JSON | Mock auth; mock prisma | Call createIssue with description JSON | descriptionText field populated with plain text | REQ-034 |
| 11 | ensures workspaceId isolation in queries | Mock auth; mock prisma | Call createIssue | All DB queries include workspaceId filter | Revision: workspace isolation |
| 12 | soft-deleted issues excluded (deletedAt: null filter) | Mock prisma | Query issues | WHERE includes deletedAt: null | Revision: soft-delete |

### 5.5 Update Issue Server Action (REQ-037)

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | updates issue fields successfully | Mock auth as MEMBER; mock issue exists | Call updateIssue({ id, title: 'New Title', updatedAt }) | Issue updated; success response | REQ-037 |
| 2 | returns 409 on optimistic locking conflict | Mock issue with different updatedAt | Call updateIssue with stale updatedAt | Error: "Conflict: issue was modified" | REQ-037 |
| 3 | creates activity log for each changed field | Mock issue with old values | Call updateIssue changing title + priority | 2 Activity records created (one per field) | REQ-036, REQ-037 |
| 4 | rejects update from VIEWER role | Mock auth as VIEWER | Call updateIssue | Error: "Not authorized" | REQ-037 |
| 5 | returns 404 for deleted issue | Mock issue with deletedAt set | Call updateIssue | Error: "Issue not found" | REQ-037 |
| 6 | returns 404 for non-existent issue | Mock prisma returns null | Call updateIssue | Error: "Issue not found" | REQ-037 |
| 7 | partial update only changes specified fields | Mock issue | Call updateIssue with only priority | Only priority changed; other fields unchanged | REQ-037 |

### 5.6 Delete Issue Server Action (REQ-038)

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | soft-deletes issue (sets deletedAt) | Mock auth as OWNER; mock issue | Call deleteIssue(issueId) | Issue.deletedAt set; not physically deleted | REQ-038 |
| 2 | OWNER can delete any issue | Mock auth as OWNER; mock issue by different reporter | Call deleteIssue | Success | REQ-038 |
| 3 | ADMIN can delete any issue | Mock auth as ADMIN | Call deleteIssue | Success | REQ-038 |
| 4 | MEMBER can delete own issue (reporter) | Mock auth as MEMBER, same as reporterId | Call deleteIssue | Success | REQ-038 |
| 5 | MEMBER cannot delete others' issues | Mock auth as MEMBER, different from reporterId | Call deleteIssue | Error: "Not authorized" | REQ-038 |
| 6 | VIEWER cannot delete issues | Mock auth as VIEWER | Call deleteIssue | Error: "Not authorized" | REQ-038 |
| 7 | returns 404 for non-existent issue | Mock prisma returns null | Call deleteIssue | Error: "Issue not found" | REQ-038 |
| 8 | returns 404 for already-deleted issue | Mock issue with deletedAt set | Call deleteIssue | Error: "Issue not found" | REQ-038 |
| 9 | issue key not freed for reuse after deletion | Mock project counter at 5; delete issue 3 | Verify counter not decremented | Counter stays at 5 | REQ-026, REQ-038 |

### 5.7 Move Issue Server Action (REQ-041)

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | updates statusId and position on move | Mock auth as MEMBER; mock issue | Call moveIssue({ id, statusId, position }) | Issue statusId and position updated | REQ-041 |
| 2 | creates activity log for status change | Mock issue with old status | Call moveIssue to new status | Activity created with STATUS_CHANGED type and from/to metadata | REQ-041, REQ-036 |
| 3 | no activity log when position-only change (same status) | Mock issue | Call moveIssue with same statusId | No STATUS_CHANGED activity (position change is silent) | REQ-042 |
| 4 | rejects move from VIEWER role | Mock auth as VIEWER | Call moveIssue | Error: "Not authorized" | REQ-041 |
| 5 | validates target statusId belongs to project | Mock status from different project | Call moveIssue | Error: "Invalid status" | REQ-041 |
| 6 | rejects move of non-existent issue | Mock prisma returns null | Call moveIssue | Error: "Issue not found" | REQ-041 |

### 5.8 Reorder Issue Server Action (REQ-042)

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | updates position within same column | Mock auth; mock issue | Call reorderIssue({ id, position: 'a1' }) | Issue.position updated | REQ-042 |
| 2 | does not change statusId | Mock auth; mock issue | Call reorderIssue | statusId unchanged | REQ-042 |
| 3 | rejects reorder from VIEWER | Mock auth as VIEWER | Call reorderIssue | Error: "Not authorized" | REQ-042 |

### 5.9 Issue Types (REQ-029)

**File:** `src/lib/__tests__/constants.test.ts`

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | ISSUE_TYPE_CONFIG has entries for all 4 types | None | Check ISSUE_TYPE_CONFIG keys | Contains EPIC, STORY, TASK, BUG | REQ-029 |
| 2 | each type has label, icon, and color | None | Check each entry | All have non-empty label, icon, color | REQ-029 |
| 3 | PRIORITY_CONFIG has entries for all 5 priorities | None | Check PRIORITY_CONFIG keys | Contains URGENT, HIGH, MEDIUM, LOW, NONE | REQ-030 |
| 4 | each priority has label, icon, color, and level | None | Check each entry | All fields present | REQ-030 |
| 5 | priority levels are ordered (URGENT=0 to NONE=4) | None | Verify level values | URGENT:0, HIGH:1, MEDIUM:2, LOW:3, NONE:4 | REQ-030 |

### 5.10 Issue Due Date Logic (REQ-033)

**File:** `src/lib/__tests__/date-utils.test.ts`

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | identifies overdue issue (past due date, status not DONE/CANCELLED) | Issue with dueDate = yesterday, status = IN_PROGRESS | Call isOverdue(issue) | Returns true | REQ-033 |
| 2 | does not flag as overdue if status is DONE | Issue with dueDate = yesterday, status category = DONE | Call isOverdue(issue) | Returns false | REQ-033 |
| 3 | does not flag as overdue if status is CANCELLED | Issue with dueDate = yesterday, status category = CANCELLED | Call isOverdue(issue) | Returns false | REQ-033 |
| 4 | identifies "due soon" (within 3 days) | Issue with dueDate = 2 days from now | Call isDueSoon(issue) | Returns true | REQ-033 |
| 5 | does not flag "due soon" if > 3 days out | Issue with dueDate = 5 days from now | Call isDueSoon(issue) | Returns false | REQ-033 |
| 6 | handles null dueDate gracefully | Issue with dueDate = null | Call isOverdue(issue) | Returns false | REQ-033 |
| 7 | today's date is "due soon" not "overdue" | Issue with dueDate = today | Call isOverdue/isDueSoon | isOverdue: false, isDueSoon: true | REQ-033 |

### 5.11 Issue Comments (REQ-035)

**File:** `src/server/actions/__tests__/comment.test.ts`

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | creates comment with author and body | Mock auth; mock prisma | Call createComment({ issueId, body }) | Comment created with authorId = current user | REQ-035 |
| 2 | all roles including VIEWER can comment | Mock auth as VIEWER | Call createComment | Success | REQ-035 |
| 3 | creates activity log entry for comment | Mock auth; mock prisma | Call createComment | Activity with type COMMENT_ADDED created | REQ-035, REQ-036 |
| 4 | extracts bodyText for search | Mock auth; mock prisma | Call createComment with Tiptap JSON | bodyText populated with plain text | REQ-035 |
| 5 | returns error for non-existent issue | Mock prisma issue lookup returns null | Call createComment | Error: "Issue not found" | REQ-035 |
| 6 | author can edit own comment | Mock auth as comment author | Call updateComment({ id, body }) | Comment updated | REQ-035 |
| 7 | non-author cannot edit comment | Mock auth as different user (MEMBER) | Call updateComment | Error: "Not the author" | REQ-035 |
| 8 | author can delete own comment | Mock auth as comment author | Call deleteComment({ id }) | Comment deleted | REQ-035 |
| 9 | ADMIN can delete any comment | Mock auth as ADMIN | Call deleteComment | Success | REQ-035 |
| 10 | OWNER can delete any comment | Mock auth as OWNER | Call deleteComment | Success | REQ-035 |
| 11 | MEMBER cannot delete other's comment | Mock auth as MEMBER (not author, not admin) | Call deleteComment | Error: "Not authorized" | REQ-035 |
| 12 | returns error for non-existent comment | Mock prisma returns null | Call deleteComment | Error: "Comment not found" | REQ-035 |

### 5.12 Activity Log (REQ-036)

**File:** `src/lib/__tests__/activity.test.ts` or `src/server/actions/__tests__/activity.test.ts`

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | status change creates activity with from/to | Issue status changed from TODO to IN_PROGRESS | Log activity | Activity metadata = { field: 'status', from: 'Todo', to: 'In Progress' } | REQ-036 |
| 2 | assignee change creates activity with from/to | Issue assignee changed | Log activity | Activity metadata = { field: 'assignee', from: 'Alice', to: 'Bob' } | REQ-036 |
| 3 | priority change creates activity | Priority changed | Log activity | Activity metadata = { field: 'priority', from: 'MEDIUM', to: 'HIGH' } | REQ-036 |
| 4 | label add/remove creates activity | Labels changed | Log activity | Activity metadata = { field: 'labels', added: [...], removed: [...] } | REQ-036 |
| 5 | description edit creates activity (no diff) | Description changed | Log activity | Activity metadata = { field: 'description', from: null, to: null } (no full diff stored) | REQ-036 |
| 6 | due date set creates activity | Due date set | Log activity | Activity metadata = { field: 'dueDate', from: null, to: '2026-04-01' } | REQ-036 |
| 7 | activity entries are append-only | None | Verify no update/delete operations for Activity model | No mutation functions for Activity | REQ-036 |

---

## 6. Board View Module Tests

### 6.1 Board Rendering (REQ-039)

**File:** `src/components/boards/__tests__/board-view.test.tsx`

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | renders all columns ordered by position | Create BoardData with 6 columns | Render BoardView | 6 columns visible, in correct order (Backlog, Todo, In Progress, In Review, Done, Cancelled) | REQ-039 |
| 2 | renders column headers with status name and color | Create BoardData | Render BoardView | Each column header shows name and color indicator | REQ-039 |
| 3 | renders issue cards within correct columns | Create BoardData with issues in various columns | Render BoardView | Issues appear in their respective status columns | REQ-039 |
| 4 | shows empty state when no issues exist | Create BoardData with empty columns | Render BoardView | Empty state message visible | REQ-039, REQ-054 |

### 6.2 Issue Card (REQ-040)

**File:** `src/components/boards/__tests__/issue-card.test.tsx`

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | renders issue key | Create BoardIssue fixture | Render IssueCard | 'PROJ-1' visible | REQ-040 |
| 2 | renders issue title | Create fixture | Render IssueCard | Title text visible | REQ-040 |
| 3 | renders type icon | Create fixture with type=BUG | Render IssueCard | Bug icon visible | REQ-040 |
| 4 | renders priority icon | Create fixture with priority=HIGH | Render IssueCard | High priority icon visible | REQ-040 |
| 5 | renders assignee avatar | Create fixture with assignee | Render IssueCard | Assignee avatar visible | REQ-040 |
| 6 | shows 'Unassigned' when no assignee | Create fixture with assignee: null | Render IssueCard | No assignee avatar shown (or placeholder) | REQ-040 |
| 7 | renders label badges (max 3 visible) | Create fixture with 5 labels | Render IssueCard | 3 labels shown + "+2 more" indicator | REQ-040 |
| 8 | renders due date when set | Create fixture with dueDate | Render IssueCard | Date text visible | REQ-040 |
| 9 | shows overdue styling for past due date | Create fixture with past dueDate, status != DONE | Render IssueCard | Red/overdue styling applied | REQ-040, REQ-033 |
| 10 | truncates long titles (2 lines max) | Create fixture with very long title | Render IssueCard | Title truncated with CSS | REQ-040 |
| 11 | card is clickable (navigates to issue detail) | Create fixture; mock router | Click card | Navigation to issue detail URL triggered | REQ-040 |

### 6.3 Board Column Issue Count (REQ-045)

**File:** `src/components/boards/__tests__/board-column.test.tsx`

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | displays issue count in column header | Create column with 5 issues | Render BoardColumn | Count badge shows "5" | REQ-045 |
| 2 | displays 0 for empty column | Create column with 0 issues | Render BoardColumn | Count badge shows "0" | REQ-045 |
| 3 | count reflects filtered issues (not total) | Create column; apply filter that hides 3 of 5 | Render filtered column | Count shows "2" | REQ-045 |

### 6.4 Drag-and-Drop State Management (REQ-041, REQ-042)

**File:** `src/components/boards/__tests__/board-dnd.test.tsx`

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | drag start sets active issue state | Create board with issues | Simulate dragStart event | Active drag state contains the dragged issue | REQ-041 |
| 2 | drag over highlights target column | Create board | Simulate dragOver on column B | isOver state is true for column B | REQ-041 |
| 3 | drag end to different column triggers moveIssue | Create board; mock moveIssue action | Simulate dragEnd from column A to column B | moveIssue called with correct statusId and new position | REQ-041 |
| 4 | drag end within same column triggers reorderIssue | Create board; mock reorderIssue action | Simulate dragEnd within same column | reorderIssue called with new position, statusId unchanged | REQ-042 |
| 5 | optimistic update moves card immediately | Create board with issue in column A | Simulate drag from A to B | Board state shows issue in column B before server response | REQ-041 |
| 6 | reverts on server error | Create board; mock moveIssue to reject | Simulate drag + error | Issue reverts to original column | REQ-041 |
| 7 | VIEWER cannot initiate drag | Create board; render as VIEWER | Attempt drag | Drag not initiated (drag handle disabled) | REQ-041 |
| 8 | column counts update optimistically during drag | Create board with column A(3 issues) and B(2 issues) | Drag from A to B | A shows 2, B shows 3 | REQ-045 |

### 6.5 Quick-Add Issue from Column (REQ-043)

**File:** `src/components/boards/__tests__/quick-add.test.tsx`

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | shows inline input on click Add button | Create column | Click "+" button | Text input appears | REQ-043 |
| 2 | creates issue on Enter with column's status | Mock createIssue; create column | Type title + press Enter | createIssue called with statusId = column status | REQ-043 |
| 3 | creates issue with default type TASK and priority MEDIUM | Mock createIssue | Type title + Enter | type: 'TASK', priority: 'MEDIUM' in call | REQ-043 |
| 4 | clears input after successful creation | Mock createIssue success | Type title + Enter | Input cleared, remains focused | REQ-043 |
| 5 | closes input on Escape | Create column; open input | Press Escape | Input hidden | REQ-043 |
| 6 | does nothing on Enter with empty title | Create column; open input | Press Enter without typing | No createIssue call | REQ-043 |
| 7 | input remains open for rapid multi-creation | Mock createIssue | Create issue via Enter | Input still visible and focused after creation | REQ-043 |

### 6.6 Board Quick Filters (REQ-044)

**File:** `src/components/boards/__tests__/board-filters.test.tsx`

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | renders filter buttons (Assignee, Priority, Label, Type) | Create board data | Render filter bar | 4 filter buttons visible | REQ-044 |
| 2 | filtering by assignee hides non-matching issues | Create issues with different assignees | Select assignee filter for 'Alice' | Only Alice's issues visible | REQ-044 |
| 3 | filtering by priority shows matching issues | Create issues with different priorities | Select 'HIGH' priority filter | Only HIGH priority issues visible | REQ-044 |
| 4 | multiple filters apply with AND logic | Create diverse issues | Filter assignee=Alice AND priority=HIGH | Only Alice's HIGH issues visible | REQ-044 |
| 5 | active filter shows count badge | Create filters | Select 2 priority values | Priority button shows "(2)" count | REQ-044 |
| 6 | Clear all filters removes all active filters | Apply multiple filters | Click "Clear all filters" | All issues visible; no active filters | REQ-044 |
| 7 | filter state persists in URL search params | Apply assignee filter | Check URL | URL contains ?assignee=userId | REQ-044 |
| 8 | no results shows appropriate empty state | Filter combination matches nothing | Apply impossible filter combo | "No issues match your filters" + "Clear filters" button | REQ-044, REQ-054 |
| 9 | invalid filter value in URL is ignored | Navigate with ?assignee=deleted-user-id | Render board | Board renders without crashing; invalid filter ignored | REQ-044 |

---

## 7. List View Module Tests

### 7.1 Issue List Table (REQ-046)

**File:** `src/components/list/__tests__/issue-list.test.tsx`

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | renders table with correct columns | Create issue fixtures | Render IssueListTable | Columns: type, key, title, status, priority, assignee, labels, due date, created | REQ-046 |
| 2 | renders issue data in table rows | Create 3 issue fixtures | Render IssueListTable | 3 rows with correct data | REQ-046 |
| 3 | clicking row navigates to issue detail | Mock router; create fixture | Click row | router.push to /workspace/PROJ/issues/PROJ-1 | REQ-046 |
| 4 | shows empty state when no issues | Empty issue array | Render IssueListTable | Empty state message visible | REQ-046, REQ-054 |
| 5 | shows status as colored badge | Create issue with status 'In Progress' | Render row | Status badge with color dot and text | REQ-046 |
| 6 | shows priority icon | Create issue with priority HIGH | Render row | Priority icon visible | REQ-046 |
| 7 | shows assignee avatar + name | Create issue with assignee | Render row | Avatar and name visible | REQ-046 |
| 8 | shows labels as colored badges | Create issue with 2 labels | Render row | 2 label badges visible | REQ-046 |

### 7.2 Table Sorting (REQ-047)

**File:** `src/components/list/__tests__/table-sorting.test.tsx`

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | default sort is by created date descending | Create issues with different dates | Render table | Newest issue first | REQ-047 |
| 2 | clicking title header sorts ascending | Create issues | Click title column header | Issues sorted A-Z by title | REQ-047 |
| 3 | clicking same header again sorts descending | After ascending sort | Click title header again | Issues sorted Z-A | REQ-047 |
| 4 | clicking same header third time removes sort | After descending | Click title header | Default sort restored | REQ-047 |
| 5 | sort indicator shows on active column | Click priority header | Render | Arrow visible on priority column | REQ-047 |
| 6 | null values sorted to end (due date) | Create issues, some with null dueDate | Sort by due date ascending | Non-null dates first, nulls at end | REQ-047 |
| 7 | null values sorted to end (assignee) | Create issues, some unassigned | Sort by assignee ascending | Assigned first, unassigned at end | REQ-047 |
| 8 | sort state persisted in URL | Sort by priority | Check URL | URL contains sort params | REQ-047 |

### 7.3 Table Filtering (REQ-048)

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | list view includes status filter (unlike board) | Create fixtures | Render filter bar | Status filter button visible | REQ-048 |
| 2 | filters apply to list data (same as board) | Create diverse issues; apply filter | Apply assignee filter | Table shows only matching rows | REQ-048 |
| 3 | combined filter + sort works correctly | Create issues | Apply filter then sort | Filtered results in sorted order | REQ-048 |

### 7.4 Column Visibility Toggle (REQ-049)

**File:** `src/components/list/__tests__/column-visibility.test.tsx`

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | all columns visible by default (desktop) | Desktop viewport | Render table | All columns visible | REQ-049 |
| 2 | toggling column off hides it | Click Columns button; uncheck "Labels" | Render | Labels column hidden | REQ-049 |
| 3 | toggling column on shows it | After hiding; check "Labels" again | Render | Labels column visible | REQ-049 |
| 4 | key and title columns are always visible (not toggleable) | Click Columns button | Render popover | Key and Title checkboxes disabled or absent | REQ-049 |
| 5 | visibility persisted to localStorage | Toggle column off | Read localStorage | Column visibility state saved | REQ-049 |
| 6 | graceful fallback when localStorage unavailable | Mock localStorage to throw | Render table | All default columns visible, no crash | REQ-049 |

---

## 8. Search Module Tests

### 8.1 Search API Route (REQ-050)

**File:** `src/app/api/search/__tests__/route.test.ts`

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | returns matching issues by title (case-insensitive) | Mock prisma with matching issues | GET /api/search?workspaceId=x&query=bug&limit=10 | Returns issues with 'bug' in title | REQ-050 |
| 2 | returns matching issues by key | Mock prisma | GET with query=PROJ-123 | Returns issue with key PROJ-123 | REQ-050 |
| 3 | limits results to specified limit | Mock prisma with 20 matches | GET with limit=10 | Returns max 10 results | REQ-050 |
| 4 | defaults limit to 10 | Mock prisma | GET without limit param | Limit defaults to 10 | REQ-050 |
| 5 | returns empty array for no matches | Mock prisma returns [] | GET with query=nonexistent | Returns empty array | REQ-050 |
| 6 | rejects unauthenticated requests | No session | GET /api/search | Returns 401 | REQ-050 |
| 7 | scopes results to workspace | Mock auth; mock prisma | GET with workspaceId=X | Query includes workspaceId filter | REQ-050 |
| 8 | rejects query shorter than 1 char | None | GET with query= (empty) | Returns 400 validation error | REQ-050 |
| 9 | truncates query longer than 200 chars | None | GET with 201-char query | Either truncated or rejected per schema | REQ-050 |
| 10 | excludes soft-deleted issues from results | Mock prisma | GET with valid query | Query includes deletedAt: null filter | REQ-050, Revision |
| 11 | exact key match ranked first in results | Mock issues: PROJ-1 (key match) + 'PROJ-1 related' (title match) | GET with query=PROJ-1 | Key match appears first | REQ-051 |

### 8.2 Search Validation Schema (REQ-050)

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | accepts valid search input | None | Parse `{ workspaceId: 'cuid', query: 'bug', limit: 10 }` | Success | REQ-050 |
| 2 | rejects empty query | None | Parse with query: '' | ZodError | REQ-050 |
| 3 | rejects missing workspaceId | None | Parse without workspaceId | ZodError | REQ-050 |
| 4 | accepts query without limit (defaults to 10) | None | Parse without limit | Success; limit defaults to 10 | REQ-050 |
| 5 | rejects limit > 50 | None | Parse with limit: 100 | ZodError | REQ-050 |
| 6 | rejects limit < 1 | None | Parse with limit: 0 | ZodError | REQ-050 |

### 8.3 Search Results Display (REQ-051)

**File:** `src/components/__tests__/search-results.test.tsx`

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | renders search result with key, title, project name | Create SearchResult fixtures | Render results | All fields visible | REQ-051 |
| 2 | renders status badge with color | Create fixture with status | Render | Status badge with correct color | REQ-051 |
| 3 | renders assignee avatar | Create fixture with assignee | Render | Avatar visible | REQ-051 |
| 4 | handles null assignee gracefully | Create fixture with assignee: null | Render | No avatar, no crash | REQ-051 |
| 5 | maximum 10 results shown | Create 15 results | Render | Only 10 visible | REQ-051 |
| 6 | shows "No issues found" for empty results | Empty results array | Render | Empty message visible | REQ-051, REQ-054 |

### 8.4 Search Keyboard Navigation (REQ-052)

**File:** `src/components/__tests__/command-palette.test.tsx`

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | opens on Cmd+K / Ctrl+K | Render with keyboard listener | Press Ctrl+K | Palette dialog opens | REQ-052 |
| 2 | closes on Escape | Open palette | Press Escape | Palette dialog closes | REQ-052 |
| 3 | closes on Cmd+K toggle | Open palette | Press Ctrl+K again | Palette closes | REQ-052 |
| 4 | input is auto-focused on open | Open palette | Check focus | Input is focused | REQ-052 |
| 5 | down arrow moves selection | Open palette with results | Press ArrowDown | Second item highlighted | REQ-052 |
| 6 | up arrow moves selection | With second item selected | Press ArrowUp | First item highlighted | REQ-052 |
| 7 | Enter navigates to selected result | Select a result; mock router | Press Enter | Router navigates to issue detail URL | REQ-052 |
| 8 | Enter with no results does nothing | Empty results | Press Enter | No navigation | REQ-052 |
| 9 | typing triggers debounced search | Open palette; mock search API | Type 'bu' then 'g' | Search called after 300ms debounce | REQ-050 |
| 10 | search not triggered for < 2 characters | Open palette | Type 'b' | No search API call | REQ-050 |

### 8.5 Search Button in Header (REQ-053)

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | renders search trigger in header | Render header | Render | Search button/input with placeholder visible | REQ-053 |
| 2 | shows keyboard shortcut hint | Render header | Render | "Cmd+K" or "Ctrl+K" badge visible | REQ-053 |
| 3 | clicking opens command palette | Render header; mock palette | Click search trigger | Command palette opens | REQ-053 |

---

## 9. Labels Module Tests

### 9.1 Label Validation (REQ-032)

**File:** `src/lib/validations/__tests__/label.test.ts`

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | accepts valid label input | None | Parse `{ workspaceId: 'cuid', name: 'Bug', color: '#EF4444' }` | Success | REQ-032 |
| 2 | rejects empty label name | None | Parse with name: '' | ZodError: "Name is required" | REQ-032 |
| 3 | rejects name longer than 50 chars | None | Parse with 51-char name | ZodError: "Name too long" | REQ-032 |
| 4 | uses default color when none provided | None | Parse without color field | Success; color defaults to '#6B7280' | REQ-032 |
| 5 | rejects invalid hex color | None | Parse with color: 'blue' | ZodError: "Must be a valid hex color" | REQ-032 |
| 6 | accepts valid hex color with uppercase | None | Parse with color: '#FF0000' | Success | REQ-032 |
| 7 | rejects hex color without hash | None | Parse with color: 'EF4444' | ZodError | REQ-032 |
| 8 | rejects 3-char hex shorthand | None | Parse with color: '#F00' | ZodError (requires 6-char hex) | REQ-032 |

### 9.2 Create Label Server Action (REQ-032)

**File:** `src/server/actions/__tests__/label.test.ts`

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | creates label in workspace | Mock auth as OWNER; mock prisma | Call createLabel({ workspaceId, name, color }) | Label created | REQ-032 |
| 2 | rejects duplicate name within workspace | Mock prisma unique constraint error | Call createLabel with existing name | Error: "Label name already exists" | REQ-032 |
| 3 | allows same name in different workspaces | Mock prisma (no conflict) | Call createLabel | Success | REQ-032 |
| 4 | OWNER can create labels | Mock auth as OWNER | Call createLabel | Success | REQ-032 |
| 5 | ADMIN can create labels | Mock auth as ADMIN | Call createLabel | Success | REQ-032 |
| 6 | MEMBER cannot create labels | Mock auth as MEMBER | Call createLabel | Error: "Not authorized" | REQ-032 |
| 7 | VIEWER cannot create labels | Mock auth as VIEWER | Call createLabel | Error: "Not authorized" | REQ-032 |

### 9.3 Update Label Server Action (REQ-032)

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | updates label name | Mock auth as ADMIN; mock prisma | Call updateLabel({ id, name: 'New Name' }) | Label updated | REQ-032 |
| 2 | updates label color | Mock auth as ADMIN | Call updateLabel({ id, color: '#FF0000' }) | Label color updated | REQ-032 |
| 3 | rejects duplicate name on update | Mock prisma unique constraint | Call updateLabel with existing name | Error: "Label name already exists" | REQ-032 |
| 4 | returns error for non-existent label | Mock prisma returns null | Call updateLabel | Error: "Label not found" | REQ-032 |
| 5 | MEMBER cannot update labels | Mock auth as MEMBER | Call updateLabel | Error: "Not authorized" | REQ-032 |

### 9.4 Delete Label Server Action (REQ-032)

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | deletes label and removes from all issues | Mock auth as ADMIN; mock prisma | Call deleteLabel({ id }) | Label deleted (cascade removes from issues) | REQ-032 |
| 2 | MEMBER cannot delete labels | Mock auth as MEMBER | Call deleteLabel | Error: "Not authorized" | REQ-032 |
| 3 | returns error for non-existent label | Mock prisma returns null | Call deleteLabel | Error: "Label not found" | REQ-032 |

### 9.5 Label Assignment to Issues (REQ-032)

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | MEMBER can assign labels to issues | Mock auth as MEMBER | Call updateIssue with labelIds | Success; labels connected | REQ-032 |
| 2 | VIEWER cannot assign labels | Mock auth as VIEWER | Call updateIssue with labelIds | Error: "Not authorized" | REQ-032 |
| 3 | validates labelIds belong to workspace | Mock label from different workspace | Call updateIssue with wrong labelIds | Error: validation | REQ-032 |
| 4 | multiple labels can be assigned to one issue | Mock auth; mock prisma | Call updateIssue with 3 labelIds | All 3 labels connected | REQ-032 |

---

## 10. Cross-Cutting Tests

### 10.1 Empty States (REQ-054)

**File:** `src/components/__tests__/empty-states.test.tsx`

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | no projects shows create project CTA | Empty projects array | Render ProjectList | "Create your first project" heading + button | REQ-054 |
| 2 | no issues on board shows create issue CTA | Empty board data | Render BoardView | "No issues yet" + "Create issue" button | REQ-054 |
| 3 | no issues on list shows empty state | Empty issue list | Render IssueListTable | Empty state with CTA | REQ-054 |
| 4 | no search results shows message | Empty search results with query | Render search results | "No issues found for '[query]'" | REQ-054 |
| 5 | no comments shows placeholder | Empty comments array | Render comments section | "No comments yet. Be the first to comment." | REQ-054 |
| 6 | no filter results shows clear filters option | Applied filters with 0 matches | Render board/list | "No issues match your filters" + "Clear filters" | REQ-054 |
| 7 | starred section hidden when no starred projects | No ProjectFavorites | Render sidebar | No "Starred" section visible | REQ-054 |

### 10.2 Loading States (REQ-055)

**File:** `src/components/__tests__/loading-states.test.tsx`

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | board skeleton renders correct structure | None | Render board loading.tsx | Skeleton columns with skeleton cards visible | REQ-055 |
| 2 | list skeleton renders correct structure | None | Render list loading.tsx | Skeleton table with ~10 rows | REQ-055 |
| 3 | issue detail skeleton renders | None | Render issue detail skeleton | Skeleton for title, description, sidebar | REQ-055 |
| 4 | submit button shows spinner during submission | Trigger form submit; mock pending state | Render form | Button shows spinner and is disabled | REQ-055 |

### 10.3 Error States (REQ-056)

**File:** `src/app/__tests__/error-boundaries.test.tsx`

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | global error boundary renders error message | Throw error in child component | Render with ErrorBoundary | "Something went wrong" + "Try again" button | REQ-056 |
| 2 | Try again button calls reset function | Render error boundary | Click "Try again" | reset() called | REQ-056 |
| 3 | 404 page renders correctly | None | Render not-found page | "Page not found" + "Go to home" link | REQ-056 |

### 10.4 Toast Notifications (REQ-059)

**File:** `src/lib/__tests__/toast.test.ts` or component tests

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | success toast shown on issue create | Mock createIssue success | Call createIssue through UI | Toast with "Issue [KEY] created" | REQ-059 |
| 2 | error toast shown on server action failure | Mock action returns error | Trigger action | Toast with error message | REQ-059 |
| 3 | permission error toast | Mock 403 response | Trigger unauthorized action | Toast: "You don't have permission..." | REQ-059 |

### 10.5 Breadcrumb Navigation (REQ-060)

**File:** `src/components/__tests__/breadcrumb.test.tsx`

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | renders workspace > project > view breadcrumb | Mock params for board page | Render Breadcrumb | "Acme Corp > Mobile App > Board" visible | REQ-060 |
| 2 | renders workspace > settings breadcrumb | Mock params for settings | Render Breadcrumb | "Acme Corp > Settings" visible | REQ-060 |
| 3 | renders workspace > project > issue key breadcrumb | Mock params for issue detail | Render Breadcrumb | "Acme Corp > Mobile App > PROJ-123" | REQ-060 |
| 4 | each segment (except last) is a clickable link | Render breadcrumb | Check link elements | All segments except last are anchors | REQ-060 |
| 5 | last segment is not clickable | Render breadcrumb | Check last segment | Text only, not a link | REQ-060 |

### 10.6 Dark/Light Mode (REQ-058)

**File:** `src/components/__tests__/theme-toggle.test.tsx`

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | renders theme toggle in user menu | Render user dropdown | Open dropdown | Theme toggle visible | REQ-058 |
| 2 | toggles between light and dark | Render with light theme | Click toggle | Theme changes to dark | REQ-058 |
| 3 | system option follows OS preference | Mock system preference as dark | Select "System" | Dark theme applied | REQ-058 |

---

## 11. Validation Schema Tests

### 11.1 Comment Validation (REQ-035)

**File:** `src/lib/validations/__tests__/comment.test.ts`

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | accepts valid comment input | None | Parse `{ issueId: 'cuid', body: { type: 'doc', content: [...] } }` | Success | REQ-035 |
| 2 | requires issueId | None | Parse without issueId | ZodError | REQ-035 |
| 3 | accepts any body (Tiptap JSON) | None | Parse with complex body object | Success (z.any()) | REQ-035 |
| 4 | update comment requires id | None | Parse updateCommentSchema without id | ZodError | REQ-035 |
| 5 | delete comment requires id | None | Parse deleteCommentSchema without id | ZodError | REQ-035 |

### 11.2 Member Validation (REQ-007, REQ-012, REQ-013)

**File:** `src/lib/validations/__tests__/member.test.ts`

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | invite member rejects OWNER role | None | Parse inviteMemberSchema with role: 'OWNER' | ZodError (enum excludes OWNER) | REQ-007 |
| 2 | invite member accepts ADMIN, MEMBER, VIEWER | None | Parse each valid role | All succeed | REQ-007 |
| 3 | invite member rejects invalid email | None | Parse with email: 'bad' | ZodError | REQ-007 |
| 4 | change role rejects OWNER | None | Parse changeMemberRoleSchema with role: 'OWNER' | ZodError | REQ-012 |
| 5 | change role accepts ADMIN, MEMBER, VIEWER | None | Parse each role | All succeed | REQ-012 |
| 6 | remove member requires workspaceId and userId | None | Parse removeMemberSchema without fields | ZodError | REQ-013 |

### 11.3 Status Validation (REQ-031)

**File:** `src/lib/validations/__tests__/status.test.ts`

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | accepts valid status input | None | Parse createStatusSchema | Success | REQ-031 |
| 2 | rejects empty name | None | Parse with name: '' | ZodError | REQ-031 |
| 3 | rejects name longer than 50 chars | None | Parse with 51-char name | ZodError | REQ-031 |
| 4 | accepts all valid status categories | None | Parse each of BACKLOG, TODO, IN_PROGRESS, DONE, CANCELLED | All succeed | REQ-031 |
| 5 | rejects invalid category | None | Parse with category: 'REVIEW' | ZodError | REQ-031 |
| 6 | reorder requires at least one statusId | None | Parse reorderStatusesSchema with empty array | ZodError | REQ-031 |
| 7 | delete status requires migrateToStatusId | None | Parse deleteStatusSchema without migrateToStatusId | ZodError | REQ-031 |

### 11.4 Issue Filter Validation (REQ-044, REQ-048)

**File:** `src/lib/validations/__tests__/issue-filter.test.ts`

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | accepts valid filter with all fields | None | Parse issueFilterSchema with all fields | Success | REQ-044 |
| 2 | accepts empty filter (all optional) | None | Parse `{}` | Success | REQ-044 |
| 3 | accepts array of status IDs | None | Parse with status: ['status-1', 'status-2'] | Success | REQ-044 |
| 4 | accepts array of priorities | None | Parse with priority: ['HIGH', 'URGENT'] | Success | REQ-044 |
| 5 | rejects invalid priority in array | None | Parse with priority: ['INVALID'] | ZodError | REQ-044 |
| 6 | accepts array of issue types | None | Parse with type: ['BUG', 'TASK'] | Success | REQ-044 |
| 7 | rejects invalid type in array | None | Parse with type: ['FEATURE'] | ZodError | REQ-044 |

### 11.5 Bulk Update Validation (contracts)

**File:** `src/lib/validations/__tests__/issue.test.ts` (continued)

| # | Test Name | Setup | Action | Expected | REQ |
|---|-----------|-------|--------|----------|-----|
| 1 | accepts valid bulk update input | None | Parse bulkUpdateIssuesSchema | Success | Contracts |
| 2 | requires at least one issue ID | None | Parse with issueIds: [] | ZodError: "Select at least one issue" | Contracts |
| 3 | all update fields are optional | None | Parse with only issueIds | Success | Contracts |

---

## Summary Statistics

| Module | Test Cases | REQs Covered |
|--------|-----------|--------------|
| Auth (validation + actions + middleware) | 48 | REQ-001 through REQ-008 |
| Workspace (validation + actions + components) | 42 | REQ-009 through REQ-016 |
| Project (validation + actions + components) | 33 | REQ-017 through REQ-024 |
| Issue (validation + actions + utils) | 67 | REQ-025 through REQ-038 |
| Board View (components + DnD + filters) | 35 | REQ-039 through REQ-045 |
| List View (components + sorting + filtering) | 22 | REQ-046 through REQ-049 |
| Search (API + validation + components) | 27 | REQ-050 through REQ-053 |
| Labels (validation + actions) | 20 | REQ-032 |
| Cross-Cutting (empty/loading/error/toast/breadcrumb/theme) | 21 | REQ-054 through REQ-060 |
| Validation schemas (comment/member/status/filter/bulk) | 22 | Cross-module |
| **TOTAL** | **337** | **REQ-001 -- REQ-060** |

---

## Discrepancies & Notes for Builders

1. **Slug min length:** Zod schema in contracts uses `min(2)` but spec REQ-015 says "3-48 characters." Tests are written against the spec (3 min). Builders should update the Zod schema.

2. **Slug advanced validation:** The Zod regex `^[a-z0-9-]+$` does not enforce "starts with letter," "no ending hyphen," or "no consecutive hyphens." Builders need a `.refine()` or custom regex like `^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$`.

3. **Reserved slug list:** Not in the Zod schema but specified in REQ-015. Builders need to add a `.refine()` check against the reserved list.

4. **Tiptap z.any():** The Revision document flags this as CRITICAL. Builders should replace `z.any()` with a proper Tiptap JSON schema (at least `z.object({ type: z.literal('doc'), content: z.array(z.unknown()) })`) and sanitize on render with DOMPurify.

5. **Password complexity:** The Revision document recommends "uppercase + number + special char." The current Zod schema only checks min(8). Builders should add a `.regex()` or `.refine()` for complexity.

6. **Workspace isolation:** Per Revision, every DB query MUST include `workspaceId` filter. Tests for server actions verify this.

7. **Soft-delete exclusion:** Per Revision, all default queries should include `deletedAt: null`. Tests verify this pattern.

8. **Invite token:** Per Revision, tokens should use `crypto.randomUUID()` with 48h expiry and be single-use. The contracts show 7-day expiry (spec REQ-007). Builders should reconcile -- tests follow the spec (7-day) but note the revision recommendation.

9. **updateWorkspaceSchema includes slug:** The contracts show slug as an optional field in updateWorkspaceSchema, but Revision says slugs should be immutable. Tests flag this discrepancy.

---

*End of Unit Test Specifications. Total: 337 test cases across all modules covering REQ-001 through REQ-060.*
