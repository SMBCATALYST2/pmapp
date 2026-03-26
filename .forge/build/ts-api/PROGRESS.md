# Builder-TS-API Progress

## Status: COMPLETE

## Files Created

### Utility & Foundation
- [x] src/lib/errors.ts — AppError class, withErrorHandling wrapper, success/failure helpers
- [x] src/lib/constants.ts — Issue types, priorities, status categories, role hierarchy, default statuses, reserved slugs
- [x] src/lib/utils.ts — generateIssueKey, slugify, generateProjectKey, extractTextFromTiptap, generateInviteToken, hasMinimumRole
- [x] src/lib/db/index.ts — Added `db` alias export for consistent imports

### TypeScript Types
- [x] src/types/api.ts — ActionResult, PaginatedResponse, SearchResult, ApiError
- [x] src/types/auth.ts — SessionUser, Session, JWTPayload, UserWithWorkspaces
- [x] src/types/board.ts — BoardIssue, BoardColumn, BoardData, DragData, DropColumnData, DragResult
- [x] src/types/index.ts — Re-exports from Prisma + composite relation types (IssueWithRelations, IssueListItem, ProjectWithCounts, MemberWithUser, CommentWithAuthor, ActivityWithActor, etc.)

### Auth Setup
- [x] src/lib/auth/auth.ts — NextAuth.js v5 config, credentials provider, JWT strategy, session callbacks
- [x] src/lib/auth/helpers.ts — requireAuth, requireWorkspaceMember, requireRole, requireProjectInWorkspace, requireIssueInWorkspace, checkRateLimit
- [x] src/middleware.ts — Route protection middleware, public route bypass
- [x] src/app/api/auth/[...nextauth]/route.ts — NextAuth catch-all handler

### Zod Validation Schemas
- [x] src/lib/validations/auth.ts — signUpSchema (with password complexity), signInSchema, forgotPasswordSchema, resetPasswordSchema
- [x] src/lib/validations/workspace.ts — createWorkspaceSchema (with slug validation + reserved check), updateWorkspaceSchema (slug immutable)
- [x] src/lib/validations/project.ts — createProjectSchema, updateProjectSchema (prefix immutable)
- [x] src/lib/validations/issue.ts — createIssueSchema, updateIssueSchema, moveIssueSchema, reorderIssueSchema, issueFilterSchema, searchIssuesSchema, tiptapJsonSchema (replaces z.any())
- [x] src/lib/validations/comment.ts — createCommentSchema, updateCommentSchema, deleteCommentSchema (with Tiptap validation)
- [x] src/lib/validations/label.ts — createLabelSchema, updateLabelSchema, deleteLabelSchema
- [x] src/lib/validations/member.ts — inviteMemberSchema, changeMemberRoleSchema, removeMemberSchema

### Server Actions
- [x] src/server/actions/auth-actions.ts — signUp (with rate limit, bcrypt hashing, auto workspace), signIn, signOut
- [x] src/server/actions/workspace-actions.ts — createWorkspace, updateWorkspace, inviteMember (crypto.randomUUID token, 7-day expiry), acceptInvite, changeMemberRole, removeMember
- [x] src/server/actions/project-actions.ts — createProject (seeds default statuses), updateProject, archiveProject (soft delete), toggleProjectFavorite
- [x] src/server/actions/issue-actions.ts — createIssue (atomic counter + transaction), updateIssue (optimistic locking, activity logging), deleteIssue (soft delete), moveIssue, reorderIssue
- [x] src/server/actions/comment-actions.ts — createComment, updateComment, deleteComment (author or ADMIN)
- [x] src/server/actions/label-actions.ts — createLabel, updateLabel, deleteLabel

### Server Queries
- [x] src/server/queries/workspace-queries.ts — getUserWorkspaces, getWorkspace, getWorkspaceMembers, getWorkspaceInvitations, checkSlugAvailability
- [x] src/server/queries/project-queries.ts — getProjects, getSidebarProjects, getProject, getProjectStatuses, getBoardData (server-side filtering), checkProjectKeyAvailability
- [x] src/server/queries/issue-queries.ts — getIssue, getIssuesByProject (paginated), getIssuesByStatus, searchIssues
- [x] src/server/queries/comment-queries.ts — getCommentsByIssue, getActivitiesByIssue
- [x] src/server/queries/label-queries.ts — getLabelsByWorkspace, getLabelsByProject
- [x] src/server/queries/dashboard-queries.ts — getDashboardData (aggregations by status category, priority, type)

### API Routes
- [x] src/app/api/search/route.ts — GET search endpoint for Cmd+K palette

### Frontend Compatibility Shims
- [x] src/server/queries/workspace.ts — Re-exports with aliases (getWorkspaceBySlug)
- [x] src/server/queries/project.ts — Re-exports with aliases (getProjectByKey)
- [x] src/server/queries/issue.ts — Re-exports with aliases (getIssueByKey, getProjectIssues)
- [x] src/server/queries/member.ts — Re-exports from workspace-queries
- [x] src/server/queries/label.ts — Re-exports with alias (getLabels)
- [x] src/server/queries/activity.ts — Re-exports from comment-queries
- [x] src/server/actions/workspace.ts — Re-exports all workspace actions

## Critique Revisions Applied
1. **Predictable invite tokens** — Using crypto.randomUUID(), 7-day expiry, single-use
2. **Unvalidated Tiptap JSON** — Created tiptapJsonSchema (recursive Zod type) replacing z.any()
3. **Zero rate limiting** — checkRateLimit helper with in-memory store for auth endpoints
4. **Systematic workspace isolation** — Every query/action validates workspace membership, all DB queries include workspaceId scope
5. **Soft-delete query exclusion** — deletedAt: null in all queries (plus Prisma middleware from DB builder)
6. **Server-side filtering** — getBoardData and getIssuesByProject accept filter params
7. **Weak password schema** — Min 8 chars with complexity regex (uppercase+lowercase+number+special)
8. **Slug immutability** — updateWorkspaceSchema omits slug field; project prefix not in updateProjectSchema
9. **No email enumeration** — signUp uses generic error timing patterns
10. **Optimistic locking** — updateIssue checks updatedAt field for conflict detection
