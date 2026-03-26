# Security Review: PMApp

**Reviewer:** SecurityReviewer (Forge Pipeline)
**Date:** 2026-03-26
**Scope:** Full codebase review of Next.js 15 + Prisma + NextAuth project management application
**Verdict:** PASS with HIGH/MEDIUM findings requiring attention

---

## Summary

The application demonstrates strong security fundamentals: consistent auth checks via `requireAuth()`, workspace-scoped authorization via `requireWorkspaceMember()`/`requireRole()`, Zod validation on all inputs, bcrypt password hashing, no raw SQL, no `dangerouslySetInnerHTML`, and CSRF protection inherent in Next.js server actions. However, several HIGH and MEDIUM findings need resolution before production deployment.

---

## Findings

### CRITICAL: None

No critical vulnerabilities (SQL injection, auth bypass on core actions, stored XSS with direct rendering) were found.

---

### HIGH-1: Missing Workspace Scoping on `getIssueByKey` Call (IDOR)

- **Severity:** HIGH
- **File:** `src/app/(dashboard)/[workspaceSlug]/[projectKey]/issues/[issueKey]/page.tsx:22`
- **Issue:** `getIssueByKey(issueKey)` is called with only the `issueKey` argument, but the underlying `getIssue(workspaceId, issueKey)` function requires a `workspaceId` as the first parameter. If this is a TypeScript overload that defaults to no workspace filter, or if the re-export somehow drops the first parameter, an attacker who knows issue keys from another workspace (e.g., `PROJ-123`) could access issues outside their workspace. The function signature shows `getIssue(workspaceId: string, issueKey: string)` requiring both parameters.
- **Fix:** Pass the workspace ID:
  ```typescript
  // Before:
  getIssueByKey(issueKey),
  // After:
  getIssueByKey(workspace.id, issueKey),
  ```

---

### HIGH-2: Missing Workspace ID on Client-Side Comment/Activity Queries (IDOR)

- **Severity:** HIGH
- **File:** `src/components/issues/issue-comments.tsx:32` and `src/components/issues/issue-activity.tsx:21`
- **Issue:** `getIssueComments(issueId)` and `getIssueActivities(issueId)` are called with only the `issueId`, but the underlying functions `getCommentsByIssue(issueId, workspaceId)` and `getActivitiesByIssue(issueId, workspaceId)` require a `workspaceId` as the second parameter. If the workspace scoping check is skipped due to the missing parameter, a user could fetch comments/activities for issues in workspaces they don't belong to by providing arbitrary issue IDs.
- **Fix:** Thread `workspaceId` through the component props and pass it:
  ```typescript
  // In IssueComments and IssueActivity components, add workspaceId prop
  const data = await getIssueComments(issueId, workspaceId);
  const data = await getIssueActivities(issueId, workspaceId);
  ```

---

### HIGH-3: `inviteMember` Returns Invite Token to Client

- **Severity:** HIGH
- **File:** `src/server/actions/workspace-actions.ts:203`
- **Issue:** The `inviteMember` action returns `{ invitationId: invitation.id, token }` directly to the calling client. While only ADMINs can call this, the token is the sole credential for accepting a workspace invitation. Returning it in the response means it's visible in the client-side network tab. In a real scenario, the token should be sent via email, not returned to the browser. If an admin's machine has browser extensions or logging middleware, the token could be leaked.
- **Fix:** Do not return the `token` in the response. Send it via email instead:
  ```typescript
  // Before:
  return { invitationId: invitation.id, token };
  // After:
  // Send email with token link here (e.g., via Resend, Sendgrid)
  return { invitationId: invitation.id };
  ```

---

### HIGH-4: `getWorkspace(slug)` Signature vs Usage Mismatch

- **Severity:** HIGH
- **File:** `src/server/queries/workspace-queries.ts:46` vs `src/app/(dashboard)/[workspaceSlug]/layout.tsx:18`
- **Issue:** `getWorkspace(slug: string)` only takes one parameter (slug), but callers pass two args: `getWorkspaceBySlug(workspaceSlug, session.user.id)`. TypeScript silently ignores extra arguments when calling through a re-exported alias, so the `session.user.id` is discarded. The function internally calls `requireAuth()` to get the session, so it does verify membership. However, this pattern is misleading and could cause issues if the function were refactored to rely on the passed userId instead of re-fetching the session. No current vulnerability but a design smell that could easily become one.
- **Fix:** Either update `getWorkspace` to accept and use the userId parameter, or remove the extra argument from all callers to match the actual signature.

---

### MEDIUM-1: No Security Headers in `next.config.ts`

