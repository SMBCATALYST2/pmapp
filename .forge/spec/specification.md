# MVP Feature Specification: PMApp (JIRA-like Project Management)

**Project:** /home/vidit/projects/pmapp
**Stack:** Next.js 15 + TypeScript + PostgreSQL + Prisma + Tailwind CSS v4 + shadcn/ui + NextAuth.js (Auth.js v5)
**Author:** SpecWriter (Forge Pipeline)
**Date:** 2026-03-26
**Phase:** MVP (Phase 1)

---

## Table of Contents

1. [Auth Module (REQ-001 -- REQ-008)](#1-auth-module)
2. [Workspace Module (REQ-009 -- REQ-016)](#2-workspace-module)
3. [Project Module (REQ-017 -- REQ-024)](#3-project-module)
4. [Issue Module (REQ-025 -- REQ-038)](#4-issue-module)
5. [Board View Module (REQ-039 -- REQ-045)](#5-board-view-module)
6. [List View Module (REQ-046 -- REQ-049)](#6-list-view-module)
7. [Search Module (REQ-050 -- REQ-053)](#7-search-module)
8. [Cross-Cutting: Empty States, Loading, Error, Responsive (REQ-054 -- REQ-060)](#8-cross-cutting-concerns)
9. [Data Validation Rules](#9-data-validation-rules)
10. [Authorization Matrix](#10-authorization-matrix)

---

## 1. Auth Module

### REQ-001: Email/Password Sign-Up

| Field | Value |
|-------|-------|
| **ID** | REQ-001 |
| **Module** | Auth |
| **Priority** | MUST (MVP) |
| **Description** | Users can create an account using an email address and password. On successful sign-up, a default workspace is automatically created and the user is redirected into it. |
| **Acceptance Criteria** | 1. Form accepts name, email, and password fields. 2. On submit, a new User record is created with bcrypt-hashed password. 3. A default Workspace is created with the user as OWNER. 4. A WorkspaceMember record is created linking the user to the workspace with OWNER role. 5. User is signed in automatically and redirected to `/[workspace-slug]/projects`. 6. Duplicate email returns an inline error "An account with this email already exists." |
| **UI Behavior** | Centered card layout at `/sign-up`. Fields: Name (text), Email (email), Password (password with show/hide toggle). Submit button "Create account". Link to sign-in page below. OAuth buttons (Google, GitHub) above or below the form with a divider "or continue with." |
| **Error Cases** | 1. Duplicate email: inline error under email field. 2. Weak password (< 8 chars): inline validation error. 3. Empty required fields: inline validation errors per field. 4. Network error: toast notification "Something went wrong. Please try again." 5. Server error (500): generic error toast, form remains filled. |

---

### REQ-002: OAuth Sign-Up / Sign-In (Google, GitHub)

| Field | Value |
|-------|-------|
| **ID** | REQ-002 |
| **Module** | Auth |
| **Priority** | MUST (MVP) |
| **Description** | Users can sign up or sign in using Google or GitHub OAuth via NextAuth.js. If no account exists for the OAuth email, a new User is created. If the user has no workspaces, they are redirected to the workspace creation flow. |
| **Acceptance Criteria** | 1. "Continue with Google" and "Continue with GitHub" buttons on both sign-in and sign-up pages. 2. Clicking initiates OAuth flow via NextAuth.js. 3. On first OAuth login, a User record is created (password field is null). 4. An Account record is created linking the OAuth provider. 5. If user has zero workspaces, redirect to `/create-workspace`. 6. If user has workspaces, redirect to the most recently accessed workspace. |
| **UI Behavior** | Branded OAuth buttons with provider logos. During OAuth redirect, show a loading spinner or "Redirecting..." state. On return from OAuth provider, show brief "Signing you in..." loading state. |
| **Error Cases** | 1. OAuth provider error (user denied access): redirect to sign-in with query param `?error=OAuthCallback`, show toast "Sign-in was cancelled." 2. OAuth email already linked to a different provider: show error "This email is already registered with a different sign-in method." 3. OAuth provider down: show toast "Could not reach [Provider]. Try again or use email/password." |

---

### REQ-003: Sign In (Email/Password)

| Field | Value |
|-------|-------|
| **ID** | REQ-003 |
| **Module** | Auth |
| **Priority** | MUST (MVP) |
| **Description** | Users can sign in with their email and password. On success, a JWT session is established and the user is redirected to their workspace. |
| **Acceptance Criteria** | 1. Form accepts email and password. 2. Credentials are validated server-side (bcrypt compare). 3. On success, JWT session cookie is set. 4. User is redirected to their last workspace (or first workspace if no history). 5. Invalid credentials show "Invalid email or password." error. 6. Form retains email on failed attempt (password cleared). |
| **UI Behavior** | Centered card layout at `/sign-in`. Fields: Email, Password (with show/hide toggle). Submit button "Sign in". Links: "Forgot password?" and "Don't have an account? Sign up." OAuth buttons present. |
| **Error Cases** | 1. Invalid credentials: inline error "Invalid email or password." (do not reveal which field is wrong). 2. Account exists but was created via OAuth (no password): show "This account uses Google/GitHub sign-in. Please use the appropriate button." 3. Empty fields: inline validation errors. 4. Network/server error: toast notification. |

---

### REQ-004: Sign Out

| Field | Value |
|-------|-------|
| **ID** | REQ-004 |
| **Module** | Auth |
| **Priority** | MUST (MVP) |
| **Description** | Users can sign out from any authenticated page. The session is destroyed and the user is redirected to the sign-in page. |
| **Acceptance Criteria** | 1. Sign out option available in the user avatar dropdown menu in the header. 2. On click, NextAuth.js `signOut()` is called. 3. JWT session cookie is cleared. 4. User is redirected to `/sign-in`. 5. Accessing any authenticated route after sign-out redirects to `/sign-in`. |
| **UI Behavior** | User avatar in top-right header. Click reveals dropdown with: user name, email, theme toggle, "Sign out" at bottom. No confirmation dialog needed for sign out. |
| **Error Cases** | 1. Sign out during pending mutations: mutations may fail silently; no data loss since they are server-side. 2. Network error during sign out: clear local session anyway and redirect. |

---

### REQ-005: Session Management & Route Protection

| Field | Value |
|-------|-------|
| **ID** | REQ-005 |
| **Module** | Auth |
| **Priority** | MUST (MVP) |
| **Description** | All routes under `(dashboard)` are protected by middleware. Unauthenticated users are redirected to `/sign-in`. Session is JWT-based and verified on every request. |
| **Acceptance Criteria** | 1. Next.js middleware intercepts all requests. 2. Public routes (`/sign-in`, `/sign-up`, `/forgot-password`, `/invite/[token]`, `/api/auth/*`) bypass auth check. 3. Requests without a valid JWT are redirected to `/sign-in?callbackUrl=[original-url]`. 4. After sign-in, user is redirected to the `callbackUrl` if present. 5. Every Server Action independently calls `auth()` to verify the session (defense in depth). 6. JWT includes `user.id` via callback enrichment. |
| **UI Behavior** | No visible UI for middleware. Unauthenticated access to protected routes shows a brief redirect (no flash of protected content). |
| **Error Cases** | 1. Expired JWT: redirect to sign-in with callbackUrl preserved. 2. Tampered JWT: reject and redirect to sign-in. 3. Server Action called with invalid session: return 401 error, client shows "Session expired. Please sign in again." toast. |

---

### REQ-006: Password Reset (Forgot Password)

| Field | Value |
|-------|-------|
| **ID** | REQ-006 |
| **Module** | Auth |
| **Priority** | MUST (MVP) |
| **Description** | Users who forget their password can request a reset link sent to their email. The link leads to a form where they set a new password. |
| **Acceptance Criteria** | 1. "Forgot password?" link on sign-in page navigates to `/forgot-password`. 2. User enters their email and submits. 3. If email exists, a VerificationToken is created (expires in 1 hour). 4. An email with a reset link is sent (or logged to console in dev). 5. Success message shown regardless of whether email exists (prevent enumeration). 6. Reset link navigates to `/reset-password?token=[token]`. 7. User enters and confirms new password. 8. Password is updated (bcrypt hashed), token is consumed. 9. User is redirected to sign-in with success toast. |
| **UI Behavior** | `/forgot-password`: centered card with email input and "Send reset link" button. Success state: "If an account exists for that email, we've sent a password reset link." `/reset-password`: centered card with new password + confirm password fields. |
| **Error Cases** | 1. Non-existent email: still show generic success (no enumeration). 2. Expired token: show "This reset link has expired. Request a new one." with link. 3. Already-used token: show "This link has already been used." 4. Password mismatch: inline error "Passwords do not match." 5. OAuth-only account: still show generic success (they never set a password, so the link would be a no-op or prompt them to set one). |

---

### REQ-007: Invite Member via Email

| Field | Value |
|-------|-------|
| **ID** | REQ-007 |
| **Module** | Auth |
| **Priority** | MUST (MVP) |
| **Description** | Workspace Owners and Admins can invite new members by email. An invitation record is created and a link is generated. The invited person can accept the invite to join the workspace. |
| **Acceptance Criteria** | 1. Invite form on `/[workspace]/settings/members` page. 2. Owner/Admin enters an email and selects a role (Member or Viewer; cannot invite as Owner). 3. A WorkspaceInvitation record is created with a unique token and 7-day expiry. 4. An email with the invite link is sent (or logged to console in dev). 5. The invite link format is `/invite/[token]`. 6. Pending invitations are listed on the members page with status, email, role, and expiry. 7. Owner/Admin can revoke pending invitations. 8. Cannot invite an email that is already a workspace member (inline error). 9. Cannot invite an email with an active pending invitation (inline error suggesting to resend). |
| **UI Behavior** | "Invite member" button opens a dialog with email input and role select dropdown. Pending invitations appear in a separate "Pending Invitations" table below the members list. Each row shows email, invited role, invited by, expiry date, and a "Revoke" action. |
| **Error Cases** | 1. Email already a member: "This person is already a member of this workspace." 2. Active pending invite: "An invitation has already been sent to this email. Revoke it to send a new one." 3. Invalid email format: inline validation error. 4. Non-Owner/Admin attempts invite: Server Action returns 403; UI hides the invite button for unauthorized roles. 5. Email delivery failure: invitation still created, token still works (user can share link manually). |

---

### REQ-008: Accept Workspace Invite

| Field | Value |
|-------|-------|
| **ID** | REQ-008 |
| **Module** | Auth |
| **Priority** | MUST (MVP) |
| **Description** | A user who receives a workspace invite link can accept it to join the workspace. If they are not signed in, they are prompted to sign in or sign up first. |
| **Acceptance Criteria** | 1. `/invite/[token]` page validates the token. 2. If token is invalid/expired/revoked, show an error state with appropriate message. 3. If user is not authenticated, show sign-in/sign-up options with the invite context preserved. 4. If user is authenticated and email matches the invite, a WorkspaceMember record is created with the invited role. 5. Invitation status is updated to ACCEPTED. 6. User is redirected to the workspace home `/{workspace-slug}/projects`. 7. If user's email does not match the invite email: still allow acceptance (invitations are transferable by link). 8. If user is already a member of the workspace, show "You're already a member of this workspace" and redirect. |
| **UI Behavior** | Centered card showing workspace name, who invited them, and the role. "Accept invite" button. If not signed in, show sign-in/sign-up buttons with a note "Sign in to accept this invitation to [Workspace Name]." |
| **Error Cases** | 1. Invalid token: "This invitation link is invalid." 2. Expired token: "This invitation has expired. Ask the workspace admin to send a new one." 3. Revoked token: "This invitation has been revoked." 4. Already a member: redirect to workspace with toast "You're already a member." 5. Network error: toast notification. |

---

## 2. Workspace Module

### REQ-009: Create Workspace

| Field | Value |
|-------|-------|
| **ID** | REQ-009 |
| **Module** | Workspace |
| **Priority** | MUST (MVP) |
| **Description** | Users can create a new workspace. A workspace is the top-level organizational boundary. The creator becomes the workspace Owner. A workspace is auto-created during sign-up, or manually via the create-workspace page. |
| **Acceptance Criteria** | 1. Create workspace form at `/create-workspace` (post-signup) or via workspace switcher. 2. Fields: name (required), slug (auto-generated from name, editable), description (optional). 3. Slug is auto-derived from name (lowercased, spaces to hyphens, special chars removed). 4. On submit: Workspace created, WorkspaceMember created with OWNER role. 5. Redirect to `/{workspace-slug}/projects`. 6. Slug must be globally unique (real-time validation with debounce). |
| **UI Behavior** | Post-signup flow: full-page form with "Create your workspace" heading. Workspace switcher: "Create workspace" option at the bottom of the dropdown opens a dialog. Name input auto-updates slug preview below it. User can manually edit slug. |
| **Error Cases** | 1. Slug already taken: inline error "This URL is already taken. Try another." with suggestions. 2. Name empty: inline validation "Workspace name is required." 3. Slug invalid chars: inline error "URL can only contain lowercase letters, numbers, and hyphens." 4. Network error: toast, form state preserved. |

---

### REQ-010: Edit Workspace Settings

| Field | Value |
|-------|-------|
| **ID** | REQ-010 |
| **Module** | Workspace |
| **Priority** | MUST (MVP) |
| **Description** | Workspace Owners and Admins can edit workspace name, description, and image on the settings page. Slug is not editable after creation (to prevent link breakage). |
| **Acceptance Criteria** | 1. Settings page at `/{workspace-slug}/settings`. 2. Editable fields: name, description. 3. Slug shown as read-only (displayed as the workspace URL). 4. Save button triggers server action to update. 5. Success: toast "Workspace settings updated." 6. Only OWNER and ADMIN roles can access this page; MEMBER and VIEWER see 403 or are redirected. |
| **UI Behavior** | Settings page with a form card. Current values pre-filled. Save button at bottom. "General" tab active (future tabs: Billing, Danger Zone). Sidebar navigation shows "Settings" item highlighted. |
| **Error Cases** | 1. Empty name: inline validation. 2. Unauthorized role: redirect to workspace home with toast "You don't have permission to access workspace settings." 3. Workspace not found: 404 page. 4. Concurrent edit: last-write-wins (workspace settings are low-contention). |

---

### REQ-011: Workspace Member List

| Field | Value |
|-------|-------|
| **ID** | REQ-011 |
| **Module** | Workspace |
| **Priority** | MUST (MVP) |
| **Description** | All workspace members can view the list of members. Owners and Admins can manage roles and remove members. |
| **Acceptance Criteria** | 1. Members page at `/{workspace-slug}/settings/members`. 2. Table shows: avatar, name, email, role, joined date. 3. Owners and Admins see a role dropdown and "Remove" action per member. 4. Cannot change the Owner's role (Owner is fixed; transfer ownership is Phase 2). 5. Cannot remove yourself if you are the sole Owner. 6. Removing a member: confirmation dialog, then unassigns them from all issues, removes WorkspaceMember record. 7. All roles can view the members list (read-only for MEMBER and VIEWER). |
| **UI Behavior** | Table with member rows. Role displayed as a badge for MEMBER/VIEWER, as a dropdown select for Owners/Admins editing other members. "Invite member" button (visible to OWNER/ADMIN only) at the top. Pending invitations section below. |
| **Error Cases** | 1. Remove sole Owner: disabled button with tooltip "Cannot remove the only Owner." 2. Change role of Owner: not permitted; dropdown not shown for Owner row. 3. Member already removed (stale UI): 404 on action, refresh member list. 4. Removing member who has assigned issues: confirmation dialog warns "This member is assigned to X issues. They will be unassigned." |

---

### REQ-012: Change Member Role

| Field | Value |
|-------|-------|
| **ID** | REQ-012 |
| **Module** | Workspace |
| **Priority** | SHOULD (MVP) |
| **Description** | Workspace Owners and Admins can change a member's role. Role hierarchy: Owner > Admin > Member > Viewer. |
| **Acceptance Criteria** | 1. Role dropdown on the members table row (Owner/Admin UI only). 2. Roles available: Admin, Member, Viewer (cannot assign Owner via dropdown). 3. Owner can change any member's role. Admin can change Member/Viewer roles but cannot promote to Admin or demote another Admin. 4. On change, WorkspaceMember role is updated server-side. 5. Toast: "Role updated for [Name]." 6. Changing a member to Viewer removes their ability to create/edit issues (enforced server-side). |
| **UI Behavior** | Select dropdown in the role column. Change is applied immediately on selection (no separate save button). Optimistic UI update with rollback on error. |
| **Error Cases** | 1. Admin tries to change another Admin's role: dropdown disabled for Admin rows when the current user is Admin (not Owner). 2. Change own role: not permitted, dropdown disabled for own row. 3. Concurrent role change: last-write-wins with toast. |

---

### REQ-013: Remove Member from Workspace

| Field | Value |
|-------|-------|
| **ID** | REQ-013 |
| **Module** | Workspace |
| **Priority** | SHOULD (MVP) |
| **Description** | Workspace Owners and Admins can remove a member from the workspace. Removal unassigns them from all issues in the workspace. |
| **Acceptance Criteria** | 1. "Remove" button on each member row (visible to Owner/Admin). 2. Confirmation dialog: "Remove [Name] from [Workspace]? They will be unassigned from all issues." 3. On confirm: WorkspaceMember record is deleted. 4. All issues assigned to this member have `assigneeId` set to null. 5. Activity log entries created for each unassignment. 6. The removed user can no longer access the workspace. 7. Toast: "[Name] has been removed from the workspace." |
| **UI Behavior** | Red "Remove" button or icon. Confirmation dialog with destructive button style. Row disappears from table after removal. |
| **Error Cases** | 1. Attempt to remove Owner: button disabled or hidden. 2. Remove self (non-Owner): allowed with confirmation "You will lose access to this workspace." 3. Admin tries to remove another Admin: not permitted (only Owner can). 4. Member already removed (stale): action returns 404, list is refreshed. |

---

### REQ-014: Switch Between Workspaces

| Field | Value |
|-------|-------|
| **ID** | REQ-014 |
| **Module** | Workspace |
| **Priority** | MUST (MVP) |
| **Description** | Users who belong to multiple workspaces can switch between them using the workspace switcher in the sidebar. |
| **Acceptance Criteria** | 1. Workspace switcher at the top of the sidebar. 2. Shows current workspace name/icon. 3. Click opens a dropdown listing all workspaces the user is a member of. 4. Selecting a workspace navigates to `/{workspace-slug}/projects`. 5. "Create workspace" option at the bottom of the dropdown. 6. Current workspace is highlighted in the list. |
| **UI Behavior** | Dropdown component with workspace name, initial/avatar. Workspaces listed alphabetically. Smooth transition between workspaces (full page navigation to new workspace route). |
| **Error Cases** | 1. User removed from workspace while viewing it: next navigation returns 403, redirect to another workspace or `/create-workspace` if none remain. 2. Workspace deleted: same handling as above. |

---

### REQ-015: Workspace Slug Validation

| Field | Value |
|-------|-------|
| **ID** | REQ-015 |
| **Module** | Workspace |
| **Priority** | MUST (MVP) |
| **Description** | Workspace slugs must be globally unique, URL-safe, and follow strict format rules. Validation occurs both client-side (real-time) and server-side. |
| **Acceptance Criteria** | 1. Slug format: 3-48 characters, lowercase letters, numbers, and hyphens only. 2. Must start with a letter. Must not end with a hyphen. 3. No consecutive hyphens. 4. Unique across all workspaces (checked server-side). 5. Real-time uniqueness check with 300ms debounce as user types. 6. Reserved slugs blocked: `admin`, `api`, `auth`, `settings`, `create-workspace`, `invite`, `sign-in`, `sign-up`, `app`, `dashboard`, `help`, `support`, `billing`, `pricing`, `docs`, `blog`. |
| **UI Behavior** | Slug field shows a checkmark icon when valid and available, or an X icon with error text when invalid/taken. URL preview: "pmapp.com/[slug]" shown below the input. |
| **Error Cases** | 1. Taken slug: "This URL is already taken." 2. Invalid format: specific message (e.g., "Must start with a letter", "Only lowercase letters, numbers, and hyphens allowed"). 3. Reserved slug: "This URL is reserved." 4. Debounce check fails (network): show "Could not verify availability" with a retry option. |

---

### REQ-016: Post-Signup Onboarding Redirect

| Field | Value |
|-------|-------|
| **ID** | REQ-016 |
| **Module** | Workspace |
| **Priority** | MUST (MVP) |
| **Description** | After signing up (or signing in for the first time via OAuth), if the user has no workspaces, they are redirected to the workspace creation flow. Users who have workspaces are redirected to their most recent workspace. |
| **Acceptance Criteria** | 1. After authentication, the app checks `WorkspaceMember` count for the user. 2. If count === 0: redirect to `/create-workspace`. 3. If count >= 1: redirect to the most recently accessed workspace (or the first workspace alphabetically if no access history). 4. Root route `/` performs this same check and redirects accordingly. 5. Workspace home `/{workspace-slug}` redirects to `/{workspace-slug}/projects`. |
| **UI Behavior** | Brief loading state during redirect check. No flicker of wrong content. |
| **Error Cases** | 1. All workspaces deleted while user was signed in: redirect to `/create-workspace`. 2. Stale session pointing to a workspace user was removed from: redirect to the next available workspace or `/create-workspace`. |

---

## 3. Project Module

### REQ-017: Create Project

| Field | Value |
|-------|-------|
| **ID** | REQ-017 |
| **Module** | Project |
| **Priority** | MUST (MVP) |
| **Description** | Workspace Owners, Admins, and Members (with appropriate permissions) can create a new project within a workspace. A project has a unique key prefix used for issue numbering. |
| **Acceptance Criteria** | 1. Create project page at `/{workspace-slug}/projects/new` (or dialog). 2. Fields: name (required), key/prefix (auto-generated from name, editable, required), description (optional), icon (emoji picker, optional), color (color picker, optional). 3. Key is auto-derived: first 2-4 uppercase letters of the name (e.g., "Project Alpha" -> "PA"). 4. On create: Project record created with `issueCounter = 0`. 5. Default WorkflowStatus records are seeded: Backlog, Todo, In Progress, In Review, Done, Cancelled. 6. Redirect to `/{workspace-slug}/{project-key}/board`. 7. Only OWNER and ADMIN can create projects. |
| **UI Behavior** | Form page or dialog. Name input auto-updates key preview. User can manually edit key (uppercase only, 2-10 chars). Emoji picker button next to name. Color picker (predefined palette of 12-16 colors). Preview of how the project will appear in the sidebar. |
| **Error Cases** | 1. Key already exists in workspace: inline error "This project key is already in use." 2. Name empty: inline validation. 3. Key invalid format: "Key must be 2-10 uppercase letters." 4. Unauthorized: 403 response, redirect with toast. 5. Network error: toast, form state preserved. |

---

### REQ-018: Edit Project Settings

| Field | Value |
|-------|-------|
| **ID** | REQ-018 |
| **Module** | Project |
| **Priority** | MUST (MVP) |
| **Description** | Authorized users can edit project name, description, icon, and color. The project key is not editable after creation (since it is embedded in all issue keys). |
| **Acceptance Criteria** | 1. Settings page at `/{workspace-slug}/{project-key}/settings`. 2. Editable fields: name, description, icon (emoji), color. 3. Key shown read-only with explanation: "Project key cannot be changed because it is used in issue identifiers." 4. Lead field: dropdown to select a workspace member as project lead (optional). 5. Default assignee: dropdown to select a workspace member (optional, auto-assigned to new issues). 6. Save triggers server action. Toast: "Project settings updated." 7. Only OWNER, ADMIN, or the project lead can edit project settings. |
| **UI Behavior** | Settings form in a card layout. Sub-navigation tabs (if applicable): General, Statuses (future), Labels (managed at workspace level). |
| **Error Cases** | 1. Empty name: inline validation. 2. Lead is not a workspace member: server validation error. 3. Unauthorized: 403. 4. Project not found or deleted: 404 page. |

---

### REQ-019: Project Key Validation

| Field | Value |
|-------|-------|
| **ID** | REQ-019 |
| **Module** | Project |
| **Priority** | MUST (MVP) |
| **Description** | Project keys must be unique within a workspace, follow strict format rules, and cannot be changed after creation. |
| **Acceptance Criteria** | 1. Format: 2-10 uppercase English letters only (`A-Z`). No numbers, spaces, or special characters. 2. Unique within the workspace (case-insensitive, stored as uppercase). 3. Real-time uniqueness check with 300ms debounce during creation. 4. Server-side uniqueness enforced by database unique constraint `@@unique([workspaceId, prefix])`. 5. Auto-generation algorithm: take first letters of each word in project name, up to 4 chars (e.g., "Mobile App" -> "MA", "Backend Services" -> "BS"). If auto-generated key conflicts, append next letter (e.g., "MA" -> "MAA"). |
| **UI Behavior** | Key input field shows uppercase transform. Green checkmark when valid and available. Red X with error when invalid or taken. Auto-generated value updates as user types the project name. |
| **Error Cases** | 1. Key taken: "This key is already used by another project." 2. Invalid format: "Must be 2-10 uppercase letters (A-Z only)." 3. Single character: "Key must be at least 2 characters." |

---

### REQ-020: List Projects in Workspace

| Field | Value |
|-------|-------|
| **ID** | REQ-020 |
| **Module** | Project |
| **Priority** | MUST (MVP) |
| **Description** | Users can view all projects in a workspace on the projects page and in the sidebar. Projects are listed with their icon, name, key, and star status. |
| **Acceptance Criteria** | 1. Projects page at `/{workspace-slug}/projects` shows a card grid or list of all projects. 2. Each project card shows: icon (emoji), name, key, description (truncated), issue count, lead avatar. 3. Sidebar shows projects in two groups: "Starred" (user's favorites) at top, then "All Projects" below. 4. Projects sorted alphabetically within each group. 5. Sidebar project items are clickable, navigating to `/{workspace-slug}/{project-key}/board`. 6. All workspace members can view the project list. |
| **UI Behavior** | Projects page: grid of cards (3-4 per row on desktop, 2 on tablet). Each card is clickable. "New project" button at top-right (visible to OWNER/ADMIN). Sidebar: compact list with project icon, name, and star icon. |
| **Error Cases** | 1. No projects: empty state (see REQ-054). 2. Workspace not found: 404. 3. User not a member: 403 redirect. |

---

### REQ-021: Star / Favorite Project

| Field | Value |
|-------|-------|
| **ID** | REQ-021 |
| **Module** | Project |
| **Priority** | SHOULD (MVP) |
| **Description** | Users can star/favorite projects for quick access. Starred projects appear at the top of the sidebar. This is a per-user preference. |
| **Acceptance Criteria** | 1. Star icon on each project (sidebar and project list page). 2. Clicking toggles the star state. 3. Star state is stored as a `ProjectFavorite` record (userId, projectId). 4. Starred projects appear in the "Starred" section of the sidebar, above "All Projects." 5. If no starred projects, the "Starred" section is hidden. 6. Optimistic UI: star toggles immediately, server sync in background. |
| **UI Behavior** | Outline star icon (unstarred) / filled yellow star icon (starred). Hover shows tooltip "Star this project" / "Unstar." Sidebar updates immediately. |
| **Error Cases** | 1. Star a project the user no longer has access to: 403 on server action, revert optimistic update. 2. Network error: revert star state, show toast. |

---

### REQ-022: Project Icon (Emoji Picker)

| Field | Value |
|-------|-------|
| **ID** | REQ-022 |
| **Module** | Project |
| **Priority** | SHOULD (MVP) |
| **Description** | Users can set an emoji icon for a project. The icon is displayed in the sidebar, project list, and breadcrumbs. |
| **Acceptance Criteria** | 1. Emoji picker component on project creation and settings forms. 2. Default icon if none selected: first letter of project name in a colored circle. 3. Emoji stored as a string in the `icon` field (e.g., "rocket" or the Unicode character). 4. Displayed consistently across sidebar, project cards, page headers, breadcrumbs. |
| **UI Behavior** | Button showing current emoji (or default letter). Click opens a popover with an emoji grid. Search field to filter emojis. Click to select, popover closes. |
| **Error Cases** | 1. Invalid emoji value: server validates it is a valid emoji string; reject with error. 2. Missing emoji: fall back to letter-based default. |

---

### REQ-023: Project Color Selection

| Field | Value |
|-------|-------|
| **ID** | REQ-023 |
| **Module** | Project |
| **Priority** | SHOULD (MVP) |
| **Description** | Users can select a color for a project. The color is used for the project's icon background and visual accents. |
| **Acceptance Criteria** | 1. Color picker on project creation and settings forms. 2. Predefined palette of 12-16 colors (no custom hex input in MVP). 3. Color stored as hex string (e.g., `#3B82F6`). 4. Default color assigned if none selected (first from palette). 5. Color displayed in sidebar project icon background and project card accent. |
| **UI Behavior** | Grid of color circles. Selected color has a checkmark overlay. Click to select. |
| **Error Cases** | 1. Invalid hex: server validates format; reject. 2. Null color: use default. |

---

### REQ-024: Project Sub-Navigation

| Field | Value |
|-------|-------|
| **ID** | REQ-024 |
| **Module** | Project |
| **Priority** | MUST (MVP) |
| **Description** | Within a project, a sub-navigation bar allows switching between Board, List, and Settings views. |
| **Acceptance Criteria** | 1. Sub-navigation shown below the project header on all project pages. 2. Tabs/links: Board, List, Settings. 3. Active tab is visually highlighted. 4. Board tab navigates to `/{workspace-slug}/{project-key}/board`. 5. List tab navigates to `/{workspace-slug}/{project-key}/list`. 6. Settings tab navigates to `/{workspace-slug}/{project-key}/settings`. 7. Default project route (`/{workspace-slug}/{project-key}`) redirects to Board view. |
| **UI Behavior** | Horizontal tab bar or pill-style navigation. Current view underlined or filled. Smooth transitions between views (no full page reload, leverages Next.js client-side navigation). |
| **Error Cases** | 1. Invalid project key in URL: 404 page. 2. User lacks access to project (workspace member but project is archived): appropriate error state. |

---

## 4. Issue Module

### REQ-025: Create Issue

| Field | Value |
|-------|-------|
| **ID** | REQ-025 |
| **Module** | Issue |
| **Priority** | MUST (MVP) |
| **Description** | Users can create a new issue within a project. An auto-generated issue key (e.g., PROJ-123) is assigned. The issue is created in a default status (Backlog or Todo). |
| **Acceptance Criteria** | 1. Create issue via: (a) "Create issue" button/dialog accessible from project pages, (b) quick-add form at the bottom of a board column. 2. Required field: title. 3. Optional fields: description (rich text), type (default: Task), priority (default: Medium), status (default: Backlog), assignee, labels, due date. 4. Issue key is auto-generated: `{PROJECT_PREFIX}-{issueCounter + 1}`. 5. `issueCounter` on the Project is atomically incremented in a Prisma `$transaction`. 6. `reporterId` is set to the current user. 7. `position` is set to the top of the target status column (lowest sort position). 8. Activity log entry created: "issue created." 9. On success: dialog closes, board/list refreshes. Toast: "Issue [KEY] created." 10. Only OWNER, ADMIN, and MEMBER roles can create issues. |
| **UI Behavior** | Create issue dialog (modal): triggered by button in header or keyboard shortcut (C). Title field at top (large, focused on open). Type selector, status selector, priority selector, assignee picker, label multi-select, due date picker, description editor below. "Create issue" button at bottom. Quick-add on board: inline text input at the bottom of a column. Enter submits with just title; issue created in that column's status. |
| **Error Cases** | 1. Empty title: inline validation "Title is required." 2. Title > 255 chars: inline validation "Title must be under 255 characters." 3. Invalid assignee (not a workspace member): server returns 400. 4. Invalid status (not belonging to this project): server returns 400. 5. Concurrent issueCounter conflict: transaction retry (Prisma handles). 6. Unauthorized (Viewer role): 403, hide create button in UI. |

---

### REQ-026: Issue Key Generation

| Field | Value |
|-------|-------|
| **ID** | REQ-026 |
| **Module** | Issue |
| **Priority** | MUST (MVP) |
| **Description** | Each issue is assigned a unique, human-readable key in the format `{PROJECT_PREFIX}-{NUMBER}`. Numbers are monotonically increasing per project and never reused. |
| **Acceptance Criteria** | 1. Key format: `{prefix}-{number}`, e.g., `PROJ-1`, `PROJ-42`, `DEV-123`. 2. Number starts at 1 for the first issue in a project. 3. Number is derived from `Project.issueCounter` (incremented atomically). 4. Counter increment and issue creation happen in a single Prisma `$transaction` to prevent gaps or duplicates. 5. Keys are globally unique across the app (enforced by `@unique` on `Issue.key`). 6. Deleted issues do NOT free up their number (monotonic). 7. Key is immutable after creation. |
| **UI Behavior** | Issue key displayed as a clickable link/badge on board cards, list rows, issue detail header, search results, activity logs, and breadcrumbs. Clicking the key navigates to the issue detail page. |
| **Error Cases** | 1. Transaction conflict during concurrent creation: Prisma retries the transaction. 2. Orphaned counter (increment succeeded, issue creation failed): counter may skip a number; this is acceptable (keys need not be contiguous). |

---

### REQ-027: Issue Detail View

| Field | Value |
|-------|-------|
| **ID** | REQ-027 |
| **Module** | Issue |
| **Priority** | MUST (MVP) |
| **Description** | Users can view full details of an issue on a dedicated detail page. All fields are visible and (for authorized users) inline-editable. |
| **Acceptance Criteria** | 1. Issue detail page at `/{workspace-slug}/{project-key}/issues/{issue-key}`. 2. Header: issue key (e.g., "PROJ-123"), type icon, priority icon. 3. Title displayed large and inline-editable (click to edit, blur or Enter to save). 4. Sidebar panel: Status (dropdown), Assignee (avatar picker), Priority (dropdown), Labels (multi-select), Due date (date picker), Created date (read-only), Updated date (read-only). 5. Description section: rich text editor (Tiptap), shown in edit mode on click. 6. Bottom section: tabbed interface with "Comments" and "Activity" tabs. 7. All field changes trigger server actions and activity log entries. 8. Viewers can see all fields but cannot edit. |
| **UI Behavior** | Full-page layout: main content area (title, description, comments/activity) on the left (~65%), metadata sidebar on the right (~35%). Breadcrumb navigation: Workspace > Project > PROJ-123. Back button or breadcrumb to return to board/list. Loading skeleton on initial load. |
| **Error Cases** | 1. Issue not found: 404 page with "Issue not found" message and back link. 2. Issue was deleted: 404 with "This issue has been deleted." 3. Concurrent edit conflict: toast "This issue was updated by someone else. Reload to see changes." (optimistic locking via `updatedAt`). 4. Network error on inline edit: revert to previous value, show toast. |

---

### REQ-028: Inline Field Editing on Issue Detail

| Field | Value |
|-------|-------|
| **ID** | REQ-028 |
| **Module** | Issue |
| **Priority** | MUST (MVP) |
| **Description** | All issue metadata fields on the detail view are inline-editable. Changes are saved immediately via server actions and logged in the activity feed. |
| **Acceptance Criteria** | 1. Title: click to enter edit mode, blur or Enter to save, Escape to cancel. 2. Status: dropdown selector, change saves immediately. 3. Assignee: click to open member picker, selection saves immediately. Clear option for unassign. 4. Priority: dropdown selector, change saves immediately. 5. Labels: multi-select popover, add/remove saves immediately. 6. Due date: date picker, selection saves immediately. Clear option to remove. 7. Type: dropdown selector, change saves immediately. 8. Each change creates an Activity record with `{ field, oldValue, newValue }`. 9. Optimistic UI: field updates immediately, reverts on error. 10. Toast on success: "[Field] updated." (subtle, not for every change -- debounced or grouped). |
| **UI Behavior** | Each field in the sidebar shows its current value. Hover reveals a subtle edit affordance (pencil icon or underline). Click opens the appropriate picker/editor inline. Changes feel instant (optimistic). Activity tab updates in real-time to show the change. |
| **Error Cases** | 1. Optimistic locking conflict: toast with reload option. 2. Invalid value (e.g., assignee no longer in workspace): revert, show error toast. 3. Network error: revert, toast "Failed to update. Please try again." 4. Viewer role: fields are read-only, no edit affordance shown. |

---

### REQ-029: Issue Types

| Field | Value |
|-------|-------|
| **ID** | REQ-029 |
| **Module** | Issue |
| **Priority** | MUST (MVP) |
| **Description** | Issues have a type field that categorizes them. Types are system-defined (not user-customizable in MVP). |
| **Acceptance Criteria** | 1. Available types: Epic, Story, Task, Bug. 2. Default type for new issues: Task. 3. Each type has a distinct icon and color: Epic (purple lightning bolt), Story (green bookmark), Task (blue checkbox), Bug (red circle/bug). 4. Type is selectable on issue creation and changeable on issue detail. 5. Type is shown on board cards, list rows, and issue detail. |
| **UI Behavior** | Type selector: dropdown with icon + label for each type. Board card: small type icon in the top-left corner. List view: type icon column. |
| **Error Cases** | 1. Invalid type value: server rejects with 400. |

---

### REQ-030: Issue Priority Levels

| Field | Value |
|-------|-------|
| **ID** | REQ-030 |
| **Module** | Issue |
| **Priority** | MUST (MVP) |
| **Description** | Issues have a priority field. Priorities are system-defined with distinct visual indicators. |
| **Acceptance Criteria** | 1. Available priorities: Urgent (P0), High (P1), Medium (P2), Low (P3), None (P4). 2. Default priority for new issues: Medium (P2). 3. Visual indicators: Urgent (red double-up arrow), High (orange up arrow), Medium (yellow dash), Low (blue down arrow), None (gray dash). 4. Priority is selectable on issue creation and changeable on issue detail. 5. Priority is shown on board cards, list rows, and issue detail. |
| **UI Behavior** | Priority selector: dropdown with colored icon + label. Board card: small priority icon in the top-right area. Color-coded for quick scanning. |
| **Error Cases** | 1. Invalid priority value: server rejects with 400. |

---

### REQ-031: Issue Status Workflow

| Field | Value |
|-------|-------|
| **ID** | REQ-031 |
| **Module** | Issue |
| **Priority** | MUST (MVP) |
| **Description** | Issues have a status that represents their position in the workflow. Statuses are per-project and correspond to Kanban board columns. Default statuses are seeded on project creation. |
| **Acceptance Criteria** | 1. Default statuses seeded on project creation: Backlog, Todo, In Progress, In Review, Done, Cancelled. 2. Each status has: name, category (BACKLOG, TODO, IN_PROGRESS, DONE, CANCELLED), color (hex), position (sort order). 3. Status categories determine board behavior: DONE/CANCELLED issues are considered "closed." 4. Status is changeable via dropdown on issue detail or drag-and-drop on the board. 5. Any valid transition between statuses is allowed (no enforced workflow in MVP). 6. Status change creates an activity log entry with old and new status. |
| **UI Behavior** | Status selector: dropdown showing all project statuses with their color dots. Board columns ordered by status position. Status badge on issue card shows colored dot + text. |
| **Error Cases** | 1. Invalid status (not belonging to this project): server rejects with 400. 2. Status deleted while issues are in it: issues must be migrated first (Phase 2 concern; in MVP statuses are not deletable). |

---

### REQ-032: Issue Labels

| Field | Value |
|-------|-------|
| **ID** | REQ-032 |
| **Module** | Issue |
| **Priority** | MUST (MVP) |
| **Description** | Labels are workspace-scoped tags that can be assigned to issues for categorization. Users can create labels and assign multiple labels to an issue. |
| **Acceptance Criteria** | 1. Labels are scoped to the workspace (shared across all projects in the workspace). 2. Label fields: name (required), color (hex, required). 3. OWNER/ADMIN can create, edit, and delete labels. MEMBER can assign/remove labels on issues. 4. Multiple labels can be assigned to one issue (many-to-many). 5. Labels displayed as colored badges/tags on issue cards, list rows, and detail view. 6. Label creation: inline "Create label" option within the label picker (name + color). 7. Deleting a label removes it from all issues (server-side cascade). |
| **UI Behavior** | Label picker: multi-select popover with search. Shows existing labels as colored dots with names. "Create new label" option at the bottom with inline name + color inputs. Selected labels shown as chips/badges. |
| **Error Cases** | 1. Duplicate label name in workspace: "A label with this name already exists." 2. Empty label name: inline validation. 3. Delete label confirmation: "This label will be removed from all issues." 4. Invalid color: server validation. |

---

### REQ-033: Issue Due Date

| Field | Value |
|-------|-------|
| **ID** | REQ-033 |
| **Module** | Issue |
| **Priority** | MUST (MVP) |
| **Description** | Issues can have an optional due date. Overdue issues are visually highlighted. |
| **Acceptance Criteria** | 1. Due date is an optional field on issue creation and detail. 2. Date picker component (calendar popup). 3. Overdue logic: if `dueDate < today` and status category is not DONE/CANCELLED, show overdue indicator. 4. Due within 3 days: show "due soon" warning indicator. 5. Past dates allowed on set (user may be logging historical data). 6. Clear option to remove the due date. 7. Due date change creates activity log entry. |
| **UI Behavior** | Date picker: calendar popup (shadcn/ui Calendar). Display format: "Mar 26, 2026" (human-readable). Overdue: red text/badge "Overdue". Due soon (within 3 days): orange text/badge. Normal: gray text. Board card: small date text shown when set, red when overdue. |
| **Error Cases** | 1. Invalid date format: client-side calendar ensures valid selection. 2. Date in the past: allowed with no error (show overdue indicator). |

---

### REQ-034: Rich Text Description (Tiptap Editor)

| Field | Value |
|-------|-------|
| **ID** | REQ-034 |
| **Module** | Issue |
| **Priority** | MUST (MVP) |
| **Description** | Issue descriptions use a rich text editor powered by Tiptap (ProseMirror). The editor supports common formatting and Markdown shortcuts. |
| **Acceptance Criteria** | 1. Editor renders in the description section of the issue detail view. 2. Supported formatting: bold, italic, strikethrough, code (inline), code blocks, headings (H1-H3), bullet lists, numbered lists, task lists (checkboxes), links, horizontal rules, blockquotes. 3. Markdown shortcuts: `**bold**`, `_italic_`, `# heading`, `- list`, `1. numbered`, `[]` task list, `` `code` ``, `---` horizontal rule. 4. Description stored as Tiptap JSON in the `description` field. 5. Plain text extraction stored in `descriptionText` for search. 6. Auto-save with debounce (1-2 seconds after last keystroke) or explicit save button. 7. Empty description shows placeholder: "Add a description..." 8. Read-only mode for Viewers (renders rich text without editor chrome). |
| **UI Behavior** | Click on description area to enter edit mode. Toolbar appears with formatting buttons. Editor has a minimum height of ~150px, expands with content. On blur or after debounce, content saves silently. Activity log records "description edited" (not the full diff). |
| **Error Cases** | 1. Very large description (>50KB JSON): warn user, still save. 2. Network error on auto-save: show "Unsaved changes" indicator, retry on next save. 3. Concurrent edit: on save, check `updatedAt`; if conflict, show warning. 4. Tiptap fails to initialize: fall back to plain textarea. |

---

### REQ-035: Issue Comments

| Field | Value |
|-------|-------|
| **ID** | REQ-035 |
| **Module** | Issue |
| **Priority** | MUST (MVP) |
| **Description** | Users can add comments to issues. Comments support rich text formatting. All workspace members (including Viewers) can comment. |
| **Acceptance Criteria** | 1. Comments section on the issue detail page (in the Comments tab). 2. "Add a comment" input area at the bottom with a Tiptap editor instance. 3. Submit button to post the comment. 4. Each comment shows: author avatar, author name, timestamp (relative: "2 hours ago"), content (rich text rendered). 5. Comments ordered chronologically (oldest first). 6. Comment creation adds an activity log entry: "[User] added a comment." 7. Comment author can edit their own comment (pencil icon, inline edit). 8. Comment author or OWNER/ADMIN can delete a comment (trash icon, confirmation). 9. Edited comments show "(edited)" label next to the timestamp. 10. All roles (including VIEWER) can add comments. |
| **UI Behavior** | Comment list: vertical thread. Each comment is a card-like block. New comment input: Tiptap editor at the bottom with a "Comment" submit button. Edit mode: comment content becomes editable, "Save" / "Cancel" buttons appear. Delete: confirmation dialog "Delete this comment? This cannot be undone." |
| **Error Cases** | 1. Empty comment: "Comment cannot be empty." (disable submit button when empty). 2. Comment on deleted issue: 404 on submit, redirect. 3. Delete comment that has already been deleted: 404, refresh comment list. 4. Network error: toast "Failed to post comment. Please try again." with content preserved. |

---

### REQ-036: Issue Activity Log

| Field | Value |
|-------|-------|
| **ID** | REQ-036 |
| **Module** | Issue |
| **Priority** | MUST (MVP) |
| **Description** | Every change to an issue is recorded in an activity log. The activity log provides a chronological audit trail visible on the issue detail page. |
| **Acceptance Criteria** | 1. Activity tab on the issue detail page shows all changes. 2. Events tracked: issue created, status changed (from -> to), assignee changed (from -> to), priority changed (from -> to), type changed, label added, label removed, description edited, due date set/changed/removed, comment added, comment edited, comment deleted. 3. Each activity entry shows: actor (avatar + name), action description, timestamp (relative). 4. Activity entries stored in the `Activity` table with `metadata` JSON field: `{ field, oldValue, newValue }`. 5. Activities ordered chronologically (newest first or oldest first -- configurable). 6. Activity entries are append-only (never edited or deleted). |
| **UI Behavior** | Activity feed: vertical timeline with small icons per event type. Compact format: "[User avatar] [User] changed status from [old] to [new] -- 2 hours ago." Status/priority changes show colored badges for old and new values. "Description edited" without showing the full diff. |
| **Error Cases** | 1. Missing activity for a change: should not happen if all server actions correctly create activity records. If detected, it is a bug to investigate. 2. Very long activity history: paginate after 50 entries with "Load more" button. |

---

### REQ-037: Update Issue

| Field | Value |
|-------|-------|
| **ID** | REQ-037 |
| **Module** | Issue |
| **Priority** | MUST (MVP) |
| **Description** | Authorized users can update any field on an issue. Updates are validated, persisted, and logged. Optimistic locking prevents silent overwrites. |
| **Acceptance Criteria** | 1. Any combination of fields can be updated in a single server action call. 2. Server action: validates input (Zod), checks auth + role, checks `updatedAt` for optimistic locking, persists changes, creates activity log entries for each changed field, calls `revalidatePath`. 3. Optimistic locking: if the issue's `updatedAt` differs from the client's version, return 409 Conflict. 4. Client handles 409 by showing a conflict toast with "Reload" option. 5. Partial updates allowed (only send changed fields). 6. OWNER, ADMIN, MEMBER can update. VIEWER cannot. |
| **UI Behavior** | All updates happen inline (see REQ-028). No explicit "Save all" button; each field saves independently. |
| **Error Cases** | 1. 409 Conflict: toast "This issue was updated by someone else. Reload to see the latest." with Reload button. 2. 404 (issue deleted): toast "This issue no longer exists." and redirect to board. 3. 400 (validation error): field-specific error shown inline. 4. 403 (unauthorized): toast "You don't have permission to edit this issue." |

---

### REQ-038: Delete Issue

| Field | Value |
|-------|-------|
| **ID** | REQ-038 |
| **Module** | Issue |
| **Priority** | MUST (MVP) |
| **Description** | Issues can be deleted by their creator (reporter) or by OWNER/ADMIN. Deletion is a soft delete (sets `deletedAt`). |
| **Acceptance Criteria** | 1. Delete option in the issue detail view (dropdown menu or danger button). 2. Confirmation dialog: "Delete [PROJ-123]? This action cannot be undone." 3. Soft delete: sets `deletedAt` timestamp on the issue record. 4. Deleted issues are excluded from all queries (board, list, search). 5. Issue key is NOT freed for reuse. 6. OWNER/ADMIN can delete any issue. MEMBER can delete only issues they created (reporterId === userId). VIEWER cannot delete. 7. On delete: redirect to board view. Toast: "Issue [KEY] deleted." |
| **UI Behavior** | Delete button in a "..." overflow menu or at the bottom of the issue detail page under a "Danger zone" section. Destructive red button in confirmation dialog. |
| **Error Cases** | 1. Delete already-deleted issue: 404 response. 2. Unauthorized: 403, hide delete option in UI. 3. Network error: toast, issue still visible (retry). |

---

## 5. Board View Module

### REQ-039: Kanban Board View

| Field | Value |
|-------|-------|
| **ID** | REQ-039 |
| **Module** | Board View |
| **Priority** | MUST (MVP) |
| **Description** | The primary view for a project is a Kanban board with columns representing workflow statuses. Issues are displayed as cards within their status column. |
| **Acceptance Criteria** | 1. Board page at `/{workspace-slug}/{project-key}/board`. 2. Columns ordered by `WorkflowStatus.position`. 3. Each column shows: status name, status color dot, issue count badge. 4. Issue cards within each column ordered by `Issue.position` (fractional index). 5. Board fetches data server-side (Server Component) and passes to a Client Component for interactivity. 6. Maximum 50 issues per column initially; "Load more" button for additional issues. 7. Horizontal scrolling if columns exceed viewport width. 8. Board header shows: project name, view toggle (Board / List), "Create issue" button, filter bar. |
| **UI Behavior** | Full-width layout below the project sub-navigation. Columns are equal-width (min 280px), side-by-side. Cards are stacked vertically within columns. Smooth horizontal scroll on trackpad/mouse. Column header is sticky at the top when scrolling vertically within a column. |
| **Error Cases** | 1. No issues in project: show centered empty state (see REQ-054). 2. Project not found: 404. 3. User not in workspace: 403. 4. Data fetch error: error boundary with "Something went wrong" and retry button. |

---

### REQ-040: Issue Card on Board

| Field | Value |
|-------|-------|
| **ID** | REQ-040 |
| **Module** | Board View |
| **Priority** | MUST (MVP) |
| **Description** | Each issue on the Kanban board is represented as a card showing key information at a glance. |
| **Acceptance Criteria** | 1. Card displays: issue type icon (top-left), issue key (e.g., "PROJ-123"), priority icon (top-right), title (1-2 lines, truncated with ellipsis), labels (colored dots or small badges, max 3 shown + "+N more"), assignee avatar (bottom-right), due date (bottom-left, if set, with overdue styling). 2. Card is clickable: opens issue detail page. 3. Card has a hover effect (subtle elevation/shadow). 4. Card has a drag handle (entire card is draggable). |
| **UI Behavior** | Compact card design (~100-120px height). White background (light mode) / dark surface (dark mode). Rounded corners, subtle border. On hover: slight elevation increase. During drag: card becomes semi-transparent at origin, drag overlay shows a slightly elevated copy. |
| **Error Cases** | 1. Missing assignee (user deleted): show "Unassigned" placeholder. 2. Missing labels: no label badges shown (no error). 3. Very long title: truncated with CSS line-clamp (2 lines max). |

---

### REQ-041: Drag-and-Drop Between Columns (Status Change)

| Field | Value |
|-------|-------|
| **ID** | REQ-041 |
| **Module** | Board View |
| **Priority** | MUST (MVP) |
| **Description** | Users can drag an issue card from one column to another to change its status. The move is persisted with optimistic UI. |
| **Acceptance Criteria** | 1. Drag an issue card from column A to column B. 2. On drop: issue's `statusId` is updated to column B's status. 3. Issue's `position` is recalculated based on drop position within the target column (fractional indexing). 4. Optimistic update: card appears in the new column immediately. 5. Server action `moveIssue` persists the status + position change. 6. Activity log entry: "Status changed from [A] to [B]." 7. On error: card reverts to original column and position. Toast: "Failed to move issue. Please try again." 8. Only OWNER, ADMIN, MEMBER can drag. VIEWER sees cards but cannot drag. |
| **UI Behavior** | Drag initiated by mouse down + move (or touch). Drop zone highlights when hovering over a valid column. DragOverlay shows a floating card following the cursor. Source card becomes translucent during drag. Column highlights with a dashed border or background color change when a card is over it. |
| **Error Cases** | 1. Drop on invalid target: card reverts to origin. 2. Server error on move: revert with toast. 3. Concurrent move (another user moved the same card): revert local state, refresh board. 4. Network offline: revert with toast "You're offline. Please reconnect and try again." |

---

### REQ-042: Drag-and-Drop Reordering Within Column

| Field | Value |
|-------|-------|
| **ID** | REQ-042 |
| **Module** | Board View |
| **Priority** | MUST (MVP) |
| **Description** | Users can drag issue cards within the same column to reorder them. The order is persisted using fractional indexing. |
| **Acceptance Criteria** | 1. Drag a card up or down within the same column. 2. Drop indicator (line) shows where the card will be placed. 3. On drop: issue's `position` is recalculated (fractional index between neighbors). 4. Optimistic update: card reorders immediately. 5. Server action persists the new position. 6. No status change occurs (same column). 7. Fractional indexing (via `fractional-indexing` library) avoids reindexing all cards. |
| **UI Behavior** | Smooth animation when cards shift to make room for the dragged card. Drop indicator line shown between cards at the insertion point. |
| **Error Cases** | 1. Position collision (extremely unlikely with fractional indexing): server recalculates positions for the entire column. 2. Server error: revert to original order with toast. |

---

### REQ-043: Quick-Add Issue from Board Column

| Field | Value |
|-------|-------|
| **ID** | REQ-043 |
| **Module** | Board View |
| **Priority** | SHOULD (MVP) |
| **Description** | Users can quickly create an issue directly from a board column by typing a title. The issue is created in that column's status. |
| **Acceptance Criteria** | 1. "+" button or "Add issue" text at the bottom of each column. 2. Clicking reveals an inline text input. 3. User types a title and presses Enter. 4. Issue is created with: the title, status = column's status, type = Task (default), priority = Medium (default), reporter = current user. 5. New card appears at the bottom of the column (optimistic). 6. Input clears and remains open for rapid multi-issue creation. 7. Escape or clicking away closes the input. 8. Empty submit is ignored (no action). |
| **UI Behavior** | Inline text input styled to match card dimensions. Subtle border/background to distinguish from cards. Enter to create, Escape to cancel. After creation, input stays focused for another entry. |
| **Error Cases** | 1. Empty title on Enter: no action, input remains. 2. Network error: show toast, remove optimistic card. 3. Title > 255 chars: truncate or show inline error. |

---

### REQ-044: Board Quick Filters

| Field | Value |
|-------|-------|
| **ID** | REQ-044 |
| **Module** | Board View |
| **Priority** | MUST (MVP) |
| **Description** | A filter bar above the Kanban board allows users to filter visible issues by assignee, priority, label, and type. Filters are reflected in URL query parameters. |
| **Acceptance Criteria** | 1. Filter bar shown between the board header and columns. 2. Filters: Assignee (single or multi-select of workspace members), Priority (multi-select), Label (multi-select), Type (multi-select). 3. Filters are additive (AND logic): e.g., assignee = Alice AND priority = High. 4. Filtering is client-side (all issues loaded, filtered in the component) for MVP; if performance degrades (>500 issues), switch to server-side. 5. Active filters shown as chips/badges with "x" to remove. 6. "Clear all filters" link when any filter is active. 7. Filters persisted in URL search params via `nuqs` (e.g., `?assignee=userId&priority=HIGH`). 8. Sharing a filtered board URL preserves the filters for the recipient. |
| **UI Behavior** | Horizontal bar with filter buttons. Each button opens a popover with checkboxes/selections. Active filters show as filled/highlighted buttons with count badge (e.g., "Priority (2)"). "Clear filters" link at the right end. |
| **Error Cases** | 1. Filter value no longer valid (e.g., deleted label): ignore the invalid filter param, show remaining valid filters. 2. No results matching filters: show "No issues match your filters" empty state with "Clear filters" button. |

---

### REQ-045: Board Column Issue Count

| Field | Value |
|-------|-------|
| **ID** | REQ-045 |
| **Module** | Board View |
| **Priority** | MUST (MVP) |
| **Description** | Each board column header displays the count of issues in that column, updated in real-time as issues are filtered or moved. |
| **Acceptance Criteria** | 1. Issue count shown as a badge next to the column/status name. 2. Count reflects the currently visible issues (after filters are applied). 3. Count updates optimistically during drag-and-drop (source column -1, target column +1). 4. Count format: plain number (e.g., "12"). For 0 issues: show "0". |
| **UI Behavior** | Small rounded badge (muted gray background) next to the column title. Animates on count change (brief scale or opacity transition). |
| **Error Cases** | None specific. Count is derived from rendered cards. |

---

## 6. List View Module

### REQ-046: Issue List/Table View

| Field | Value |
|-------|-------|
| **ID** | REQ-046 |
| **Module** | List View |
| **Priority** | MUST (MVP) |
| **Description** | An alternative to the board view, the list view shows all project issues in a sortable, filterable data table. |
| **Acceptance Criteria** | 1. List page at `/{workspace-slug}/{project-key}/list`. 2. Table powered by TanStack Table (headless). 3. Columns: type icon, issue key, title, status (badge), priority (icon), assignee (avatar + name), labels (badges), due date, created date. 4. Default sort: by created date descending (newest first). 5. Clickable rows: clicking a row navigates to the issue detail page. 6. Pagination: 50 issues per page, cursor-based. Navigation: "Previous" / "Next" buttons with current page indicator. 7. All workspace members can view. |
| **UI Behavior** | Full-width table filling the main content area. Striped or bordered rows. Compact row height. Hover effect on rows. Sticky table header on vertical scroll. Responsive: on smaller screens, less important columns (created date, labels) are hidden. |
| **Error Cases** | 1. No issues: empty state (see REQ-054). 2. Data fetch error: error boundary with retry. 3. Invalid page cursor: reset to first page. |

---

### REQ-047: Table Sorting

| Field | Value |
|-------|-------|
| **ID** | REQ-047 |
| **Module** | List View |
| **Priority** | MUST (MVP) |
| **Description** | Users can sort the issue list by clicking column headers. Sorting supports ascending and descending order. |
| **Acceptance Criteria** | 1. Sortable columns: title, status, priority, assignee, due date, created date. 2. Click column header to sort ascending; click again for descending; click again to remove sort. 3. Sort indicator (up/down arrow) shown on the active sort column. 4. Only one column sorted at a time (single-sort for MVP). 5. Sort state persisted in URL query params. 6. Default: created date descending. |
| **UI Behavior** | Column header shows sort arrow on hover (faded) and on active sort (solid). Clicking triggers a smooth table re-render with sorted data. |
| **Error Cases** | 1. Sort on column with null values (e.g., due date, assignee): nulls sorted to the end. |

---

### REQ-048: Table Filtering

| Field | Value |
|-------|-------|
| **ID** | REQ-048 |
| **Module** | List View |
| **Priority** | MUST (MVP) |
| **Description** | The list view includes a filter toolbar above the table, matching the board filter capabilities. |
| **Acceptance Criteria** | 1. Filter toolbar identical to board filters (REQ-044): assignee, priority, label, type. 2. Additionally: status filter (multi-select, since there is no column-based grouping in list view). 3. Filters applied client-side (same logic as board). 4. Active filter count shown on each filter button. 5. "Clear all filters" option. 6. Filters persisted in URL query params. 7. Combined with sorting: filter first, then sort. |
| **UI Behavior** | Same filter bar component as the board view, placed above the table. Consistent look and feel across views. |
| **Error Cases** | Same as REQ-044. |

---

### REQ-049: Column Visibility Toggle

| Field | Value |
|-------|-------|
| **ID** | REQ-049 |
| **Module** | List View |
| **Priority** | SHOULD (MVP) |
| **Description** | Users can show/hide columns in the list view to customize their view. |
| **Acceptance Criteria** | 1. "Columns" button at the right end of the filter toolbar. 2. Popover with checkboxes for each column (type, key, title, status, priority, assignee, labels, due date, created). 3. Title and key are always visible (not toggleable). 4. Column visibility stored in localStorage (per user, per project). 5. Default: all columns visible on desktop; labels and created date hidden on tablet. |
| **UI Behavior** | Checkbox list popover. Changes apply immediately (no save button). Columns smoothly appear/disappear. |
| **Error Cases** | 1. All optional columns hidden: table still shows key and title (minimum). 2. localStorage unavailable: use defaults, no persistence. |

---

## 7. Search Module

### REQ-050: Global Search (Cmd+K)

| Field | Value |
|-------|-------|
| **ID** | REQ-050 |
| **Module** | Search |
| **Priority** | MUST (MVP) |
| **Description** | A global command palette (Cmd+K / Ctrl+K) allows users to search for issues across all projects in the current workspace. |
| **Acceptance Criteria** | 1. Keyboard shortcut: Cmd+K (Mac) or Ctrl+K (Windows/Linux) opens the command palette. 2. Also accessible via a "Search" button/input in the header. 3. Built using shadcn/ui `<CommandDialog>` (powered by `cmdk`). 4. Search input at the top. 5. Search queries issue titles and issue keys (case-insensitive, using Prisma `contains`). 6. Results scoped to the current workspace. 7. Minimum 2 characters before search fires. 8. Debounced search: 300ms after last keystroke. 9. Results shown as a list below the input. 10. Escape or clicking outside closes the palette. 11. Pressing Enter on a result navigates to the issue detail page. |
| **UI Behavior** | Overlay dialog with backdrop blur. Search input auto-focused. Results appear as a list: each result shows issue type icon, key, title, project name badge, status badge, assignee avatar. Keyboard navigation: up/down arrows to move between results, Enter to select. Loading spinner during search. |
| **Error Cases** | 1. No results: "No issues found for '[query]'." 2. Network error during search: "Search failed. Please try again." 3. Empty query: show nothing or recent items placeholder. 4. Very long query (>100 chars): truncate and search. |

---

### REQ-051: Search Results Display

| Field | Value |
|-------|-------|
| **ID** | REQ-051 |
| **Module** | Search |
| **Priority** | MUST (MVP) |
| **Description** | Search results in the command palette display essential issue information for quick identification and navigation. |
| **Acceptance Criteria** | 1. Each result item shows: issue type icon, issue key (e.g., "PROJ-123"), issue title, project name (small badge), status (colored badge), assignee avatar. 2. Maximum 10 results shown (paginated or "View all results" link for more). 3. Results ordered by relevance: exact key match first, then title matches. 4. Clicking a result navigates to `/{workspace-slug}/{project-key}/issues/{issue-key}` and closes the palette. 5. Keyboard: arrow keys to navigate, Enter to open. |
| **UI Behavior** | Each result is a horizontal row. Highlighted item (keyboard or hover) has a subtle background. Compact layout: icon + key on the left, title in the middle (truncated if long), project/status/assignee on the right. |
| **Error Cases** | 1. Issue has been deleted since search index: clicking navigates to 404, which is handled by REQ-027's error case. |

---

### REQ-052: Search Keyboard Navigation

| Field | Value |
|-------|-------|
| **ID** | REQ-052 |
| **Module** | Search |
| **Priority** | MUST (MVP) |
| **Description** | The search command palette supports full keyboard navigation for power users. |
| **Acceptance Criteria** | 1. Cmd+K / Ctrl+K: open palette (toggle -- pressing again closes it). 2. Escape: close palette. 3. Up/Down arrows: move selection highlight through results. 4. Enter: navigate to the selected result (or first result if none selected). 5. Tab: not used for navigation within palette (reserved for focus management). 6. Typing immediately starts searching (input is auto-focused). 7. All keyboard interactions provided by the `cmdk` library (shadcn Command component). |
| **UI Behavior** | Selection highlight moves smoothly between items. First item is pre-selected by default. Wrapping: down arrow on last item wraps to first (default cmdk behavior). |
| **Error Cases** | 1. Enter with no results: no action. 2. Arrow keys with no results: no action. |

---

### REQ-053: Search Button in Header

| Field | Value |
|-------|-------|
| **ID** | REQ-053 |
| **Module** | Search |
| **Priority** | MUST (MVP) |
| **Description** | A search trigger is always visible in the app header as an alternative to the keyboard shortcut. |
| **Acceptance Criteria** | 1. Search input or button in the top header bar. 2. Displays placeholder text: "Search issues..." with "Cmd+K" shortcut hint badge. 3. Clicking opens the command palette (same as Cmd+K). 4. Visible on all authenticated pages. 5. On smaller screens: search icon button instead of full input. |
| **UI Behavior** | Styled as a muted/ghost input or button. Shows keyboard shortcut badge (platform-aware: "Cmd+K" on Mac, "Ctrl+K" on Windows). On click: opens command palette overlay. Does not function as a standalone search input (just a trigger). |
| **Error Cases** | None specific. |

---

## 8. Cross-Cutting Concerns

### REQ-054: Empty States

| Field | Value |
|-------|-------|
| **ID** | REQ-054 |
| **Module** | Cross-Cutting |
| **Priority** | MUST (MVP) |
| **Description** | Every view that can have zero items must show a meaningful empty state with guidance and a call-to-action. |
| **Acceptance Criteria** | 1. **No workspaces**: Redirect to `/create-workspace` (not an empty state page). 2. **No projects in workspace**: Illustration + "Create your first project" heading + "Get started by creating a project to organize your issues." + "New project" button. 3. **No issues in project (board)**: Centered message: "No issues yet" + "Create your first issue to get started" + "Create issue" button. Individual empty columns show a muted "No issues" text. 4. **No issues in project (list)**: Same as board empty state, adapted for table layout. 5. **No issues matching filters**: "No issues match your filters" + "Try adjusting your filters or clear them to see all issues." + "Clear filters" button. 6. **No search results**: "No issues found for '[query]'" in the command palette. 7. **No comments on issue**: "No comments yet. Be the first to comment." placeholder in the comments section. 8. **No members besides owner**: "Invite your team" banner on the members page with invite button. 9. **No activity on issue**: "No activity yet." placeholder (only for a brand-new issue before any changes). 10. **No starred projects**: "Starred" section hidden in sidebar. |
| **UI Behavior** | Empty states use: a small illustration or icon (muted gray), a heading (large text), a description (smaller muted text), and a primary action button. Centered within the content area. Consistent visual language across all empty states. |
| **Error Cases** | Empty states should never show when data exists but failed to load (that is an error state, not an empty state). |

---

### REQ-055: Loading States

| Field | Value |
|-------|-------|
| **ID** | REQ-055 |
| **Module** | Cross-Cutting |
| **Priority** | MUST (MVP) |
| **Description** | All pages and major components must show appropriate loading states while data is being fetched. |
| **Acceptance Criteria** | 1. **Board view**: Skeleton columns with skeleton cards (3-4 skeleton cards per column, 6 skeleton columns). 2. **List view**: Skeleton table with 10 skeleton rows. 3. **Issue detail**: Skeleton for title, description, sidebar fields. 4. **Project list**: Skeleton project cards. 5. **Members list**: Skeleton table rows. 6. **Search results**: Spinner in the command palette while searching. 7. **Sidebar**: Skeleton project list items. 8. **Forms/dialogs**: Submit button shows spinner + disabled state during submission. 9. All skeletons use shadcn/ui `<Skeleton>` component with animated shimmer. 10. Server Components use Suspense boundaries with skeleton fallbacks. 11. Client-side mutations show loading spinners on buttons. |
| **UI Behavior** | Skeletons match the approximate layout of the real content (structural fidelity). Shimmer animation (left-to-right pulse). No layout shift when real content replaces skeleton. |
| **Error Cases** | Loading states that persist > 10 seconds: consider showing a "Taking longer than expected..." message (nice-to-have, not MVP-critical). |

---

### REQ-056: Error States

| Field | Value |
|-------|-------|
| **ID** | REQ-056 |
| **Module** | Cross-Cutting |
| **Priority** | MUST (MVP) |
| **Description** | Error states are handled gracefully at multiple levels: global error boundary, route-level error boundaries, and inline errors for mutations. |
| **Acceptance Criteria** | 1. **Global error boundary**: `app/error.tsx` catches unhandled errors. Shows "Something went wrong" + "Try again" button that calls `reset()`. 2. **Route-level error**: `[workspaceSlug]/error.tsx` and `[projectKey]/error.tsx` catch workspace/project-level errors. Show contextual error messages. 3. **404 pages**: `app/not-found.tsx` for global 404, plus `notFound()` calls in Server Components when entities are not found. Shows "Page not found" + "Go to home" link. 4. **Server Action errors**: Return structured error objects `{ error: string }` instead of throwing. Client shows error via toast or inline. 5. **Form validation errors**: Inline below the relevant field (red text). 6. **Network errors**: Toast notification "Something went wrong. Please try again." with optional retry. 7. **Permission errors (403)**: Toast "You don't have permission to perform this action." Redirect to the workspace home if route-level. 8. **Toast notifications**: Use `sonner` for all transient success/error messages. |
| **UI Behavior** | Error pages: centered content with icon, heading, description, and action button. Toasts: appear at bottom-right, auto-dismiss after 5 seconds (errors after 8 seconds). Inline errors: red text below the field, field border turns red. |
| **Error Cases** | This requirement IS the error case specification. |

---

### REQ-057: Responsive Layout

| Field | Value |
|-------|-------|
| **ID** | REQ-057 |
| **Module** | Cross-Cutting |
| **Priority** | MUST (MVP) |
| **Description** | The application must be usable on desktop (1024px+) and tablet (768-1023px) screens. Mobile (< 768px) is deferred to Phase 2. |
| **Acceptance Criteria** | 1. **Desktop (>= 1024px)**: Full layout with persistent sidebar (~260px), main content area, issue detail sidebar panel. 2. **Tablet (768-1023px)**: Sidebar is collapsible (toggle button). When collapsed, it overlays the content as a sheet. Main content takes full width. Board columns may require horizontal scroll. Issue detail page: single-column layout (metadata above description, or accordion). 3. **Below 768px**: Not actively supported in MVP. The app should not break, but the experience may be degraded (horizontal scroll, overlapping elements are acceptable). 4. Sidebar state (open/closed) stored in `localStorage` via Zustand. 5. Breakpoints follow Tailwind defaults: `md: 768px`, `lg: 1024px`, `xl: 1280px`. |
| **UI Behavior** | Sidebar collapse button (hamburger or chevron) in the header. Smooth sidebar slide-in/slide-out animation. Board columns scroll horizontally on overflow. Table columns are responsive (hide less important columns below `lg`). |
| **Error Cases** | 1. Window resized while drag-and-drop in progress: cancel the drag operation (safety). |

---

### REQ-058: Dark / Light Mode

| Field | Value |
|-------|-------|
| **ID** | REQ-058 |
| **Module** | Cross-Cutting |
| **Priority** | SHOULD (MVP) |
| **Description** | Users can toggle between dark and light color themes. The preference follows the system setting by default and can be overridden. |
| **Acceptance Criteria** | 1. Theme toggle in the user menu dropdown (sun/moon icon). 2. Options: Light, Dark, System (follows OS setting). 3. Theme preference stored in `localStorage` via `next-themes`. 4. All UI components (shadcn/ui) support both themes via CSS variables. 5. No flash of wrong theme on page load (next-themes handles this with a script tag). 6. Tiptap editor renders correctly in both themes. 7. Board cards, table rows, and all custom components respect the theme. |
| **UI Behavior** | Toggle button shows current theme icon. Clicking cycles through: Light -> Dark -> System, or opens a dropdown with explicit options. Theme transition is instant (CSS variable swap, no animation). |
| **Error Cases** | 1. localStorage unavailable: fall back to system preference. |

---

### REQ-059: Toast Notifications for Mutations

| Field | Value |
|-------|-------|
| **ID** | REQ-059 |
| **Module** | Cross-Cutting |
| **Priority** | MUST (MVP) |
| **Description** | All user-initiated mutations show a toast notification confirming success or reporting failure. |
| **Acceptance Criteria** | 1. Success toasts for: issue created, issue updated (field changes), issue deleted, comment added, project created, project settings updated, workspace settings updated, member invited, member removed, member role changed, label created. 2. Error toasts for: all server action failures, network errors, permission errors. 3. Toast library: Sonner. 4. Toast position: bottom-right. 5. Auto-dismiss: success after 4 seconds, error after 8 seconds. 6. Toasts are stackable (max 3 visible, queue additional). 7. Toasts have a close button. 8. Not every inline field edit needs a toast (e.g., dragging a card does not show a toast on success, only on failure). |
| **UI Behavior** | Small pill-shaped notifications that slide up from the bottom-right. Success: neutral/green styling. Error: red/destructive styling. Include a brief message (1 line). |
| **Error Cases** | This is the notification mechanism for error cases throughout the app. |

---

### REQ-060: Breadcrumb Navigation

| Field | Value |
|-------|-------|
| **ID** | REQ-060 |
| **Module** | Cross-Cutting |
| **Priority** | MUST (MVP) |
| **Description** | A breadcrumb trail in the header shows the user's current location within the workspace hierarchy. |
| **Acceptance Criteria** | 1. Breadcrumb shown in the header, below or next to the search bar. 2. Structure: [Workspace Name] > [Project Name] > [View/Page]. 3. Examples: "Acme Corp > Mobile App > Board", "Acme Corp > Mobile App > PROJ-123", "Acme Corp > Settings > Members". 4. Each segment is a clickable link navigating to that level. 5. Current page (last segment) is not clickable (displayed as text). 6. On workspace-level pages (settings, members): "Acme Corp > Settings". 7. On project list: "Acme Corp > Projects". |
| **UI Behavior** | Small text, muted color. Separator: "/" or ">". Truncated on smaller screens (show last 2-3 segments with "..." for earlier ones). |
| **Error Cases** | 1. Workspace/project data not loaded yet: show skeleton breadcrumb. |

---

## 9. Data Validation Rules

All inputs are validated both client-side (Zod schemas in form components) and server-side (Zod schemas in Server Actions). Server-side validation is the source of truth.

### User / Auth

| Field | Rules |
|-------|-------|
| Name | Required, 1-100 characters, trimmed |
| Email | Required, valid email format (Zod `.email()`), max 255 characters, lowercased |
| Password | Required (for credentials), 8-72 characters, at least 1 uppercase, 1 lowercase, 1 number |

### Workspace

| Field | Rules |
|-------|-------|
| Name | Required, 1-50 characters, trimmed |
| Slug | Required, 3-48 characters, lowercase letters/numbers/hyphens, starts with letter, no ending hyphen, no consecutive hyphens, globally unique, not in reserved list |
| Description | Optional, max 500 characters |

### Project

| Field | Rules |
|-------|-------|
| Name | Required, 1-100 characters, trimmed |
| Key/Prefix | Required, 2-10 uppercase letters (A-Z only), unique within workspace |
| Description | Optional, max 1000 characters |
| Icon | Optional, valid emoji string or null |
| Color | Optional, valid hex color (#RRGGBB format) or null |

### Issue

| Field | Rules |
|-------|-------|
| Title | Required, 1-255 characters, trimmed |
| Description | Optional, Tiptap JSON object, max 100KB |
| Type | Required, enum: EPIC, STORY, TASK, BUG |
| Priority | Required, enum: URGENT, HIGH, MEDIUM, LOW, NONE |
| Status | Required, must be a valid WorkflowStatus ID belonging to the issue's project |
| Assignee | Optional, must be a valid workspace member ID or null |
| Labels | Optional, array of valid Label IDs belonging to the workspace |
| Due Date | Optional, valid ISO date string or null |
| Position | Required, non-empty string (fractional index) |

### Comment

| Field | Rules |
|-------|-------|
| Content | Required, Tiptap JSON object, must not be empty (no blank comments), max 50KB |

### Label

| Field | Rules |
|-------|-------|
| Name | Required, 1-50 characters, trimmed, unique within workspace |
| Color | Required, valid hex color (#RRGGBB format) |

### Invitation

| Field | Rules |
|-------|-------|
| Email | Required, valid email, max 255 characters |
| Role | Required, enum: ADMIN, MEMBER, VIEWER (cannot invite as OWNER) |

---

## 10. Authorization Matrix

| Action | Owner | Admin | Member | Viewer |
|--------|:-----:|:-----:|:------:|:------:|
| View workspace/projects/issues | Yes | Yes | Yes | Yes |
| Edit workspace settings | Yes | Yes | No | No |
| Delete workspace | Yes | No | No | No |
| Invite members | Yes | Yes | No | No |
| Change member roles | Yes | Yes* | No | No |
| Remove members | Yes | Yes** | No | No |
| Create projects | Yes | Yes | No | No |
| Edit project settings | Yes | Yes | Lead only | No |
| Delete/archive projects | Yes | Yes | No | No |
| Create issues | Yes | Yes | Yes | No |
| Edit issues (any) | Yes | Yes | Yes | No |
| Delete issues | Yes | Yes | Own only | No |
| Drag-and-drop on board | Yes | Yes | Yes | No |
| Add comments | Yes | Yes | Yes | Yes |
| Edit own comments | Yes | Yes | Yes | Yes |
| Delete any comment | Yes | Yes | No | No |
| Delete own comment | Yes | Yes | Yes | Yes |
| Create/manage labels | Yes | Yes | No | No |
| Assign labels to issues | Yes | Yes | Yes | No |
| Star/favorite projects | Yes | Yes | Yes | Yes |
| Use search | Yes | Yes | Yes | Yes |

*Admin can change Member/Viewer roles but cannot change another Admin's role.
**Admin can remove Members/Viewers but cannot remove another Admin.

---

## Appendix A: URL Routes Summary

| Route | Page | Auth Required |
|-------|------|:---:|
| `/` | Redirect to workspace or sign-in | Yes |
| `/sign-in` | Sign in page | No |
| `/sign-up` | Sign up page | No |
| `/forgot-password` | Forgot password page | No |
| `/reset-password` | Reset password page | No |
| `/invite/[token]` | Accept invite page | No (prompts sign-in if needed) |
| `/create-workspace` | Create workspace page | Yes |
| `/[workspaceSlug]` | Redirect to projects | Yes |
| `/[workspaceSlug]/projects` | Project list | Yes |
| `/[workspaceSlug]/projects/new` | Create project | Yes |
| `/[workspaceSlug]/settings` | Workspace settings | Yes |
| `/[workspaceSlug]/settings/members` | Member management | Yes |
| `/[workspaceSlug]/[projectKey]` | Redirect to board | Yes |
| `/[workspaceSlug]/[projectKey]/board` | Kanban board | Yes |
| `/[workspaceSlug]/[projectKey]/list` | List view | Yes |
| `/[workspaceSlug]/[projectKey]/settings` | Project settings | Yes |
| `/[workspaceSlug]/[projectKey]/issues/[issueKey]` | Issue detail | Yes |

---

## Appendix B: Keyboard Shortcuts (MVP)

| Shortcut | Action | Context |
|----------|--------|---------|
| `Cmd/Ctrl + K` | Open global search | Any authenticated page |
| `C` | Open create issue dialog | Board or list view |
| `Escape` | Close dialog/palette/modal | Any open overlay |

---

*End of MVP Specification. Total: 60 requirements (REQ-001 through REQ-060).*
