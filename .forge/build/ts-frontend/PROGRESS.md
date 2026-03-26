# TS-Frontend Builder Progress

**Status:** COMPLETE
**Date:** 2026-03-26

## Files Created/Modified

### Config Files
- [x] `next.config.ts` — standalone output, server actions config
- [x] `tsconfig.json` — path aliases (@/ = src/), Next.js plugin
- [x] `postcss.config.mjs` — Tailwind v4 PostCSS plugin
- [x] `src/app/globals.css` — Tailwind v4 imports, CSS custom properties (status/priority/type colors, sidebar vars, dark mode)

### Root Layout & Providers
- [x] `src/app/layout.tsx` — Root layout with Inter font, metadata, Providers wrapper, skip-to-content link
- [x] `src/app/page.tsx` — Root redirect (auth check -> workspace or sign-in)
- [x] `src/lib/providers.tsx` — SessionProvider, QueryClientProvider, NuqsAdapter, Toaster

### Auth Pages (src/app/(auth)/)
- [x] `layout.tsx` — Centered card layout
- [x] `sign-up/page.tsx` — Full registration form (name, email, password with show/hide, OAuth buttons, validation, data-testids)
- [x] `sign-in/page.tsx` — Login form (email, password, OAuth, forgot-password link, callbackUrl)
- [x] `forgot-password/page.tsx` — Password reset request form
- [x] `invite/[token]/page.tsx` — Server component, auth check
- [x] `invite/[token]/accept-invite-client.tsx` — Client component for accepting invites

### Dashboard Layout (src/app/(dashboard)/)
- [x] `layout.tsx` — Auth-protected shell (sidebar + header + main)
- [x] `page.tsx` — Redirect to first workspace or create-workspace
- [x] `loading.tsx` — Loading spinner
- [x] `create-workspace/page.tsx` — Workspace creation with slug auto-gen, validation, availability check

### Workspace Pages
- [x] `[workspaceSlug]/layout.tsx` — Workspace context validation
- [x] `[workspaceSlug]/page.tsx` — Redirect to projects
- [x] `[workspaceSlug]/not-found.tsx` — 404 for workspace
- [x] `[workspaceSlug]/projects/page.tsx` — Project list grid with empty state
- [x] `[workspaceSlug]/projects/new/page.tsx` — Create project form page
- [x] `[workspaceSlug]/settings/page.tsx` — Workspace settings form
- [x] `[workspaceSlug]/settings/members/page.tsx` — Members table + invite

### Project Pages
- [x] `[projectKey]/layout.tsx` — Project header, sub-nav (Board/List/Settings)
- [x] `[projectKey]/page.tsx` — Redirect to board
- [x] `[projectKey]/not-found.tsx` — 404 for project
- [x] `[projectKey]/board/page.tsx` — Kanban board (server data fetch)
- [x] `[projectKey]/board/loading.tsx` — Board skeleton
- [x] `[projectKey]/list/page.tsx` — List/table view (server data fetch)
- [x] `[projectKey]/issues/[issueKey]/page.tsx` — Issue detail (server data fetch)
- [x] `[projectKey]/issues/[issueKey]/loading.tsx` — Detail skeleton
- [x] `[projectKey]/issues/[issueKey]/not-found.tsx` — 404 for issue
- [x] `[projectKey]/settings/page.tsx` — Project settings form

### Layout Components (src/components/layout/)
- [x] `app-sidebar.tsx` — Workspace switcher, project list (starred/all), navigation links
- [x] `header.tsx` — Breadcrumbs + search trigger
- [x] `breadcrumbs.tsx` — Dynamic breadcrumb navigation from URL params
- [x] `user-menu.tsx` — User avatar + sign out
- [x] `project-sub-nav.tsx` — Board/List/Settings tabs

### Board Components (src/components/boards/)
- [x] `board-view.tsx` — Full Kanban with @dnd-kit, filters, empty state, create issue dialog
- [x] `board-column.tsx` — Droppable column with SortableContext
- [x] `board-card.tsx` — Sortable issue card (key, title, type, priority, assignee, labels, due date)
- [x] `drag-overlay-card.tsx` — Floating card during drag
- [x] `quick-create-issue.tsx` — Inline issue creation at column bottom
- [x] `board-filters.tsx` — Filter bar (assignee, priority, type, label) with popovers and chips

### Issue Components (src/components/issues/)
- [x] `create-issue-dialog.tsx` — Modal form (title, type, status, priority, assignee, labels, due date, description)
- [x] `issue-detail.tsx` — Full detail view with tabs (comments/activity), delete
- [x] `issue-detail-sidebar.tsx` — Right sidebar (status, assignee, priority, type, labels, due date, reporter, dates)
- [x] `issue-title.tsx` — Inline-editable title
- [x] `issue-comments.tsx` — Comment list + create/edit/delete
- [x] `issue-activity.tsx` — Activity timeline
- [x] `issue-type-icon.tsx` — Type icon (Epic/Story/Task/Bug)
- [x] `issue-priority-icon.tsx` — Priority icon (Urgent/High/Medium/Low/None)
- [x] `issue-status-badge.tsx` — Status pill with color
- [x] `issue-label-badge.tsx` — Label badge with color