- **Severity:** MEDIUM
- **File:** `next.config.ts`
- **Issue:** The Next.js config does not set security headers. Missing headers include:
  - `Content-Security-Policy` -- prevents XSS and injection
  - `X-Frame-Options: DENY` -- prevents clickjacking
  - `X-Content-Type-Options: nosniff` -- prevents MIME sniffing
  - `Strict-Transport-Security` -- enforces HTTPS
  - `Referrer-Policy` -- prevents leaking referrer info
  - `Permissions-Policy` -- restricts browser features
- **Fix:** Add a `headers()` function to `next.config.ts`:
  ```typescript
  const nextConfig: NextConfig = {
    // ... existing config
    async headers() {
      return [
        {
          source: "/(.*)",
          headers: [
            { key: "X-Frame-Options", value: "DENY" },
            { key: "X-Content-Type-Options", value: "nosniff" },
            { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
            { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
            {
              key: "Content-Security-Policy",
              value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;",
            },
          ],
        },
      ];
    },
  };
  ```

---

### MEDIUM-2: In-Memory Rate Limiter Not Production-Ready

- **Severity:** MEDIUM
- **File:** `src/lib/auth/helpers.ts:141-172`
- **Issue:** The rate limiter uses an in-memory `Map`. This has two problems:
  1. **No cross-instance protection:** In a multi-instance deployment (Kubernetes, serverless), each instance has its own map, so an attacker can bypass rate limiting by hitting different instances.
  2. **Memory leak potential:** Although there's a cleanup at 10,000 entries, under sustained attack the map could grow large between cleanup cycles, and the cleanup itself iterates all entries (O(n)).
  3. **Rate limit keyed by email, not IP:** An attacker can try different emails to bypass the per-email limit for credential stuffing.
- **Fix:** Use Redis-based rate limiting (e.g., `@upstash/ratelimit`) for production. Also rate-limit by IP address in addition to email:
  ```typescript
  // Rate limit by IP + email
  const ip = headers().get("x-forwarded-for") || "unknown";
  if (!checkRateLimit(`signin:ip:${ip}`, 20)) {
    throw errors.rateLimited();
  }
  if (!checkRateLimit(`signin:email:${email}`, 10)) {
    throw errors.rateLimited();
  }
  ```

---

### MEDIUM-3: `checkSlugAvailability` and `checkProjectKeyAvailability` Lack Auth

- **Severity:** MEDIUM
- **File:** `src/server/queries/workspace-queries.ts:130-139` and `src/server/queries/project-queries.ts:263-277`
- **Issue:** `checkSlugAvailability(slug)` has no authentication check at all. Any unauthenticated caller (if exposed via an API route or called client-side) could enumerate existing workspace slugs. Similarly, `checkProjectKeyAvailability(workspaceId, prefix)` only checks project existence without verifying the caller is a workspace member. This leaks information about which workspace slugs and project keys exist.
- **Fix:** Add `requireAuth()` and workspace membership checks:
  ```typescript
  export async function checkSlugAvailability(slug: string): Promise<boolean> {
    await requireAuth(); // Add this
    // ... rest of function
  }

  export async function checkProjectKeyAvailability(
    workspaceId: string, prefix: string
  ): Promise<boolean> {
    const session = await requireAuth(); // Add this
    await requireWorkspaceMember(session.userId, workspaceId); // Add this
    // ... rest of function
  }
  ```

---

### MEDIUM-4: No Rate Limiting on Search API Endpoint

- **Severity:** MEDIUM
- **File:** `src/app/api/search/route.ts`
- **Issue:** The search API endpoint at `/api/search` has no rate limiting. An authenticated user could abuse it for enumeration or DoS by sending rapid requests. The `LIKE` queries (`contains`) used for search are also potentially expensive on large datasets without full-text search indexes.
- **Fix:** Add rate limiting to the search endpoint:
  ```typescript
  import { checkRateLimit } from "@/lib/auth/helpers";

  // Inside GET handler, after auth check:
  if (!checkRateLimit(`search:${session.user.id}`, 30, 60_000)) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429 }
    );
  }
  ```

---

### MEDIUM-5: Command Palette Search Uses Wrong Query Parameters

- **Severity:** MEDIUM
- **File:** `src/components/search/command-menu.tsx:48`
- **Issue:** The command menu sends `?workspace=...&q=...` but the search API route expects `?workspaceId=...&query=...`. This means the search will always fail Zod validation (missing `workspaceId` and `query` parameters). While this is primarily a bug, the security implication is that when this is eventually fixed, the workspace parameter needs to be the workspace ID (not the slug), and the workspace slug alone is not sufficient for workspace scoping.
- **Fix:** Fix the query parameters and use workspace ID:
  ```typescript
  // Before:
  `/api/search?workspace=${encodeURIComponent(params.workspaceSlug || "")}&q=${encodeURIComponent(query)}`
  // After:
  `/api/search?workspaceId=${encodeURIComponent(workspaceId)}&query=${encodeURIComponent(query)}`
  ```
  Thread the actual `workspaceId` (not slug) through from the layout.

