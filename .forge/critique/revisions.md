# Spec Revisions Required

Synthesized from SecurityCritic (28 findings), ArchCritic (22 findings), DXCritic (23 findings).

## CRITICAL (must address during build)

1. **Predictable invite tokens** — Use crypto.randomUUID() not nanoid, add expiry (48h), single-use
2. **Unvalidated Tiptap JSON (z.any())** — Create proper Zod schema for Tiptap JSON, sanitize on render with DOMPurify
3. **Stored XSS in rich text** — Sanitize HTML output from Tiptap before rendering, use DOMPurify
4. **Zero rate limiting** — Add rate limiting to auth endpoints, search, and issue creation (use upstash/ratelimit or middleware)
5. **No systematic workspace isolation** — Every DB query MUST include workspaceId filter; create a `withWorkspace()` wrapper for all queries
6. **Client-side filtering won't scale** — Board/list views must use server-side pagination and filtering, not client-side
7. **Contradictory board data ownership** — Use Server Components for initial load, TanStack Query for mutations/optimistic updates only
8. **No soft-delete query exclusion** — Add `where: { deletedAt: null }` to all default queries; create Prisma middleware

## RECOMMENDED (should address)

1. **Weak password schema** — Minimum 8 chars, require complexity (uppercase + number + special)
2. **Missing text search index** — Add PostgreSQL GIN index for full-text search on issue title/description
3. **Slug mutability** — Make workspace/project slugs immutable after creation
4. **N+1 activity log** — Batch activity log writes, use Prisma createMany
5. **Missing issue number composite index** — Add unique index on (projectId, issueNumber)
6. **Naming confusion (prefix/key/projectKey)** — Standardize to `projectKey` everywhere
7. **Remove orphaned contracts** — Remove status CRUD, bulk update from MVP scope
8. **Stringly-typed onFieldChange** — Use discriminated union types for field updates
9. **Add loading.tsx and not-found.tsx** — Required Next.js App Router conventions
10. **Brute-force protection** — Add exponential backoff on failed login attempts

## OPTIONAL (nice to have)
- Cookie security hardening (SameSite=Lax, Secure in prod)
- CSRF double-submit pattern
- Dependency injection for testable server actions
- Optimistic locking via `updatedAt` field comparison

## Cross-Critic Agreement
| Issue | Security | Architecture | DX |
|-------|----------|-------------|-----|
| z.any() Tiptap validation | CRITICAL | MEDIUM | HIGH |
| Workspace data isolation | CRITICAL | — | — |
| Client-side filtering at scale | — | CRITICAL | — |
| Naming inconsistency | — | MEDIUM | HIGH |
| Rate limiting | CRITICAL | — | — |
| Soft-delete query gaps | — | CRITICAL | — |
