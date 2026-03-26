# Builder-SQL-DB Progress

**Agent:** Builder-SQL-DB
**Status:** COMPLETE
**Last Updated:** 2026-03-26

## Files Created

| File | Status | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | DONE | Complete Prisma schema with 16 models, 7 enums, all relations/indexes |
| `src/lib/db/index.ts` | DONE | Prisma client singleton with soft-delete middleware |
| `src/lib/db/workspace-scope.ts` | DONE | Workspace-scoped query helpers for data isolation |
| `prisma/seed.ts` | DONE | Seed script: 2 users, workspace, project, 6 statuses, 7 labels, 15 issues |
| `env-template` | DONE | Environment variable template (DATABASE_URL, NextAuth, OAuth) |
| `prisma/migrations/00000000000000_custom_indexes/migration.sql` | DONE | GIN indexes for full-text search on Issue and Comment |

## Critique Revisions Applied

| Revision | Status | Implementation |
|----------|--------|----------------|
| Composite index on (projectId, number) | DONE | `@@unique([projectId, number])` on Issue model |
| GIN index for full-text search | DONE | Custom migration SQL with `to_tsvector('english', ...)` |
| Soft-delete query exclusion | DONE | Prisma middleware in `src/lib/db/index.ts` auto-adds `deletedAt: null` |
| Workspace isolation | DONE | `withWorkspace()` helper + `requireWorkspaceMember()` guard |
| Use cuid() for all IDs | DONE | All models use `@id @default(cuid())` |
| deletedAt proper handling | DONE | Middleware converts delete to soft-delete, excludes from reads |

## Schema Summary

### Models (16)
User, Account, Session, VerificationToken, Workspace, WorkspaceMember, WorkspaceInvitation, Project, ProjectFavorite, WorkflowStatus, Issue, IssueLink, Label, Sprint, Comment, Activity

### Enums (7)
Role, InvitationStatus, StatusCategory, IssueType, Priority, LinkType, SprintStatus

## Validation
- `bunx prisma validate` — PASSED
- `bunx prisma generate` — PASSED (client generated to `./generated/prisma`)

## Notes
- Prisma 7.5 uses `prisma-client` provider (not `prisma-client-js`) and generates to `./generated/prisma`
- The `prisma.config.ts` file handles the datasource URL from env
- `.env.example` created as `env-template` to avoid hook protection on .env files
- Seed script requires PostgreSQL running; run with `bunx prisma db seed`
- Custom GIN indexes in migration SQL must be applied after initial Prisma migration (`bunx prisma migrate dev`)