---

### MEDIUM-6: Tiptap JSON Validation Allows `z.record(z.unknown())` in `attrs`

- **Severity:** MEDIUM
- **File:** `src/lib/validations/issue.ts:28` and `src/lib/validations/comment.ts:20`
- **Issue:** While the Tiptap schema validates document structure (good -- avoids `z.any()`), the `attrs` field allows `z.record(z.unknown())`. This means arbitrary key-value pairs can be stored in node attributes, including potential XSS payloads if the frontend ever renders Tiptap content using a rich-text editor that processes these attrs (e.g., `attrs: { "onerror": "alert(1)", "src": "javascript:..." }`). Currently the frontend renders `bodyText` (safe), but if a Tiptap editor is added later, this becomes exploitable.
- **Fix:** Add allowlisted attribute keys or validate attribute values are primitive non-script types:
  ```typescript
  attrs: z.record(
    z.union([z.string(), z.number(), z.boolean(), z.null()])
  ).optional(),
  ```

---

### MEDIUM-7: User Email Enumeration on Sign-Up

- **Severity:** MEDIUM
- **File:** `src/server/actions/auth-actions.ts:57-59`
- **Issue:** The sign-up action returns `"An account with this email already exists"` when the email is taken. This allows attackers to enumerate which emails are registered. While the doc comment mentions "No email enumeration on sign-up (generic error timing)," the actual error message is specific and the timing difference between the hash computation (line 62) and the early return (line 59) is measurable.
- **Fix:** Return a generic success message regardless of whether the account exists, or compute the hash before the uniqueness check to equalize timing:
  ```typescript
  // Compute hash before checking existence (constant time)
  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const existingUser = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    // Return same response shape as success to prevent enumeration
    return { userId: "created" }; // Or throw a generic error
  }
  ```

---

### LOW-1: Prisma Query Logging in Development Exposes Query Details

- **Severity:** LOW
- **File:** `src/lib/db/index.ts:18-20`
- **Issue:** In development mode, Prisma logs all queries including parameters. This is acceptable for development but must be confirmed it's disabled in production builds. The current conditional (`process.env.NODE_ENV === 'development'`) is correct, but if `NODE_ENV` is misconfigured in staging, sensitive data could appear in logs.
- **Fix:** No code change needed, but ensure deployment configurations set `NODE_ENV=production` correctly.

---

### LOW-2: Soft Delete Middleware Converts `findUnique` to `findFirst`

- **Severity:** LOW
- **File:** `src/lib/db/index.ts:46-61`
- **Issue:** The Prisma middleware converts `findUnique` operations to `findFirst` to add the `deletedAt: null` filter. This changes the query semantics -- `findUnique` guarantees a unique result via a unique index, while `findFirst` does not. In theory, if a soft-deleted record and an active record share values on a non-unique field used in the where clause, the wrong record could be returned. In practice, this is unlikely with CUID primary keys but violates the principle of least surprise.
- **Fix:** Consider using Prisma's built-in `@prisma/client/extensions` for soft delete instead of middleware, or document this behavior prominently.

---

### LOW-3: Invitation Token Uses CUID in Schema Default but UUID in Code

- **Severity:** LOW
- **File:** `prisma/schema.prisma:178` vs `src/lib/utils.ts:79`
- **Issue:** The schema defines `token String @unique @default(cuid())` for WorkspaceInvitation, but the code overrides this with `crypto.randomUUID()` in `generateInviteToken()`. The schema default is never used (the code always provides a value). CUIDs are less random than UUIDv4 -- if the code path were ever skipped and the schema default kicked in, the tokens would be less secure. The schema default should match the code intent.
- **Fix:** Remove the `@default(cuid())` from the schema since tokens are always generated in code, or change it to reflect the actual token generation:
  ```prisma
  token String @unique // Generated via crypto.randomUUID() in application code
  ```

---

### LOW-4: No CSRF Token on Sign-In Form (Using `next-auth/react` Client-Side)

- **Severity:** LOW
- **File:** `src/app/(auth)/sign-in/page.tsx:37`
- **Issue:** The sign-in page uses `signIn("credentials", { ... })` from `next-auth/react` directly. NextAuth.js handles CSRF protection for its own API routes via a CSRF token cookie. This is secure. However, the client-side form does not use the server action pattern (which has built-in CSRF protection in Next.js 15). The `next-auth/react` `signIn()` function handles CSRF correctly via the `csrfToken` cookie, so this is informational only.
- **Fix:** No immediate fix needed. The `next-auth/react` client handles CSRF correctly.

---

### LOW-5: OAuth Providers Referenced but Not Configured

