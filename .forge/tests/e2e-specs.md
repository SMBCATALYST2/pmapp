# E2E Test Specifications: PMApp

**Project:** /home/vidit/projects/pmapp
**Stack:** Next.js 15 + TypeScript + Playwright
**Author:** E2ETestWriter (Forge Pipeline)
**Date:** 2026-03-26
**Spec References:** specification.md (REQ-001 through REQ-060), contracts.md

---

## Table of Contents

1. [Test Infrastructure & Conventions](#test-infrastructure--conventions)
2. [Flow 1: New User Onboarding](#flow-1-new-user-onboarding)
3. [Flow 2: Project Setup](#flow-2-project-setup)
4. [Flow 3: Issue Management](#flow-3-issue-management)
5. [Flow 4: Kanban Board](#flow-4-kanban-board)
6. [Flow 5: List View](#flow-5-list-view)
7. [Flow 6: Search](#flow-6-search)
8. [Flow 7: Team Management](#flow-7-team-management)
9. [Flow 8: Empty States](#flow-8-empty-states)
10. [Data-Testid Registry](#data-testid-registry)
11. [Accessibility Requirements](#accessibility-requirements)

---

## Test Infrastructure & Conventions

### Test User Seeding

Each test flow assumes a seeded database. Tests use helper utilities:

| Helper | Purpose |
|--------|---------|
| `seedUser(overrides?)` | Create a user with email/password in the DB, return credentials |
| `seedWorkspace(ownerId, overrides?)` | Create a workspace with the user as OWNER |
| `seedProject(workspaceId, overrides?)` | Create a project with default statuses seeded |
| `seedIssue(projectId, reporterId, overrides?)` | Create an issue with auto-generated key |
| `seedLabel(workspaceId, overrides?)` | Create a workspace-scoped label |
| `loginAs(page, email, password)` | Navigate to `/sign-in`, fill credentials, submit, wait for redirect |

### URL Structure Reference

| Route | Pattern |
|-------|---------|
| Sign Up | `/sign-up` |
| Sign In | `/sign-in` |
| Create Workspace | `/create-workspace` |
| Projects List | `/[workspaceSlug]/projects` |
| Create Project | `/[workspaceSlug]/projects/new` |
| Board View | `/[workspaceSlug]/[projectKey]/board` |
| List View | `/[workspaceSlug]/[projectKey]/list` |
| Issue Detail | `/[workspaceSlug]/[projectKey]/issues/[issueKey]` |
| Workspace Settings | `/[workspaceSlug]/settings` |
| Members | `/[workspaceSlug]/settings/members` |

### Naming Convention

Test files: `tests/e2e/flow-{N}-{name}.spec.ts`
Describe blocks: `Flow {N}: {Name}`
Test names: `should {expected behavior}`

---

## Flow 1: New User Onboarding

**File:** `tests/e2e/flow-1-onboarding.spec.ts`
**Requirements:** REQ-001, REQ-009, REQ-015, REQ-016, REQ-054

### Scenario 1.1: Sign up with email/password and create first workspace

**Preconditions:** No seeded data. Clean database state for this test user's email.

**Steps:**

| # | Action | Expected State | Testid / Selector |
|---|--------|---------------|-------------------|
| 1 | Navigate to `/sign-up` | Sign-up page visible. Centered card layout with name, email, password fields, "Create account" button, link to sign-in, OAuth buttons visible. | `data-testid="signup-form"`, `data-testid="signup-name-input"`, `data-testid="signup-email-input"`, `data-testid="signup-password-input"`, `data-testid="signup-submit-button"` |
| 2 | Verify password show/hide toggle | Password field has a toggle button. Click it: field type changes from `password` to `text`. Click again: reverts. | `data-testid="password-toggle"` |
| 3 | Fill name: "Test User", email: "testuser-{uuid}@example.com", password: "SecurePass1" | All fields populated. No validation errors. | |
| 4 | Click "Create account" button | Button shows loading spinner. Form fields disabled during submission. | `data-testid="signup-submit-button"` should have `aria-busy="true"` |
| 5 | Wait for redirect | URL changes to `/create-workspace` (since sign-up auto-creates a default workspace, user is redirected into it). Verify URL matches `/{workspace-slug}/projects`. | `page.waitForURL(/\/.*\/projects$/)` |
| 6 | Verify empty workspace dashboard | Projects page shows empty state: illustration/icon, heading "Create your first project", description text, "New project" button. Sidebar shows workspace name. | `data-testid="empty-projects-state"`, `data-testid="create-project-button"` |

**Accessibility Checks:**
- Sign-up form has `aria-label="Sign up form"` or descriptive heading
- All inputs have associated `<label>` elements with `for` attributes
- Password toggle button has `aria-label="Show password"` / `aria-label="Hide password"`
- Submit button is keyboard-focusable and activatable with Enter
- Error messages are linked to inputs via `aria-describedby`
- Tab order: Name -> Email -> Password -> Toggle -> Submit -> Sign-in link

---

### Scenario 1.2: Sign-up validation errors

**Preconditions:** None.

**Steps:**

| # | Action | Expected State | Testid / Selector |
|---|--------|---------------|-------------------|
| 1 | Navigate to `/sign-up` | Form visible | |
| 2 | Click "Create account" with all fields empty | Inline errors: "Name must be at least 2 characters" (or required), "Invalid email address", "Password must be at least 8 characters". Submit button remains enabled after validation. | `data-testid="signup-name-error"`, `data-testid="signup-email-error"`, `data-testid="signup-password-error"` |
| 3 | Fill email: "invalid-email", password: "short" | Inline error on email: "Invalid email address". Inline error on password: "Password must be at least 8 characters". | |
| 4 | Fill a valid email that already exists in DB (seed a user first) | Submit the form. Server returns inline error under email: "An account with this email already exists." | `data-testid="signup-email-error"` text content check |

**Accessibility Checks:**
- Error messages have `role="alert"` or are announced via `aria-live="polite"`
- Input fields in error state have `aria-invalid="true"`

---

### Scenario 1.3: Sign-up page links and OAuth buttons

**Preconditions:** None.

**Steps:**

| # | Action | Expected State | Testid / Selector |
|---|--------|---------------|-------------------|
| 1 | Navigate to `/sign-up` | Page renders | |
| 2 | Verify sign-in link exists | Link with text "Sign in" or "Already have an account?" navigates to `/sign-in` | `data-testid="signin-link"` |
| 3 | Verify Google OAuth button | Button with text "Continue with Google" is visible | `data-testid="oauth-google-button"` |
| 4 | Verify GitHub OAuth button | Button with text "Continue with GitHub" is visible | `data-testid="oauth-github-button"` |
| 5 | Verify divider | "or continue with" divider text between OAuth and form | `data-testid="auth-divider"` |

---

### Scenario 1.4: Create workspace with slug validation

**Preconditions:** User is authenticated, redirected to `/create-workspace` (no existing workspaces).

**Steps:**

| # | Action | Expected State | Testid / Selector |
|---|--------|---------------|-------------------|
| 1 | Page shows "Create your workspace" heading | Full-page form visible with name, slug, description fields | `data-testid="create-workspace-form"` |
| 2 | Type workspace name: "My Team" | Slug field auto-populates with "my-team". URL preview shows "pmapp.com/my-team". | `data-testid="workspace-name-input"`, `data-testid="workspace-slug-input"`, `data-testid="slug-preview"` |
| 3 | Verify slug availability indicator | After debounce (300ms), a green checkmark appears next to slug if available | `data-testid="slug-status-available"` (checkmark) |
| 4 | Manually change slug to "admin" (reserved) | Error: "This URL is reserved." Red X icon. | `data-testid="slug-status-error"`, error text check |
| 5 | Change slug to a valid, available value | Green checkmark returns | |
| 6 | Submit the form | Redirect to `/{slug}/projects`. Workspace appears in sidebar. | `page.waitForURL(/\/.*\/projects$/)` |

**Accessibility Checks:**
- Slug validation status announced via `aria-live="polite"` region
- Form fields have proper labels
- Submit button disabled while slug validation is in-flight (with `aria-disabled="true"`)

---

## Flow 2: Project Setup

**File:** `tests/e2e/flow-2-project-setup.spec.ts`
**Requirements:** REQ-017, REQ-019, REQ-020, REQ-024, REQ-031, REQ-039, REQ-043, REQ-054

### Scenario 2.1: Create a new project with name, key, and description

**Preconditions:** Authenticated user with workspace "test-workspace" (OWNER role). No projects exist.

**Steps:**

| # | Action | Expected State | Testid / Selector |
|---|--------|---------------|-------------------|
| 1 | Navigate to `/{workspaceSlug}/projects` | Empty projects state visible with "Create your first project" | `data-testid="empty-projects-state"` |
| 2 | Click "New project" button | Navigates to `/{workspaceSlug}/projects/new` or opens create project dialog | `data-testid="create-project-button"` |
| 3 | Verify form fields | Name input, Key/prefix input, Description textarea, Emoji picker button, Color picker, Submit button | `data-testid="project-name-input"`, `data-testid="project-key-input"`, `data-testid="project-description-input"`, `data-testid="project-icon-picker"`, `data-testid="project-color-picker"`, `data-testid="create-project-submit"` |
| 4 | Type name: "Mobile App" | Key auto-generates to "MA". Key field shows uppercase value. | `data-testid="project-key-input"` value should be "MA" |
| 5 | Verify key availability check | After debounce, green checkmark next to key field | `data-testid="key-status-available"` |
| 6 | Type description: "Track mobile app development" | Description field populated | |
| 7 | Click submit | Loading state on button. Redirect to `/{workspaceSlug}/MA/board`. Toast: "Issue [KEY] created." or similar project created toast. | `page.waitForURL(/\/.*\/MA\/board$/)` |

---

### Scenario 2.2: See empty board with default columns

**Preconditions:** Scenario 2.1 completed (or project seeded with no issues).

**Steps:**

| # | Action | Expected State | Testid / Selector |
|---|--------|---------------|-------------------|
| 1 | Board page is visible at `/{workspaceSlug}/MA/board` | Board header shows project name "Mobile App". View toggle has Board active. | `data-testid="project-header"`, `data-testid="view-toggle-board"` (active state) |
| 2 | Verify 6 default columns exist | Columns: Backlog, Todo, In Progress, In Review, Done, Cancelled. Each column shows status name, color dot, and "0" issue count. | `data-testid="board-column-Backlog"`, `data-testid="board-column-Todo"`, `data-testid="board-column-In Progress"`, `data-testid="board-column-In Review"`, `data-testid="board-column-Done"`, `data-testid="board-column-Cancelled"` |
| 3 | Verify empty board state | Centered empty state message: "No issues yet" with "Create your first issue" text and "Create issue" button | `data-testid="empty-board-state"`, `data-testid="create-issue-button"` |
| 4 | Verify sub-navigation tabs | Board, List, Settings tabs visible. Board tab active/highlighted. | `data-testid="project-nav-board"`, `data-testid="project-nav-list"`, `data-testid="project-nav-settings"` |
| 5 | Verify each column has a quick-add button | "+" or "Add issue" text at bottom of each column | `data-testid="quick-add-trigger"` inside each column |
| 6 | Verify project appears in sidebar | Sidebar lists "Mobile App" (or "MA") under projects | `data-testid="sidebar-project-MA"` |

**Accessibility Checks:**
- Board columns have `role="list"` or appropriate semantic structure
- Column headers use heading elements (e.g., `<h3>`)
- View toggle uses `role="tablist"` with `role="tab"` for each option, `aria-selected` on active tab
- Sub-navigation uses `role="navigation"` with descriptive `aria-label`

---

### Scenario 2.3: Create first issue from board quick-add

**Preconditions:** Project exists with default columns, no issues.

**Steps:**

| # | Action | Expected State | Testid / Selector |
|---|--------|---------------|-------------------|
| 1 | Click "+" / "Add issue" at bottom of "Todo" column | Inline text input appears at bottom of Todo column. Input is focused. | `data-testid="quick-add-input"` |
| 2 | Type issue title: "Set up CI/CD pipeline" | Text visible in input | |
| 3 | Press Enter | Issue card appears in Todo column (optimistic). Card shows: key "MA-1", title "Set up CI/CD pipeline", type icon (Task default), priority icon (Medium default). Column count changes from "0" to "1". Toast: "Issue MA-1 created." Input clears and stays focused. | `data-testid="issue-card-MA-1"`, `data-testid="column-count-Todo"` text "1" |
| 4 | Type another issue: "Write unit tests" and press Enter | Second card appears as "MA-2". Column count becomes "2". | `data-testid="issue-card-MA-2"` |
| 5 | Press Escape | Quick-add input closes | Input no longer visible |
| 6 | Verify empty submit | Click quick-add again, press Enter with empty input. No issue created. Input remains. | |

**Accessibility Checks:**
- Quick-add input has `aria-label="Create new issue"` or placeholder text
- Issue cards are focusable via keyboard
- Toast notification announced via `aria-live="polite"`

---

### Scenario 2.4: Project key validation

**Preconditions:** Authenticated, on create project page.

**Steps:**

| # | Action | Expected State | Testid / Selector |
|---|--------|---------------|-------------------|
| 1 | Clear key field and type "a" (lowercase single char) | Error: "Key must be 2-10 uppercase letters (A-Z only)." Key is auto-uppercased to "A" but still too short. | `data-testid="project-key-error"` |
| 2 | Type "123" | Error: "Must be 2-10 uppercase letters (A-Z only)." | |
| 3 | Type an existing key (seed a project with key "MA" first) | Error: "This key is already used by another project." | |
| 4 | Type a valid, unique key "XY" | Green checkmark. No error. | `data-testid="key-status-available"` |

---

## Flow 3: Issue Management

**File:** `tests/e2e/flow-3-issue-management.spec.ts`
**Requirements:** REQ-025, REQ-027, REQ-028, REQ-029, REQ-030, REQ-031, REQ-032, REQ-033, REQ-034, REQ-035, REQ-036, REQ-037

### Scenario 3.1: Create issue with all fields via dialog

**Preconditions:** Workspace with project "MA" (key "MA"). Default statuses seeded. At least one label "Bug" (red) exists. A second workspace member "Alice" exists.

**Steps:**

| # | Action | Expected State | Testid / Selector |
|---|--------|---------------|-------------------|
| 1 | Navigate to board view `/{workspaceSlug}/MA/board` | Board visible | |
| 2 | Click "Create issue" button (or press `C` keyboard shortcut) | Create issue dialog opens. Title field is focused. Dialog has fields: Title, Type, Status, Priority, Assignee, Labels, Due Date, Description. | `data-testid="create-issue-dialog"`, `data-testid="issue-title-input"` |
| 3 | Fill title: "Implement user authentication" | Title populated | |
| 4 | Select type: "Story" from type dropdown | Type dropdown shows "Story" with green bookmark icon | `data-testid="issue-type-select"` |
| 5 | Select status: "In Progress" from status dropdown | Status shows "In Progress" with yellow dot | `data-testid="issue-status-select"` |
| 6 | Select priority: "High" from priority dropdown | Priority shows "High" with orange up arrow icon | `data-testid="issue-priority-select"` |
| 7 | Select assignee: "Alice" from assignee picker | Assignee shows Alice's avatar and name | `data-testid="issue-assignee-select"` |
| 8 | Add label: "Bug" from label multi-select | Label appears as colored badge/chip | `data-testid="issue-label-select"` |
| 9 | Set due date: pick a date 7 days from now | Date picker shows selected date. Date displayed in "Mar 26, 2026" format. | `data-testid="issue-due-date-picker"` |
| 10 | Enter description in rich text editor: "Implement OAuth and email/password auth" | Description editor shows formatted text | `data-testid="issue-description-editor"` |
| 11 | Click "Create issue" button | Dialog closes. Toast: "Issue MA-1 created." Issue card appears in "In Progress" column on board with all metadata visible (type icon, priority icon, title, assignee avatar, label dot, due date). | `data-testid="create-issue-submit"`, `data-testid="issue-card-MA-1"` |

**Accessibility Checks:**
- Dialog has `role="dialog"` with `aria-modal="true"` and `aria-labelledby` pointing to dialog title
- All select/dropdown components have `aria-label` or `aria-labelledby`
- Date picker is keyboard navigable (arrow keys for days, Enter to select)
- Dialog is closable with Escape key
- Focus is trapped within dialog while open
- On close, focus returns to the trigger element

---

### Scenario 3.2: Edit issue inline on detail page

**Preconditions:** Issue "MA-1" exists with title "Implement user authentication", type Story, priority High, status In Progress, assignee Alice, label Bug.

**Steps:**

| # | Action | Expected State | Testid / Selector |
|---|--------|---------------|-------------------|
| 1 | Click issue card "MA-1" on board | Navigates to `/{workspaceSlug}/MA/issues/MA-1`. Issue detail page loads. | `page.waitForURL(/\/MA\/issues\/MA-1$/)` |
| 2 | Verify detail page layout | Left panel (~65%): title, description, comments/activity tabs. Right panel (~35%): status, assignee, priority, labels, due date, created, updated. Breadcrumb: Workspace > Mobile App > MA-1. | `data-testid="issue-detail-page"`, `data-testid="issue-detail-title"`, `data-testid="issue-detail-sidebar"`, `data-testid="breadcrumb"` |
| 3 | Click on title to edit | Title becomes an editable input/contenteditable. Text is selected or cursor placed. | `data-testid="issue-detail-title"` in edit mode |
| 4 | Change title to "Implement user authentication flow" and press Enter | Title saves. Optimistic update visible. Activity tab shows "Title changed." | `data-testid="issue-detail-title"` text content matches new title |
| 5 | Click on Status dropdown in sidebar | Status dropdown opens showing all project statuses with color dots | `data-testid="issue-status-dropdown"` |
| 6 | Select "Done" | Status changes immediately (optimistic). Status badge shows "Done" with green dot. Activity: "Status changed from In Progress to Done." | |
| 7 | Click on Priority dropdown | Priority dropdown opens with Urgent, High, Medium, Low, None options | `data-testid="issue-priority-dropdown"` |
| 8 | Select "Urgent" | Priority icon changes to red double-up arrow. Activity: "Priority changed from High to Urgent." | |
| 9 | Click assignee to open member picker | Member picker popover opens with workspace members | `data-testid="issue-assignee-picker"` |
| 10 | Select "Unassigned" (clear) | Assignee shows "Unassigned" placeholder. Activity: "Assignee changed from Alice to Unassigned." | |
| 11 | Click labels to open label picker | Label multi-select popover opens | `data-testid="issue-label-picker"` |
| 12 | Remove "Bug" label, add "Feature" label (if seeded) | Labels update. Activity shows label change. | |
| 13 | Click due date to open date picker | Calendar popup opens | `data-testid="issue-due-date-trigger"` |
| 14 | Clear due date | Due date removed. Activity: "Due date removed." | |

**Accessibility Checks:**
- Inline editable title has `role="textbox"` or uses native `<input>` with `aria-label="Issue title"`
- Dropdowns use `role="listbox"` with `role="option"` items
- Member picker is keyboard navigable
- All field changes are announced via status messages

---

### Scenario 3.3: Add comment to issue

**Preconditions:** On issue detail page for "MA-1".

**Steps:**

| # | Action | Expected State | Testid / Selector |
|---|--------|---------------|-------------------|
| 1 | Click "Comments" tab | Comments section visible. If no comments: "No comments yet. Be the first to comment." placeholder. | `data-testid="comments-tab"`, `data-testid="empty-comments-state"` |
| 2 | Click the comment editor area | Tiptap editor for new comment activates. Toolbar with formatting options visible. "Comment" submit button visible. | `data-testid="comment-editor"`, `data-testid="comment-submit-button"` |
| 3 | Type "We should use NextAuth.js for this." | Text appears in editor | |
| 4 | Click "Comment" submit button | Comment appears in the list: author avatar, author name, relative timestamp ("just now"), comment content. Submit button was disabled during submission. Editor clears. | `data-testid="comment-item"` (first in list) |
| 5 | Verify activity tab | Switch to "Activity" tab. Entry: "[User] added a comment." | `data-testid="activity-tab"`, `data-testid="activity-entry"` |

**Accessibility Checks:**
- Comment editor has `aria-label="Write a comment"`
- Comment submit button disabled when editor is empty (`aria-disabled="true"`)
- Tab interface uses `role="tablist"` / `role="tab"` / `role="tabpanel"`
- Each comment card has semantic structure (author info, timestamp, content)

---

### Scenario 3.4: Change issue status via dropdown on detail page

**Preconditions:** Issue "MA-1" exists, currently in "Todo" status. On issue detail page.

**Steps:**

| # | Action | Expected State | Testid / Selector |
|---|--------|---------------|-------------------|
| 1 | Locate status field in sidebar | Shows current status "Todo" with blue color dot | `data-testid="issue-status-dropdown"` |
| 2 | Click status dropdown | Dropdown opens listing: Backlog, Todo (current, highlighted), In Progress, In Review, Done, Cancelled. Each with color dot. | |
| 3 | Select "In Progress" | Dropdown closes. Status updates to "In Progress" with yellow dot. Optimistic update -- no page reload. | |
| 4 | Verify activity log updates | Activity tab shows: "[User] changed status from Todo to In Progress -- just now" | `data-testid="activity-entry"` |
| 5 | Navigate back to board | Issue card now in "In Progress" column instead of "Todo" column. | Verify `data-testid="issue-card-MA-1"` is within the "In Progress" column container |

**Accessibility Checks:**
- Status dropdown is keyboard operable (Enter to open, arrow keys to navigate, Enter to select, Escape to close)
- Current status has `aria-selected="true"` within the listbox

---

### Scenario 3.5: Rich text description editing

**Preconditions:** Issue exists, on detail page. Description is empty.

**Steps:**

| # | Action | Expected State | Testid / Selector |
|---|--------|---------------|-------------------|
| 1 | Verify empty description placeholder | Shows "Add a description..." placeholder text | `data-testid="issue-description"` |
| 2 | Click description area | Tiptap editor activates with toolbar (bold, italic, code, headings, lists, etc.) | `data-testid="description-editor"`, `data-testid="description-toolbar"` |
| 3 | Type `**bold text**` using Markdown shortcut | Text renders as bold | |
| 4 | Type `# Heading` | Converts to H1 heading | |
| 5 | Type `- list item` | Converts to bullet list | |
| 6 | Click away (blur) or wait for auto-save | Description saves (debounced 1-2s). No explicit save button needed. "Unsaved changes" indicator disappears if shown. | |
| 7 | Refresh the page | Description persists with formatting intact | |

---

### Scenario 3.6: Edit and delete a comment

**Preconditions:** Issue with at least one comment authored by the current user.

**Steps:**

| # | Action | Expected State | Testid / Selector |
|---|--------|---------------|-------------------|
| 1 | Locate the user's own comment | Comment shows pencil (edit) icon on hover or in menu | `data-testid="comment-edit-button"` |
| 2 | Click edit | Comment content becomes editable. "Save" and "Cancel" buttons appear. | `data-testid="comment-edit-editor"`, `data-testid="comment-save-button"`, `data-testid="comment-cancel-button"` |
| 3 | Change text and click "Save" | Comment updates. "(edited)" label appears next to timestamp. | `data-testid="comment-edited-label"` |
| 4 | Click delete (trash icon) on the comment | Confirmation dialog: "Delete this comment? This cannot be undone." | `data-testid="comment-delete-button"`, `data-testid="confirm-delete-dialog"` |
| 5 | Confirm deletion | Comment removed from list. | |

---

## Flow 4: Kanban Board

**File:** `tests/e2e/flow-4-kanban-board.spec.ts`
**Requirements:** REQ-039, REQ-040, REQ-041, REQ-042, REQ-044, REQ-045

### Scenario 4.1: View board with issues in columns

**Preconditions:** Project "MA" with 3 issues:
- MA-1: "Auth feature" in Todo, priority High, assigned to Alice
- MA-2: "Setup DB" in In Progress, priority Medium, assigned to Bob
- MA-3: "Write docs" in Done, priority Low, unassigned

**Steps:**

| # | Action | Expected State | Testid / Selector |
|---|--------|---------------|-------------------|
| 1 | Navigate to `/{workspaceSlug}/MA/board` | Board loads with columns | |
| 2 | Verify Todo column | Shows 1 issue card (MA-1). Column header: "Todo" with count badge "1". Card shows: type icon, "MA-1" key, "Auth feature" title, High priority icon (orange up arrow), Alice's avatar. | `data-testid="board-column-Todo"`, `data-testid="column-count-Todo"` text "1", `data-testid="issue-card-MA-1"` |
| 3 | Verify In Progress column | Shows 1 issue card (MA-2). Count badge "1". Card shows medium priority, Bob's avatar. | `data-testid="board-column-In Progress"`, `data-testid="issue-card-MA-2"` |
| 4 | Verify Done column | Shows 1 issue card (MA-3). Count badge "1". Low priority icon, no assignee avatar. | `data-testid="board-column-Done"`, `data-testid="issue-card-MA-3"` |
| 5 | Verify empty columns | Backlog, In Review, Cancelled columns show count "0" with muted "No issues" text. | `data-testid="column-count-Backlog"` text "0" |
| 6 | Verify issue card contents | MA-1 card shows: type icon (top-left), key "MA-1", title (1-2 lines), priority icon, assignee avatar (bottom-right). Labels shown if present. | `data-testid="card-key-MA-1"`, `data-testid="card-title-MA-1"`, `data-testid="card-priority-MA-1"`, `data-testid="card-assignee-MA-1"` |

**Accessibility Checks:**
- Each issue card is focusable (can tab to it)
- Cards have `aria-label` describing the issue (e.g., "MA-1: Auth feature, High priority, assigned to Alice")
- Column headers are announced (level 3 headings or labeled regions)

---

### Scenario 4.2: Drag issue from "Todo" to "In Progress"

**Preconditions:** MA-1 in Todo column.

**Steps:**

| # | Action | Expected State | Testid / Selector |
|---|--------|---------------|-------------------|
| 1 | Mouse down on MA-1 card in Todo column | Drag initiates. Card becomes semi-transparent at origin. DragOverlay shows a floating copy of the card. | `data-testid="issue-card-MA-1"` |
| 2 | Drag over "In Progress" column | In Progress column highlights (dashed border or background change). Drop zone indicator visible. | `data-testid="board-column-In Progress"` with drop-target styling |
| 3 | Drop card in "In Progress" column | Card appears in In Progress column. Todo count changes from "1" to "0". In Progress count changes from "1" to "2". MA-1 card now visible in In Progress. | `data-testid="column-count-Todo"` text "0", `data-testid="column-count-In Progress"` text "2" |
| 4 | Verify persistence | Refresh the page. MA-1 is still in In Progress column. | |
| 5 | Navigate to MA-1 detail page | Status shows "In Progress". Activity log: "Status changed from Todo to In Progress." | |

**Accessibility Checks:**
- Drag operation has keyboard alternative (select card -> use dropdown to change status)
- During drag, `aria-live` region announces "Dragging MA-1"
- On drop, `aria-live` announces "Moved MA-1 to In Progress"

---

### Scenario 4.3: Drag-and-drop reordering within column

**Preconditions:** In Progress column has MA-1 at position 0, MA-2 at position 1.

**Steps:**

| # | Action | Expected State | Testid / Selector |
|---|--------|---------------|-------------------|
| 1 | Drag MA-2 above MA-1 within In Progress column | Drop indicator line appears above MA-1. Cards shift to make room. | |
| 2 | Drop MA-2 above MA-1 | MA-2 now appears first, MA-1 second in the column. Status unchanged for both. | Verify order within `data-testid="board-column-In Progress"` |
| 3 | Refresh page | Order preserved: MA-2 then MA-1. | |

---

### Scenario 4.4: Filter board by assignee

**Preconditions:** Board has issues with different assignees (Alice and Bob) and some unassigned.

**Steps:**

| # | Action | Expected State | Testid / Selector |
|---|--------|---------------|-------------------|
| 1 | Locate filter bar above the board | Filter bar visible with filter buttons: Assignee, Priority, Label, Type | `data-testid="filter-bar"`, `data-testid="filter-assignee"`, `data-testid="filter-priority"` |
| 2 | Click "Assignee" filter button | Popover opens with list of workspace members as checkboxes | `data-testid="filter-assignee-popover"` |
| 3 | Select "Alice" | Popover closes (or stays open). Filter applied. Only issues assigned to Alice are visible on the board. Assignee button shows count badge "(1)". URL updates with `?assignee=...` | `data-testid="filter-assignee"` should show badge, URL should contain `assignee` param |
| 4 | Verify column counts update | Column counts reflect filtered results only (e.g., Todo shows 1 if Alice has 1 issue there, 0 otherwise). | |
| 5 | Verify filter chip | Active filter chip "Assignee: Alice" with "x" to remove. "Clear all filters" link visible. | `data-testid="active-filter-chip"`, `data-testid="clear-all-filters"` |
| 6 | Click "x" on the filter chip | Filter removed. All issues visible again. URL param removed. | |

**Accessibility Checks:**
- Filter buttons have `aria-haspopup="listbox"` or `aria-haspopup="dialog"`
- Filter popover is keyboard navigable (checkboxes)
- Active filter chips have close button with `aria-label="Remove assignee filter"`
- Filter state announced via `aria-live` region

---

### Scenario 4.5: Filter board by priority

**Preconditions:** Board has issues with various priorities.

**Steps:**

| # | Action | Expected State | Testid / Selector |
|---|--------|---------------|-------------------|
| 1 | Click "Priority" filter button | Popover opens with priority options: Urgent, High, Medium, Low, None (each with icon) | `data-testid="filter-priority-popover"` |
| 2 | Select "High" and "Urgent" | Both checked. Filter applied (AND logic with other filter types, OR logic within priority). Only High and Urgent issues visible. | |
| 3 | Priority button shows "(2)" badge | Badge count matches selections | |
| 4 | Verify URL includes priority params | URL: `?priority=HIGH&priority=URGENT` or similar | |
| 5 | Share the URL (copy), open in new tab | Same filters applied, same filtered view | |

---

### Scenario 4.6: No issues matching filters

**Preconditions:** Board with issues, apply a filter combination that matches nothing.

**Steps:**

| # | Action | Expected State | Testid / Selector |
|---|--------|---------------|-------------------|
| 1 | Apply a filter that matches no issues (e.g., assignee = non-existent or combine filters with no overlap) | Board shows "No issues match your filters" empty state with "Clear filters" button. No issue cards visible. | `data-testid="no-filter-results"`, `data-testid="clear-filters-button"` |
| 2 | Click "Clear filters" | All issues reappear. Filters removed. URL params cleared. | |

---

## Flow 5: List View

**File:** `tests/e2e/flow-5-list-view.spec.ts`
**Requirements:** REQ-046, REQ-047, REQ-048, REQ-049

### Scenario 5.1: Switch to list view

**Preconditions:** Project "MA" with multiple issues. Currently on board view.

**Steps:**

| # | Action | Expected State | Testid / Selector |
|---|--------|---------------|-------------------|
| 1 | Click "List" in project sub-navigation | Navigates to `/{workspaceSlug}/MA/list`. List tab active/highlighted. Board tab inactive. | `data-testid="project-nav-list"`, `page.waitForURL(/\/MA\/list$/)` |
| 2 | Verify table structure | Table visible with columns: Type (icon), Key, Title, Status (badge), Priority (icon), Assignee (avatar+name), Labels (badges), Due Date, Created Date. Table header row is sticky. | `data-testid="issue-list-table"`, `data-testid="table-header"` |
| 3 | Verify row content | Each row shows issue data. Rows are clickable. Hover effect on rows. | `data-testid="issue-row-MA-1"`, etc. |
| 4 | Verify default sort | Sorted by created date descending (newest first). | |

**Accessibility Checks:**
- Table uses `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>` semantic elements
- Table has `aria-label="Issues list"` or `<caption>`
- Sort direction indicated via `aria-sort="ascending"` or `aria-sort="descending"` on `<th>`
- Rows are interactive (clickable), with `role="link"` or wrapped in `<a>` tags

---

### Scenario 5.2: Sort by priority

**Preconditions:** List view with multiple issues of different priorities.

**Steps:**

| # | Action | Expected State | Testid / Selector |
|---|--------|---------------|-------------------|
| 1 | Click "Priority" column header | Table sorts by priority ascending (Urgent first). Sort arrow visible (up). | `data-testid="sort-priority"`, aria-sort="ascending" |
| 2 | Click "Priority" column header again | Sort reverses to descending (None first). Arrow flips (down). | aria-sort="descending" |
| 3 | Click "Priority" column header third time | Sort removed. Returns to default (created date desc). | |
| 4 | Verify URL params | URL includes `?sort=priority&order=asc` or similar when sorted. | |

---

### Scenario 5.3: Sort by status and assignee

**Preconditions:** List view with various statuses and assignees.

**Steps:**

| # | Action | Expected State | Testid / Selector |
|---|--------|---------------|-------------------|
| 1 | Click "Status" column header | Rows sort by status (grouped by status category order: Backlog -> Todo -> In Progress -> Done -> Cancelled). Sort arrow on Status. | `data-testid="sort-status"` |
| 2 | Click "Assignee" column header | Sort changes to assignee (alphabetical by name). Null assignees at end. Previous status sort removed (single-sort). | `data-testid="sort-assignee"` |

---

### Scenario 5.4: Click issue row to open detail

**Preconditions:** List view with issues.

**Steps:**

| # | Action | Expected State | Testid / Selector |
|---|--------|---------------|-------------------|
| 1 | Click on the row for issue "MA-1" | Navigates to `/{workspaceSlug}/MA/issues/MA-1`. Issue detail page loads. | `data-testid="issue-row-MA-1"`, `page.waitForURL(/\/MA\/issues\/MA-1$/)` |
| 2 | Verify breadcrumb | Shows: Workspace > Mobile App > MA-1 | `data-testid="breadcrumb"` |
| 3 | Click "Mobile App" in breadcrumb | Navigates back to project (board view by default, or last view). | |

**Accessibility Checks:**
- Table rows are keyboard navigable (Tab to row, Enter to open)

---

### Scenario 5.5: Column visibility toggle

**Preconditions:** List view visible.

**Steps:**

| # | Action | Expected State | Testid / Selector |
|---|--------|---------------|-------------------|
| 1 | Click "Columns" button at right end of filter toolbar | Popover with checkboxes for each column. Title and Key checkboxes disabled (always visible). | `data-testid="columns-toggle-button"`, `data-testid="columns-popover"` |
| 2 | Uncheck "Labels" | Labels column disappears from table immediately. | |
| 3 | Uncheck "Created Date" | Created Date column disappears. | |
| 4 | Refresh page | Column visibility persists (stored in localStorage). Labels and Created Date still hidden. | |
| 5 | Re-check "Labels" | Labels column reappears. | |

---

## Flow 6: Search

**File:** `tests/e2e/flow-6-search.spec.ts`
**Requirements:** REQ-050, REQ-051, REQ-052, REQ-053

### Scenario 6.1: Open Cmd+K search and search for issue by title

**Preconditions:** Workspace with project "MA", issues seeded: MA-1 "Implement authentication", MA-2 "Design login page", MA-3 "Setup database".

**Steps:**

| # | Action | Expected State | Testid / Selector |
|---|--------|---------------|-------------------|
| 1 | Press `Ctrl+K` (or `Cmd+K` on Mac) | Command palette dialog opens. Overlay with backdrop blur. Search input auto-focused. | `data-testid="command-palette"`, `data-testid="command-search-input"` |
| 2 | Type "auth" | After 300ms debounce, results appear. "MA-1 Implement authentication" in results. Loading spinner shows during search. | `data-testid="search-loading"` (during), `data-testid="search-result-MA-1"` |
| 3 | Verify search result content | Result shows: type icon, key "MA-1", title "Implement authentication", project name badge "Mobile App", status badge, assignee avatar (if assigned). | |
| 4 | Verify max 10 results shown | If more than 10 matches, only 10 shown with "View all" option. | |

**Accessibility Checks:**
- Command palette has `role="dialog"` with `aria-modal="true"`
- Search input has `aria-label="Search issues"`
- Results use `role="listbox"` with `role="option"` for each item
- Currently highlighted result has `aria-selected="true"`
- Result count announced to screen readers

---

### Scenario 6.2: Navigate to issue from search results

**Preconditions:** Command palette open with results showing.

**Steps:**

| # | Action | Expected State | Testid / Selector |
|---|--------|---------------|-------------------|
| 1 | Click on "MA-1" result | Command palette closes. Navigates to `/{workspaceSlug}/MA/issues/MA-1`. Issue detail page loads. | `page.waitForURL(/\/MA\/issues\/MA-1$/)` |
| 2 | Open command palette again (Ctrl+K) | Palette opens. Previous search cleared (empty input). | |
| 3 | Type "MA-2" (search by key) | Result shows MA-2 as exact key match (should appear first). | `data-testid="search-result-MA-2"` |
| 4 | Use arrow keys to highlight MA-2 | First result pre-selected. Arrow down moves highlight. | |
| 5 | Press Enter | Navigates to MA-2 detail page. Palette closes. | `page.waitForURL(/\/MA\/issues\/MA-2$/)` |

**Accessibility Checks:**
- Keyboard navigation: Up/Down arrows cycle through results
- Enter activates highlighted result
- Escape closes palette, focus returns to previously focused element

---

### Scenario 6.3: Search with no results

**Preconditions:** Command palette open.

**Steps:**

| # | Action | Expected State | Testid / Selector |
|---|--------|---------------|-------------------|
| 1 | Type "xyznonexistent" | After debounce, shows: "No issues found for 'xyznonexistent'." | `data-testid="search-no-results"` |
| 2 | Press Enter with no results | Nothing happens (no navigation). | |
| 3 | Press Escape | Palette closes. | |

---

### Scenario 6.4: Search button in header

**Preconditions:** Any authenticated page.

**Steps:**

| # | Action | Expected State | Testid / Selector |
|---|--------|---------------|-------------------|
| 1 | Verify search trigger in header | Search button/input visible with placeholder "Search issues..." and keyboard shortcut badge "Ctrl+K" (or "Cmd+K" on Mac). | `data-testid="header-search-trigger"` |
| 2 | Click the search trigger | Command palette opens (same as Ctrl+K). | `data-testid="command-palette"` |

---

### Scenario 6.5: Cmd+K toggles palette

**Steps:**

| # | Action | Expected State | Testid / Selector |
|---|--------|---------------|-------------------|
| 1 | Press Ctrl+K | Palette opens | |
| 2 | Press Ctrl+K again | Palette closes | |
| 3 | Press Ctrl+K then Escape | Palette opens, then closes | |

---

## Flow 7: Team Management

**File:** `tests/e2e/flow-7-team-management.spec.ts`
**Requirements:** REQ-007, REQ-008, REQ-011, REQ-012, REQ-013

### Scenario 7.1: Invite member to workspace

**Preconditions:** Authenticated as workspace OWNER. Workspace "test-workspace" exists.

**Steps:**

| # | Action | Expected State | Testid / Selector |
|---|--------|---------------|-------------------|
| 1 | Navigate to `/{workspaceSlug}/settings/members` | Members page loads. Table shows current user as OWNER. "Invite member" button visible. | `data-testid="members-page"`, `data-testid="members-table"`, `data-testid="invite-member-button"` |
| 2 | Click "Invite member" | Dialog opens with email input and role select dropdown. | `data-testid="invite-dialog"`, `data-testid="invite-email-input"`, `data-testid="invite-role-select"` |
| 3 | Type email: "alice@example.com" | Email populated | |
| 4 | Select role: "Member" from dropdown | Role options: Admin, Member, Viewer (no Owner option). Member selected. | |
| 5 | Click "Send invite" | Dialog closes. Toast: "Invitation sent to alice@example.com." Pending invitations section shows the invitation with email, role "Member", invited by current user, expiry date, and "Revoke" action. | `data-testid="invite-submit"`, `data-testid="pending-invitations-table"`, `data-testid="pending-invite-alice@example.com"` |

**Accessibility Checks:**
- Invite dialog has `role="dialog"` with `aria-modal="true"`
- Role select uses `aria-label="Select role"`
- Pending invitations table has proper `<table>` semantics
- Revoke button has `aria-label="Revoke invitation for alice@example.com"`

---

### Scenario 7.2: Invite validation errors

**Preconditions:** Workspace with existing member "bob@example.com" and pending invite for "carol@example.com".

**Steps:**

| # | Action | Expected State | Testid / Selector |
|---|--------|---------------|-------------------|
| 1 | Open invite dialog, enter "bob@example.com" | Submit. Error: "This person is already a member of this workspace." | `data-testid="invite-error"` |
| 2 | Enter "carol@example.com" | Submit. Error: "An invitation has already been sent to this email. Revoke it to send a new one." | |
| 3 | Enter "invalid-email" | Inline validation error: "Invalid email address." | |

---

### Scenario 7.3: Assign issue to team member and verify visibility

**Preconditions:** Workspace with OWNER (current user) and MEMBER "Alice". Project "MA" with issue "MA-1" (unassigned).

**Steps:**

| # | Action | Expected State | Testid / Selector |
|---|--------|---------------|-------------------|
| 1 | Navigate to MA-1 detail page | Issue detail visible | |
| 2 | Click assignee picker in sidebar | Member list popover opens showing workspace members | `data-testid="issue-assignee-picker"` |
| 3 | Select "Alice" | Assignee updates to Alice (avatar + name). Activity: "Assignee changed from Unassigned to Alice." | |
| 4 | Sign out and sign in as Alice | Alice's dashboard loads | |
| 5 | Navigate to the same workspace/project board | Board visible. MA-1 shows Alice's avatar on the card. | `data-testid="card-assignee-MA-1"` |
| 6 | Filter board by assignee = Alice | Only MA-1 (and any other Alice-assigned issues) visible. | |

---

### Scenario 7.4: Change member role

**Preconditions:** OWNER logged in. Member "Alice" is MEMBER role.

**Steps:**

| # | Action | Expected State | Testid / Selector |
|---|--------|---------------|-------------------|
| 1 | Navigate to members page | Alice's row shows role "Member" with role dropdown (visible to OWNER). | `data-testid="member-row-alice"`, `data-testid="role-select-alice"` |
| 2 | Change Alice's role dropdown to "Admin" | Role updates immediately (optimistic). Toast: "Role updated for Alice." | |
| 3 | Verify OWNER's own row | Role dropdown disabled/hidden for own row. Cannot change own role. | `data-testid="role-select-self"` should be disabled |

---

### Scenario 7.5: Remove member

**Preconditions:** OWNER logged in. Member "Alice" exists, assigned to 2 issues.

**Steps:**

| # | Action | Expected State | Testid / Selector |
|---|--------|---------------|-------------------|
| 1 | Click "Remove" on Alice's row | Confirmation dialog: "Remove Alice from [Workspace]? They will be unassigned from all issues." Warning about 2 assigned issues. | `data-testid="remove-member-button-alice"`, `data-testid="confirm-remove-dialog"` |
| 2 | Click "Remove" in confirmation | Alice's row disappears from table. Toast: "Alice has been removed from the workspace." | |
| 3 | Verify issues previously assigned to Alice | Navigate to board. MA-1 and MA-2 (if assigned to Alice) now show "Unassigned." | |

---

## Flow 8: Empty States

**File:** `tests/e2e/flow-8-empty-states.spec.ts`
**Requirements:** REQ-054

### Scenario 8.1: New workspace with no projects

**Preconditions:** Authenticated user, workspace created, zero projects.

**Steps:**

| # | Action | Expected State | Testid / Selector |
|---|--------|---------------|-------------------|
| 1 | Navigate to `/{workspaceSlug}/projects` | Empty state visible: illustration/icon, heading "Create your first project", description "Get started by creating a project to organize your issues.", "New project" button. | `data-testid="empty-projects-state"`, `data-testid="empty-projects-heading"` text "Create your first project", `data-testid="create-project-button"` |
| 2 | Verify sidebar | Sidebar shows workspace name but no project list items (or "No projects" text). | `data-testid="sidebar-projects-list"` should be empty |
| 3 | Click "New project" button | Navigates to create project page/dialog. | |

**Accessibility Checks:**
- Empty state heading uses appropriate heading level
- CTA button is keyboard focusable and has descriptive text

---

### Scenario 8.2: New project with no issues (board view)

**Preconditions:** Project exists with default columns, zero issues.

**Steps:**

| # | Action | Expected State | Testid / Selector |
|---|--------|---------------|-------------------|
| 1 | Navigate to `/{workspaceSlug}/MA/board` | Board columns visible (all 6 defaults) with count "0" each. Centered empty state: "No issues yet", "Create your first issue to get started", "Create issue" button. | `data-testid="empty-board-state"` |
| 2 | Each column shows muted "No issues" text | Column bodies are empty with placeholder text | |
| 3 | Click "Create issue" button | Create issue dialog opens | |

---

### Scenario 8.3: New project with no issues (list view)

**Preconditions:** Project exists, zero issues.

**Steps:**

| # | Action | Expected State | Testid / Selector |
|---|--------|---------------|-------------------|
| 1 | Navigate to `/{workspaceSlug}/MA/list` | Table area shows empty state: "No issues yet", "Create your first issue to get started", "Create issue" button. Table headers may or may not be visible. | `data-testid="empty-list-state"` |
| 2 | Click "Create issue" | Dialog opens | |

---

### Scenario 8.4: Search with no results

**Preconditions:** Command palette open.

**Steps:**

| # | Action | Expected State | Testid / Selector |
|---|--------|---------------|-------------------|
| 1 | Type a query that matches nothing | "No issues found for '[query]'" message in palette | `data-testid="search-no-results"` |

---

### Scenario 8.5: No comments on issue

**Preconditions:** Issue exists with zero comments.

**Steps:**

| # | Action | Expected State | Testid / Selector |
|---|--------|---------------|-------------------|
| 1 | Open issue detail, click Comments tab | "No comments yet. Be the first to comment." placeholder visible | `data-testid="empty-comments-state"` |

---

### Scenario 8.6: No members besides owner

**Preconditions:** Workspace with only the OWNER, no other members.

**Steps:**

| # | Action | Expected State | Testid / Selector |
|---|--------|---------------|-------------------|
| 1 | Navigate to members page | Only OWNER row visible. "Invite your team" banner with invite button. | `data-testid="invite-team-banner"`, `data-testid="invite-member-button"` |

---

## Data-Testid Registry

Comprehensive registry of all `data-testid` attributes referenced in the test scenarios. Implementation must add these to the corresponding components.

### Auth Components

| Testid | Component | Element |
|--------|-----------|---------|
| `signup-form` | SignUpForm | `<form>` wrapper |
| `signup-name-input` | SignUpForm | Name input field |
| `signup-email-input` | SignUpForm | Email input field |
| `signup-password-input` | SignUpForm | Password input field |
| `signup-submit-button` | SignUpForm | Submit button |
| `signup-name-error` | SignUpForm | Name validation error text |
| `signup-email-error` | SignUpForm | Email validation error text |
| `signup-password-error` | SignUpForm | Password validation error text |
| `password-toggle` | PasswordInput | Show/hide toggle button |
| `signin-link` | SignUpForm | Link to sign-in page |
| `oauth-google-button` | OAuthButtons | Google OAuth button |
| `oauth-github-button` | OAuthButtons | GitHub OAuth button |
| `auth-divider` | AuthLayout | "or continue with" divider |

### Workspace Components

| Testid | Component | Element |
|--------|-----------|---------|
| `create-workspace-form` | CreateWorkspaceForm | `<form>` wrapper |
| `workspace-name-input` | CreateWorkspaceForm | Workspace name input |
| `workspace-slug-input` | CreateWorkspaceForm | Slug input |
| `slug-preview` | CreateWorkspaceForm | URL preview text |
| `slug-status-available` | SlugValidator | Green checkmark icon |
| `slug-status-error` | SlugValidator | Red X icon + error text |
| `workspace-switcher` | WorkspaceSwitcher | Switcher dropdown trigger |

### Project Components

| Testid | Component | Element |
|--------|-----------|---------|
| `empty-projects-state` | ProjectsList | Empty state container |
| `empty-projects-heading` | ProjectsList | Empty state heading |
| `create-project-button` | ProjectsList / EmptyState | "New project" button |
| `project-name-input` | CreateProjectForm | Name input |
| `project-key-input` | CreateProjectForm | Key/prefix input |
| `project-description-input` | CreateProjectForm | Description textarea |
| `project-icon-picker` | CreateProjectForm | Emoji picker trigger |
| `project-color-picker` | CreateProjectForm | Color picker |
| `create-project-submit` | CreateProjectForm | Submit button |
| `key-status-available` | KeyValidator | Green checkmark |
| `key-status-error` | KeyValidator | Red X + error |
| `project-key-error` | CreateProjectForm | Key validation error text |
| `project-header` | ProjectHeader | Project page header |
| `project-nav-board` | ProjectSubNav | Board tab |
| `project-nav-list` | ProjectSubNav | List tab |
| `project-nav-settings` | ProjectSubNav | Settings tab |
| `sidebar-project-{KEY}` | Sidebar | Individual project item |

### Board Components

| Testid | Component | Element |
|--------|-----------|---------|
| `board-column-{statusName}` | BoardColumn | Column container |
| `column-count-{statusName}` | BoardColumn | Issue count badge |
| `empty-board-state` | BoardView | Empty board state container |
| `issue-card-{issueKey}` | IssueCard | Individual card |
| `card-key-{issueKey}` | IssueCard | Key badge/link |
| `card-title-{issueKey}` | IssueCard | Title text |
| `card-priority-{issueKey}` | IssueCard | Priority icon |
| `card-assignee-{issueKey}` | IssueCard | Assignee avatar |
| `quick-add-trigger` | BoardColumn | "+" / "Add issue" button |
| `quick-add-input` | QuickAddIssue | Inline title input |
| `view-toggle-board` | ViewToggle | Board view button (active) |
| `view-toggle-list` | ViewToggle | List view button |
| `no-filter-results` | BoardView | No filter results state |

### Filter Components

| Testid | Component | Element |
|--------|-----------|---------|
| `filter-bar` | FilterBar | Filter bar container |
| `filter-assignee` | FilterBar | Assignee filter button |
| `filter-priority` | FilterBar | Priority filter button |
| `filter-label` | FilterBar | Label filter button |
| `filter-type` | FilterBar | Type filter button |
| `filter-assignee-popover` | AssigneeFilter | Filter popover |
| `filter-priority-popover` | PriorityFilter | Filter popover |
| `active-filter-chip` | FilterChip | Active filter badge |
| `clear-all-filters` | FilterBar | Clear all link |
| `clear-filters-button` | EmptyFilterState | Clear filters CTA button |

### Issue Detail Components

| Testid | Component | Element |
|--------|-----------|---------|
| `issue-detail-page` | IssueDetailPage | Page container |
| `issue-detail-title` | IssueTitle | Editable title |
| `issue-detail-sidebar` | IssueSidebar | Right metadata panel |
| `issue-status-dropdown` | StatusSelect | Status dropdown trigger |
| `issue-priority-dropdown` | PrioritySelect | Priority dropdown trigger |
| `issue-assignee-picker` | AssigneePicker | Assignee picker trigger |
| `issue-label-picker` | LabelPicker | Label multi-select trigger |
| `issue-due-date-trigger` | DueDatePicker | Date picker trigger |
| `issue-description` | IssueDescription | Description section |
| `description-editor` | TiptapEditor | Rich text editor |
| `description-toolbar` | TiptapEditor | Formatting toolbar |
| `breadcrumb` | Breadcrumb | Breadcrumb navigation |

### Issue Create Dialog Components

| Testid | Component | Element |
|--------|-----------|---------|
| `create-issue-dialog` | CreateIssueDialog | Dialog container |
| `create-issue-button` | Various | Create issue trigger button |
| `issue-title-input` | CreateIssueDialog | Title input |
| `issue-type-select` | CreateIssueDialog | Type dropdown |
| `issue-status-select` | CreateIssueDialog | Status dropdown |
| `issue-priority-select` | CreateIssueDialog | Priority dropdown |
| `issue-assignee-select` | CreateIssueDialog | Assignee picker |
| `issue-label-select` | CreateIssueDialog | Label multi-select |
| `issue-due-date-picker` | CreateIssueDialog | Date picker |
| `issue-description-editor` | CreateIssueDialog | Description editor |
| `create-issue-submit` | CreateIssueDialog | Submit button |

### Comment Components

| Testid | Component | Element |
|--------|-----------|---------|
| `comments-tab` | IssueDetail | Comments tab trigger |
| `activity-tab` | IssueDetail | Activity tab trigger |
| `empty-comments-state` | CommentsList | No comments placeholder |
| `comment-editor` | CommentEditor | New comment Tiptap editor |
| `comment-submit-button` | CommentEditor | Submit button |
| `comment-item` | CommentItem | Individual comment container |
| `comment-edit-button` | CommentItem | Edit button (pencil) |
| `comment-delete-button` | CommentItem | Delete button (trash) |
| `comment-edit-editor` | CommentItem | Edit mode editor |
| `comment-save-button` | CommentItem | Save edit button |
| `comment-cancel-button` | CommentItem | Cancel edit button |
| `comment-edited-label` | CommentItem | "(edited)" label |
| `confirm-delete-dialog` | DeleteConfirmDialog | Confirmation dialog |
| `activity-entry` | ActivityItem | Individual activity entry |

### List View Components

| Testid | Component | Element |
|--------|-----------|---------|
| `issue-list-table` | IssueTable | `<table>` element |
| `table-header` | IssueTable | `<thead>` |
| `issue-row-{issueKey}` | IssueRow | `<tr>` for each issue |
| `sort-priority` | TableHeader | Priority column sort trigger |
| `sort-status` | TableHeader | Status column sort trigger |
| `sort-assignee` | TableHeader | Assignee column sort trigger |
| `columns-toggle-button` | FilterToolbar | Column visibility trigger |
| `columns-popover` | ColumnsPopover | Visibility checkboxes |
| `empty-list-state` | IssueTable | Empty list state |

### Search / Command Palette Components

| Testid | Component | Element |
|--------|-----------|---------|
| `header-search-trigger` | Header | Search button/input in header |
| `command-palette` | CommandDialog | Dialog overlay |
| `command-search-input` | CommandDialog | Search text input |
| `search-loading` | CommandDialog | Loading spinner |
| `search-result-{issueKey}` | SearchResultItem | Individual result |
| `search-no-results` | CommandDialog | No results message |

### Team Management Components

| Testid | Component | Element |
|--------|-----------|---------|
| `members-page` | MembersPage | Page container |
| `members-table` | MembersTable | Members `<table>` |
| `member-row-{userName}` | MemberRow | Individual member `<tr>` |
| `role-select-{userName}` | MemberRow | Role dropdown |
| `role-select-self` | MemberRow | Current user's role (disabled) |
| `invite-member-button` | MembersPage | Invite button |
| `invite-dialog` | InviteDialog | Invite dialog |
| `invite-email-input` | InviteDialog | Email input |
| `invite-role-select` | InviteDialog | Role select |
| `invite-submit` | InviteDialog | Submit button |
| `invite-error` | InviteDialog | Error message |
| `pending-invitations-table` | MembersPage | Pending invites table |
| `pending-invite-{email}` | PendingInviteRow | Individual invite row |
| `remove-member-button-{userName}` | MemberRow | Remove button |
| `confirm-remove-dialog` | ConfirmDialog | Remove confirmation |
| `invite-team-banner` | MembersPage | "Invite your team" banner |

---

## Accessibility Requirements

All E2E tests should include the following accessibility validations (run axe-core on each key page).

### Global Accessibility Checks (Every Page)

1. **No critical axe-core violations** -- Run `@axe-core/playwright` on each page after it loads
2. **Skip navigation link** -- First focusable element should be a "Skip to content" link
3. **Landmark regions** -- Page has `<main>`, `<nav>`, `<header>` landmarks
4. **Color contrast** -- All text meets WCAG AA (4.5:1 for normal text, 3:1 for large)
5. **Focus visible** -- All interactive elements have visible focus indicator (`:focus-visible`)
6. **No keyboard traps** -- Tab through entire page without getting stuck

### Per-Component Accessibility Checks

| Component | Checks |
|-----------|--------|
| Forms | All inputs have visible labels, error messages linked via `aria-describedby`, submit with Enter key |
| Dialogs/Modals | `role="dialog"`, `aria-modal="true"`, focus trapped inside, Escape closes, focus returns to trigger |
| Dropdowns/Selects | `role="listbox"`, `role="option"`, keyboard navigation (arrows, Enter, Escape, type-ahead) |
| Tabs | `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`, arrow key navigation |
| Toast notifications | `role="status"` or `aria-live="polite"`, auto-dismiss after timeout |
| Tables | Semantic `<table>` elements, `<th scope="col">`, sortable headers have `aria-sort` |
| Drag-and-drop | Keyboard alternative exists (status dropdown), live region announces moves |
| Command palette | `role="dialog"`, `role="combobox"` for search, `role="listbox"` for results |
| Breadcrumbs | `<nav aria-label="Breadcrumb">`, current page not a link |
| Loading states | `aria-busy="true"` on loading containers, skeleton content hidden from screen readers |
| Empty states | Heading + description + CTA button, all focusable and readable |
| Sidebar | `<nav aria-label="Workspace navigation">`, collapsible with `aria-expanded` |

### Keyboard Navigation Flows

| Flow | Expected Sequence |
|------|------------------|
| Sign-up form | Tab: Name -> Email -> Password -> Toggle -> Submit -> Sign-in link -> OAuth buttons |
| Create issue dialog | Tab: Title -> Type -> Status -> Priority -> Assignee -> Labels -> Due Date -> Description -> Submit -> Cancel |
| Board view | Tab through filter bar -> Tab through column headers -> Tab through cards within columns |
| Issue detail | Tab: Title -> Description -> Status -> Assignee -> Priority -> Labels -> Due Date -> Comments tab -> Activity tab -> Comment editor |
| Command palette | Ctrl+K opens. Tab: Search input (auto-focused). Arrow keys: navigate results. Enter: select. Escape: close. |

---

*End of E2E Test Specifications. 8 flows, 30+ scenarios, 100+ data-testid attributes, comprehensive accessibility coverage.*