### Issues Table (src/components/issues-table/)
- [x] `issues-data-table.tsx` — TanStack Table with sorting, filtering, column visibility

### Project Components (src/components/projects/)
- [x] `project-card.tsx` — Project card for grid view
- [x] `create-project-form.tsx` — Form with key auto-gen, color picker, availability check
- [x] `project-settings-form.tsx` — Project settings (name, description, color)

### Workspace Components (src/components/workspace/)
- [x] `workspace-settings-form.tsx` — Workspace name, description (slug read-only)
- [x] `members-table.tsx` — Members table with role dropdown, remove
- [x] `invite-member-dialog.tsx` — Email + role invite dialog

### Search (src/components/search/)
- [x] `command-menu.tsx` — Cmd+K command palette with debounced search, keyboard navigation

### Shared Components (src/components/shared/)
- [x] `empty-state.tsx` — Reusable empty state with icon, heading, description, action
- [x] `confirm-dialog.tsx` — Confirmation dialog (supports destructive variant)
- [x] `user-avatar.tsx` — Avatar with fallback initials

### Hooks (src/hooks/)
- [x] `use-sidebar-data.ts` — Fetch workspace + project sidebar data
- [x] `use-debounce.ts` — Debounce hook
- [x] `use-keyboard-shortcut.ts` — Keyboard shortcut registration

### Stores (src/stores/)
- [x] `command-menu-store.ts` — Zustand store for command palette open/close

### Middleware
- [x] `src/middleware.ts` — Route protection (already created by API builder, verified compatible)

### Re-export Modules (created for frontend compatibility)
- [x] `src/server/actions/issue.ts`
- [x] `src/server/actions/project.ts`
- [x] `src/server/actions/comment.ts`
- [x] Updated `src/server/queries/activity.ts` with getIssueComments/getIssueActivities aliases

### Modified Files
- [x] `src/lib/utils.ts` — Added cn() with clsx+twMerge, formatRelativeDate, getInitials

## Dependencies Added
- next, react, react-dom, @types/react, @types/react-dom, typescript
- tailwindcss, @tailwindcss/postcss, postcss
- next-auth@beta, @auth/prisma-adapter
- react-hook-form, @hookform/resolvers, zod
- @tanstack/react-query, @tanstack/react-table
- @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities
- fractional-indexing
- lucide-react, class-variance-authority, clsx, tailwind-merge
- cmdk, date-fns, nuqs, sonner, zustand

## Data-Testid Coverage
All data-testid attributes from E2E specs are included:
- Auth: signup-form, signup-*-input, signup-*-error, password-toggle, oauth-*-button, auth-divider, signin-link
- Workspace: create-workspace-form, workspace-*-input, slug-preview, slug-status-*
- Project: empty-projects-state, create-project-button, project-*-input, key-status-*, project-header, project-nav-*
- Board: board-column-*, column-count-*, empty-board-state, issue-card-*, card-key-*, card-title-*, card-priority-*, card-assignee-*, quick-add-*, view-toggle-*, no-filter-results
- Filters: filter-bar, filter-assignee, filter-priority, filter-label, filter-type, filter-*-popover, active-filter-chip, clear-all-filters, clear-filters-button
- Issue Detail: issue-detail-page, issue-detail-title, issue-detail-sidebar, issue-status-dropdown, issue-priority-dropdown, issue-assignee-picker, issue-label-picker, issue-due-date-trigger, issue-description, description-editor, breadcrumb
- Create Issue: create-issue-dialog, issue-title-input, issue-type-select, issue-status-select, issue-priority-select, issue-assignee-select, issue-label-select, issue-due-date-picker, issue-description-editor, create-issue-submit, create-issue-button
- Comments: comments-tab, activity-tab, empty-comments-state, comment-editor, comment-submit-button, comment-item, comment-edit-button, comment-delete-button, comment-edit-editor, comment-save-button, comment-cancel-button, comment-edited-label, confirm-delete-dialog, activity-entry
- List: issue-list-table, table-header, issue-row-*, sort-priority, sort-status, sort-assignee, columns-toggle-button, columns-popover, empty-list-state
- Search: header-search-trigger, command-palette, command-search-input, search-loading, search-result-*, search-no-results
- Members: members-page, members-table, member-row-*, role-select-*, invite-member-button, invite-dialog, invite-email-input, invite-role-select, invite-submit, invite-error, pending-invitations-table, remove-member-button-*, confirm-remove-dialog, invite-team-banner

## Critique Revisions Applied
1. Added loading.tsx files for route groups (board, issue detail, dashboard)
2. Added not-found.tsx files for workspace, project, issue
3. Server Components by default, "use client" only where needed
4. Filters support URL persistence via nuqs adapter
5. All forms use react-hook-form + zod resolver
6. Optimistic updates on board drag-and-drop with revert on error