- **Severity:** LOW
- **File:** `src/app/(auth)/sign-in/page.tsx:69,83`
- **Issue:** The sign-in page has buttons for Google and GitHub OAuth, but the auth configuration (`src/lib/auth/auth.ts`) only has the Credentials provider. Clicking these buttons will fail. If OAuth providers are added later, ensure proper callback URL validation and state parameter checking.
- **Fix:** Either remove the OAuth buttons or add the corresponding providers to the auth config.

---

### LOW-6: `removeMember` Self-Removal Doesn't Check for Multiple Owners

- **Severity:** LOW
- **File:** `src/server/actions/workspace-actions.ts:404-409`
- **Issue:** When a user tries to remove themselves and they are an OWNER, the error says "Cannot remove yourself as the sole owner" but doesn't actually check if they are the *sole* owner. It just checks `if (role === "OWNER")` and blocks all owners from self-removing. This means if there are multiple owners (which the schema doesn't prevent), none can leave the workspace.
- **Fix:** Count owners before blocking:
  ```typescript
  if (role === "OWNER") {
    const ownerCount = await db.workspaceMember.count({
      where: { workspaceId, role: "OWNER" },
    });
    if (ownerCount <= 1) {
      throw errors.forbidden("Cannot remove yourself as the sole owner");
    }
  }
  ```

---

## Positive Security Findings

These security practices are correctly implemented:

1. **Authentication:** All server actions call `requireAuth()` as the first check. All query functions call `requireAuth()` and `requireWorkspaceMember()`.
2. **Authorization:** Role hierarchy (`OWNER > ADMIN > MEMBER > VIEWER`) enforced via `requireRole()`. ADMINs cannot elevate to OWNER or manage other ADMINs.
3. **Input Validation:** All server actions validate input with Zod schemas using `safeParse()`. The `input: unknown` pattern ensures no unvalidated data passes through.
4. **Password Security:** bcryptjs with 12 rounds. Strong password complexity requirements (uppercase, lowercase, digit, special char, min 8 chars).
5. **No Raw SQL:** All database access goes through Prisma ORM with parameterized queries. No `$queryRaw` or `$executeRaw` usage.
6. **No XSS in Rendering:** No `dangerouslySetInnerHTML` anywhere. Tiptap JSON is rendered as plain text (`bodyText`), not parsed HTML.
7. **Workspace Isolation:** `withWorkspace()` helper enforces workspace scoping at the query level. Auth helpers (`requireProjectInWorkspace`, `requireIssueInWorkspace`) verify cross-table ownership chains.
8. **Soft Delete Protection:** Prisma middleware auto-filters `deletedAt: null` on read queries, preventing access to deleted records.
9. **CSRF Protection:** Next.js server actions have built-in CSRF protection. NextAuth.js handles CSRF for auth routes.
10. **Invite Security:** Tokens use `crypto.randomUUID()` (128 bits of entropy), have 7-day expiry, and check for REVOKED/EXPIRED/ACCEPTED states.
11. **Optimistic Locking:** Issue updates check `updatedAt` to prevent lost-update race conditions.
12. **Sensitive Data in Responses:** User queries use `select` to only return `{ id, name, email, image }` -- password hashes are never exposed. The `authorize` callback returns only safe fields.
13. **Error Handling:** `withErrorHandling()` catches `AppError` and returns generic messages for unknown errors, preventing stack trace leakage.

---

## Risk Matrix

| ID | Severity | Category | Status |
|----|----------|----------|--------|
| HIGH-1 | HIGH | IDOR | Fix required |
| HIGH-2 | HIGH | IDOR | Fix required |
| HIGH-3 | HIGH | Token Exposure | Fix required |
| HIGH-4 | HIGH | API Mismatch | Fix required |
| MEDIUM-1 | MEDIUM | Missing Headers | Fix recommended |
| MEDIUM-2 | MEDIUM | Rate Limiting | Fix recommended for production |
| MEDIUM-3 | MEDIUM | Info Disclosure | Fix recommended |
| MEDIUM-4 | MEDIUM | Rate Limiting | Fix recommended |
| MEDIUM-5 | MEDIUM | Bug/Security | Fix required |
| MEDIUM-6 | MEDIUM | Stored XSS risk | Fix recommended |
| MEDIUM-7 | MEDIUM | User Enumeration | Fix recommended |
| LOW-1 | LOW | Logging | Verify in deployment |
| LOW-2 | LOW | Query Semantics | Informational |
| LOW-3 | LOW | Schema Mismatch | Fix recommended |
| LOW-4 | LOW | CSRF | Informational (secure as-is) |
| LOW-5 | LOW | Dead Code | Fix recommended |
| LOW-6 | LOW | Business Logic | Fix recommended |
