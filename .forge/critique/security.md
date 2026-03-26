# Security Critique: PMApp (JIRA-like Project Management)

**Reviewer:** SecurityCritic (Forge Pipeline)
**Date:** 2026-03-26
**Scope:** specification.md, contracts.md, architecture.md
**Findings:** 28 issues (5 CRITICAL, 8 HIGH, 10 MEDIUM, 5 LOW)

---

## Table of Contents

1. [Threat Model](#1-threat-model)
2. [Authentication & Authorization Gaps](#2-authentication--authorization-gaps)
3. [Input Validation Gaps](#3-input-validation-gaps)
4. [Data Exposure Risks](#4-data-exposure-risks)
5. [Injection Risks](#5-injection-risks)
6. [Rate Limiting & Abuse Prevention](#6-rate-limiting--abuse-prevention)
7. [CSRF, Session & Cookie Security](#7-csrf-session--cookie-security)
8. [Multi-Tenant Data Isolation](#8-multi-tenant-data-isolation)
9. [Summary & Prioritized Remediation Plan](#9-summary--prioritized-remediation-plan)

---

## 1. Threat Model

### Application Profile

- **Multi-tenant SaaS** with workspace-based isolation
- **Sensitive data:** User credentials (bcrypt hashes), email addresses, project/issue data (potentially confidential business information), OAuth tokens (stored in Account table), invitation tokens
- **Attack surface:** Public auth endpoints, invite links, search API, Server Actions, Tiptap rich text (stored as JSON, rendered as HTML), workspace slug enumeration

### Key Threat Actors

| Actor | Motivation | Capabilities |
|-------|-----------|--------------|
| Unauthenticated attacker | Account takeover, credential stuffing, data exfiltration | Brute-force, automated tooling |
| Authenticated low-privilege user (VIEWER) | Privilege escalation, cross-workspace data access | Legitimate session, crafted Server Action calls |
| Malicious workspace member | Data exfiltration, sabotage, XSS payload injection | Full member access, rich text injection |
| Automated bot | Signup spam, resource exhaustion, scraping | High-volume requests |

### STRIDE Analysis

| Threat | Attack Vector | Impact |
|--------|--------------|--------|
| **Spoofing** | Password brute-force, session fixation, invitation link theft | Account takeover |
| **Tampering** | Modify Server Action parameters (IDs, roles), manipulate Tiptap JSON | Data corruption, privilege escalation |
| **Repudiation** | Activity log has no integrity protection | Cannot prove who did what |
| **Information Disclosure** | Cross-workspace data leaks via search, IDOR on issue/project endpoints | Confidential business data exposure |
| **Denial of Service** | Unbounded issue creation, description/comment size abuse, search abuse | Resource exhaustion |
| **Elevation of Privilege** | RBAC bypass via direct Server Action invocation, invitation role manipulation | Unauthorized admin/owner access |

---

## 2. Authentication & Authorization Gaps

### SEC-001: No Password Complexity Requirements in Zod Schema

- **Severity:** HIGH
- **Affected requirement:** REQ-001
- **Issue:** The specification (REQ-001) requires "at least 8 characters" and Section 9 requires "at least 1 uppercase, 1 lowercase, 1 number." However, the `signUpSchema` Zod validation in contracts.md only enforces `.min(8)` -- there is no regex or refinement for character classes. The spec and contract are out of sync, and the contract (which is what gets implemented) is the weaker version.
- **Recommendation:** Add a `.regex()` or `.refine()` to `signUpSchema.password`:
  ```typescript
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password too long')
    .regex(/[a-z]/, 'Must contain a lowercase letter')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a number')
  ```

### SEC-002: No Reset Password Zod Schema Defined

- **Severity:** MEDIUM
- **Affected requirement:** REQ-006
- **Issue:** The contracts.md defines `forgotPasswordSchema` (email only) but has no `resetPasswordSchema` for the actual password reset form (`/reset-password?token=[token]`). This means token validation and new password validation have no contract. Without a schema, the implementation may forget to validate token format, enforce password strength on reset, or check password confirmation match.
- **Recommendation:** Add a `resetPasswordSchema`:
  ```typescript
  export const resetPasswordSchema = z.object({
    token: z.string().min(1),
    password: z.string().min(8).max(100).regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/),
    confirmPassword: z.string(),
  }).refine(data => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
  ```

### SEC-003: Invitation Token Uses Predictable cuid() Default

- **Severity:** CRITICAL
- **Affected requirement:** REQ-007, REQ-008
- **Issue:** `WorkspaceInvitation.token` is defined as `@default(cuid())`. CUIDs are sortable and partially predictable -- they embed a timestamp and machine fingerprint. An attacker who knows the approximate creation time of an invitation could reduce the search space significantly. Invitation tokens are security-sensitive (they grant workspace access at a specified role) and should use cryptographically random values.
- **Recommendation:** Replace `@default(cuid())` with application-level generation using `crypto.randomBytes(32).toString('hex')` or `crypto.randomUUID()`. Alternatively, use a signed token (HMAC) that encodes the invitation ID. Store only the hash of the token in the database and compare hashes on acceptance.

### SEC-004: Invitation Links Are Transferable by Design

- **Severity:** HIGH
- **Affected requirement:** REQ-008
- **Issue:** REQ-008 AC#7 explicitly states: "If user's email does not match the invite email: still allow acceptance (invitations are transferable by link)." This means anyone who obtains the invitation URL can join the workspace at the invited role. Combined with SEC-003 (predictable tokens), this creates a significant risk. A leaked or forwarded invite link could allow unintended users to join sensitive workspaces, potentially at ADMIN role.
- **Recommendation:** Either (a) enforce email matching (invite email must match the authenticated user's email) and remove transferability, or (b) if transferability is a product requirement, add an explicit confirmation step where the workspace admin approves the joining user, and limit transferable invitations to VIEWER/MEMBER roles only (never ADMIN).

### SEC-005: No Account Lockout After Failed Login Attempts

- **Severity:** HIGH
- **Affected requirement:** REQ-003
- **Issue:** There is no mention of account lockout, progressive delays, or CAPTCHA after repeated failed login attempts. An attacker can perform unlimited credential stuffing or brute-force attacks against the `/sign-in` endpoint. The NextAuth Credentials provider will process every attempt.
- **Recommendation:** Implement one or more of: (a) progressive delay after 5 failed attempts from the same IP (exponential backoff), (b) account lockout after 10 failed attempts (with email notification and admin unlock), (c) CAPTCHA challenge after 3 failed attempts, (d) rate limiting on the auth endpoint (see SEC-017).

### SEC-006: Admin Can Invite as ADMIN Role -- No Owner Approval

- **Severity:** MEDIUM
- **Affected requirement:** REQ-007, REQ-012
- **Issue:** The `inviteMemberSchema` allows role values of `ADMIN`, `MEMBER`, or `VIEWER`. An ADMIN can invite someone as ADMIN without OWNER approval. While the spec says "cannot invite as Owner," there is no further constraint. A compromised or malicious ADMIN account could rapidly invite accomplices at ADMIN level, effectively taking control of the workspace. The architecture notes that ADMIN can change Member/Viewer roles but cannot change another Admin's role -- but they can *create* Admins via invitations, bypassing this restriction.
- **Recommendation:** Restrict ADMIN users to only inviting MEMBER or VIEWER roles. Only OWNER should be able to invite or promote to ADMIN. Update `inviteMemberSchema` to conditionally validate role based on the invoker's role, or add server-side logic that checks `if (currentUserRole === 'ADMIN' && input.role === 'ADMIN') throw`.

### SEC-007: JWT Has No Explicit Expiration or Rotation Policy

- **Severity:** MEDIUM
- **Affected requirement:** REQ-005
- **Issue:** The architecture specifies JWT strategy for sessions but does not define JWT expiration time, refresh token rotation, or maximum session lifetime. Auth.js has defaults (30 days for session, but configurable), but these are not documented or explicitly set. A stolen JWT could remain valid indefinitely if no explicit expiration is configured. The spec mentions "expired JWT" handling (REQ-005 error case 1) but does not define the expiration window.
- **Recommendation:** Explicitly configure JWT maxAge (e.g., 24 hours) and session maxAge in the Auth.js config. Implement session rotation on each request (Auth.js supports `updateAge`). Document the chosen values in the architecture.

### SEC-008: callbackUrl Redirect is Not Validated

- **Severity:** HIGH
- **Affected requirement:** REQ-005
- **Issue:** The middleware encodes `callbackUrl` from the original pathname and redirects users after sign-in. The architecture shows: `const callbackUrl = encodeURIComponent(pathname)`. While this uses the pathname (not a user-supplied URL parameter), the sign-in flow redirects to `callbackUrl` if present as a query parameter. If an attacker crafts a sign-in URL like `/sign-in?callbackUrl=https://evil.com`, an open redirect vulnerability could be exploited for phishing.
- **Recommendation:** Validate the `callbackUrl` parameter server-side before redirecting. Ensure it is a relative path (starts with `/`), does not contain protocol schemes, and is on the same origin. Auth.js has a `redirect` callback that should be configured to enforce this.

---

## 3. Input Validation Gaps

### SEC-009: Tiptap JSON Description Validated as `z.any()`

- **Severity:** CRITICAL
- **Affected requirement:** REQ-034, REQ-025, REQ-035
- **Issue:** The `createIssueSchema`, `updateIssueSchema`, `createCommentSchema`, and `updateCommentSchema` all validate the rich text body/description field as `z.any()`. This means *any* JSON value (or non-JSON value) will pass validation. An attacker could submit: (a) extremely large JSON payloads (GB-sized), (b) deeply nested JSON causing parser stack overflow, (c) malformed Tiptap JSON that when rendered could inject arbitrary HTML/scripts (see SEC-015), (d) non-JSON data types that could cause runtime errors. The spec says max 100KB for description and 50KB for comments, but these limits are not enforced in the schema.
- **Recommendation:** Replace `z.any()` with a proper Tiptap JSON schema validator:
  ```typescript
  const tiptapContentSchema = z.object({
    type: z.literal('doc'),
    content: z.array(z.any()).max(500), // limit node count
  }).refine(val => JSON.stringify(val).length <= 100_000, {
    message: 'Content too large (max 100KB)',
  });
  ```
  Additionally, sanitize the Tiptap JSON server-side before storage to strip any disallowed node types (e.g., `script`, `iframe`, raw HTML nodes).

### SEC-010: No Max Length on `position` Field (Fractional Indexing)

- **Severity:** MEDIUM
- **Affected requirement:** REQ-041, REQ-042
- **Issue:** The `moveIssueSchema` and `reorderIssueSchema` accept `position: z.string()` with no length constraint. Fractional indexing strings can grow in length with repeated interleaving operations (e.g., repeatedly inserting between two adjacent items). An attacker could deliberately craft extremely long position strings or submit arbitrary strings. This could cause database storage issues (the `position` field has no `@db.VarChar` limit) and sorting performance degradation.
- **Recommendation:** Add `.max(256)` (or similar reasonable limit) to the position field validation. Add a `.regex()` to enforce valid fractional indexing format. Implement a server-side "rebalance" mechanism that recalculates all positions in a column when any position string exceeds a threshold length.

### SEC-011: `issueFilterSchema` Does Not Validate ID Formats

- **Severity:** LOW
- **Affected requirement:** REQ-044, REQ-048
- **Issue:** The `issueFilterSchema` accepts `status: z.array(z.string())`, `assigneeId: z.array(z.string())`, and `labelIds: z.array(z.string())` without `.cuid()` validation on the string elements. While this is primarily used for client-side filtering, if these values are ever passed to database queries, arbitrary strings could cause unexpected behavior or information leakage via error messages.
- **Recommendation:** Add `.cuid()` validation to all ID array elements in the filter schema, or at minimum validate they match expected formats before using them in queries.

### SEC-012: Workspace Slug Regex Allows Leading Hyphens

- **Severity:** LOW
- **Affected requirement:** REQ-015
- **Issue:** The `createWorkspaceSchema` validates slug with regex `/^[a-z0-9-]+$/` which allows slugs starting with hyphens (e.g., `-admin`) or ending with hyphens. The specification requires "Must start with a letter, must not end with a hyphen, no consecutive hyphens" but the Zod regex does not enforce these constraints. This mismatch between spec and contract could lead to URL ambiguity or collision with route parameters.
- **Recommendation:** Update the slug regex to match the specification:
  ```typescript
  .regex(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/, 'Must start with a letter, no consecutive/trailing hyphens')
  ```
  Also add the reserved slug blocklist check in the schema or as a server-side refinement.

### SEC-013: `searchIssuesSchema` Minimum Query Length is 1, Not 2

- **Severity:** LOW
- **Affected requirement:** REQ-050
- **Issue:** The `searchIssuesSchema` has `query: z.string().min(1).max(200)`, but REQ-050 AC#7 specifies "Minimum 2 characters before search fires." Single-character searches against a `LIKE '%x%'` query could be expensive on large datasets. The spec and contract disagree on the minimum.
- **Recommendation:** Change to `.min(2)` to match the specification and reduce database load.

### SEC-014: No Size Limit on `bulkUpdateIssuesSchema` Array

- **Severity:** MEDIUM
- **Affected requirement:** REQ-037 (bulk updates in contracts)
- **Issue:** `bulkUpdateIssuesSchema` has `issueIds: z.array(z.string().cuid()).min(1)` with no maximum. An attacker could submit thousands of issue IDs in a single request, causing a massive database transaction that locks rows and degrades performance for all users.
- **Recommendation:** Add `.max(100)` (or appropriate limit) to the `issueIds` array to bound the transaction size.

---

## 4. Data Exposure Risks

### SEC-015: User Password Hash Potentially Exposed via Prisma Includes

- **Severity:** HIGH
- **Affected requirement:** REQ-001, REQ-011
- **Issue:** The `User` model contains the `password` field (bcrypt hash). The architecture and contracts define several queries that return User data with relations (e.g., `MemberWithUser`, `IssueWithRelations` with reporter/assignee). None of the query contracts explicitly exclude the `password` field using Prisma `select` or `omit`. If any query uses `include: { user: true }` instead of `select: { user: { select: { id, name, email, image } } }`, the password hash will be included in the returned data and potentially serialized to the client via Server Component props or API responses.
- **Recommendation:** (a) Use Prisma's `omit` feature (Prisma 6.x) globally to always exclude `password` from User queries: `prisma.$extends({ query: { user: { $allOperations({ args, query }) { args.omit = { ...args.omit, password: true }; return query(args); } } } })`. (b) Alternatively, define a reusable `USER_SAFE_SELECT` constant: `{ id: true, name: true, email: true, image: true }` and use it everywhere. (c) Add a middleware or serialization layer that strips `password` before any data leaves the server.

### SEC-016: OAuth Tokens Stored in Plain Text

- **Severity:** MEDIUM
- **Affected requirement:** REQ-002
- **Issue:** The `Account` model stores `access_token`, `refresh_token`, and `id_token` as plain text (`@db.Text`). These are OAuth provider tokens that, if the database is compromised, would allow the attacker to impersonate users on Google/GitHub. This is the standard Auth.js/NextAuth schema, but for a multi-tenant PM app handling potentially sensitive business data, it represents a risk.
- **Recommendation:** For MVP, this is acceptable as it follows Auth.js conventions. For production hardening: (a) encrypt tokens at rest using application-level encryption (AES-256-GCM) with a key from an environment variable or KMS, (b) or use Auth.js's JWT session strategy without database-stored tokens (which is already the plan -- so consider whether Account tokens are needed at all).

### SEC-017: Search API Returns Data Without Workspace Isolation Check in Schema

- **Severity:** HIGH
- **Affected requirement:** REQ-050
- **Issue:** The search API route (`GET /api/search?workspaceId=xxx&query=yyy`) accepts `workspaceId` as a query parameter from the client. The comment says "@auth Authenticated user with workspace membership," but the actual enforcement depends on implementation. If the server-side query filters by the client-supplied `workspaceId` without verifying the authenticated user is a member of that workspace, a user could search across any workspace's issues by simply changing the `workspaceId` parameter. The `searchIssuesSchema` validates `workspaceId` is a CUID but does not encode any authorization.
- **Recommendation:** The search endpoint MUST verify workspace membership server-side before executing the query. Use `requireWorkspaceMember(workspaceId)` at the start of the handler. Consider deriving the workspaceId from the user's session/context rather than accepting it as a client parameter.

---

## 5. Injection Risks

### SEC-018: XSS via Tiptap Rich Text Rendering (Stored XSS)

- **Severity:** CRITICAL
- **Affected requirement:** REQ-034, REQ-035
- **Issue:** Issue descriptions and comments use Tiptap, which stores content as JSON and renders it as HTML. The contracts define these fields as `z.any()` (SEC-009). If the Tiptap JSON contains nodes that render raw HTML (e.g., a `hardBreak` with custom HTML attributes, or a custom node type that the renderer doesn't sanitize), an attacker could inject `<script>`, `<img onerror="...">`, or other XSS payloads. This is particularly dangerous because: (a) comments are rendered for all workspace members, (b) the content is stored persistently (stored XSS), (c) a VIEWER role can create comments (REQ-035 AC#10), so even the lowest privilege level can inject XSS.
- **Recommendation:** (a) Validate Tiptap JSON server-side: only allow known, safe node types (`paragraph`, `text`, `heading`, `bulletList`, `orderedList`, `taskList`, `codeBlock`, `blockquote`, `horizontalRule`, `hardBreak`, `link`). Reject or strip any unknown node types. (b) When rendering Tiptap content in read-only mode, use Tiptap's built-in renderer which does not execute scripts, but also add a CSP header to prevent inline script execution. (c) Sanitize link URLs in Tiptap content to only allow `http:`, `https:`, and `mailto:` protocols (block `javascript:`, `data:`, `vbscript:`). (d) Add `rel="noopener noreferrer"` to all rendered links.

### SEC-019: SQL Injection via Prisma is Mitigated but Search Needs Attention

- **Severity:** LOW
- **Affected requirement:** REQ-050
- **Issue:** Prisma parameterizes all queries by default, so standard SQL injection is mitigated. However, the search feature uses `Prisma contains` for text matching. If the search implementation ever moves to raw SQL (e.g., for PostgreSQL full-text search in Phase 2), injection risk would increase. Additionally, the `contains` filter with user input is safe with Prisma but generates `LIKE '%input%'` queries that cannot use indexes, leading to full table scans.
- **Recommendation:** (a) Document that raw SQL (`$queryRaw`) must never be used with unsanitized user input. (b) When upgrading to full-text search, use Prisma's built-in `search` filter or parameterized `$queryRaw` with `to_tsquery`. (c) For MVP, the `contains` approach is acceptable but add a note for future implementers.

### SEC-020: HTML Injection via User Name Field

- **Severity:** MEDIUM
- **Affected requirement:** REQ-001
- **Issue:** The `signUpSchema` validates name as `z.string().min(2).max(50)` with no character restrictions. A user could set their name to `<img src=x onerror=alert(1)>` or `<script>alert('xss')</script>`. If user names are rendered without proper escaping in React components (which React handles by default for string interpolation via JSX), this is low risk. However, if names are rendered in contexts that bypass React's escaping (e.g., `dangerouslySetInnerHTML`, email templates, `title` attributes set via string concatenation, Tiptap mentions, or server-rendered HTML), XSS is possible.
- **Recommendation:** (a) Add character validation to the name field: `.regex(/^[a-zA-Z0-9\s.\-']+$/)` or at minimum strip HTML tags. (b) Ensure all rendering of user names uses React's default escaping (no `dangerouslySetInnerHTML`). (c) For email templates, use a templating engine that auto-escapes HTML.

### SEC-021: Workspace/Project Name Fields Allow Unrestricted Content

- **Severity:** LOW
- **Affected requirement:** REQ-009, REQ-017
- **Issue:** Workspace names and project names have length limits but no character restrictions. Similar to SEC-020, these could contain HTML/script content. Since they appear in breadcrumbs, sidebar, page titles, and potentially `<title>` meta tags, the risk is slightly elevated.
- **Recommendation:** Sanitize or restrict to alphanumeric, spaces, and common punctuation. Ensure SSR-rendered page titles use proper escaping.

---

## 6. Rate Limiting & Abuse Prevention

### SEC-022: No Rate Limiting Specified Anywhere

- **Severity:** CRITICAL
- **Affected requirement:** REQ-001, REQ-003, REQ-006, REQ-007, REQ-025, REQ-050
- **Issue:** The entire specification, contracts, and architecture documents contain zero mention of rate limiting. This leaves every endpoint vulnerable to abuse:
  - **Sign-up** (REQ-001): Automated account creation at scale (spam, resource exhaustion)
  - **Sign-in** (REQ-003): Brute-force and credential stuffing (see SEC-005)
  - **Forgot password** (REQ-006): Email bombing a target address, token generation DoS
  - **Invite member** (REQ-007): Spam invitations to arbitrary emails
  - **Create issue** (REQ-025): Flood a workspace with thousands of issues
  - **Search** (REQ-050): Repeated expensive LIKE queries causing database load
  - **Comments** (REQ-035): Spam comments on issues
  - **Server Actions** (all): No general throttling
- **Recommendation:** Implement rate limiting at multiple layers:
  1. **Edge/middleware level:** Use Next.js middleware with a rate limiter (e.g., `@upstash/ratelimit` with Redis, or in-memory for single-server MVP). Apply to all routes.
  2. **Endpoint-specific limits:**
     - Sign-up: 5 per IP per hour
     - Sign-in: 10 per IP per 15 minutes, 5 per email per 15 minutes
     - Forgot password: 3 per email per hour, 10 per IP per hour
     - Invite: 20 per workspace per hour
     - Issue creation: 50 per user per hour
     - Search: 60 per user per minute
     - Comments: 30 per user per hour
  3. **Response:** Return 429 Too Many Requests with `Retry-After` header.

### SEC-023: No CAPTCHA on Public Forms

- **Severity:** MEDIUM
- **Affected requirement:** REQ-001, REQ-003, REQ-006
- **Issue:** Sign-up, sign-in, and forgot-password forms have no CAPTCHA or bot detection. Combined with the lack of rate limiting (SEC-022), automated bots can freely abuse these endpoints.
- **Recommendation:** Add invisible reCAPTCHA v3 or Cloudflare Turnstile to sign-up and forgot-password forms. For sign-in, add CAPTCHA only after N failed attempts (to avoid friction for legitimate users).

### SEC-024: No Description/Comment Size Enforcement at Database Level

- **Severity:** MEDIUM
- **Affected requirement:** REQ-034, REQ-035
- **Issue:** The spec says descriptions max 100KB and comments max 50KB, but: (a) the Zod schemas use `z.any()` with no size check, (b) the Prisma schema uses `Json` type with no size constraint, (c) `descriptionText` and `bodyText` are unbounded `String` types. An attacker could submit multi-megabyte payloads that pass validation, consuming database storage and degrading query performance.
- **Recommendation:** (a) Add size validation in Zod schemas (see SEC-009). (b) Add a check constraint or application-level validation on JSON field size before database insertion. (c) Consider using `@db.VarChar(100000)` for the plain text mirror fields.

---

## 7. CSRF, Session & Cookie Security

### SEC-025: CSRF Protection Relies Entirely on Auth.js Defaults

- **Severity:** MEDIUM
- **Affected requirement:** REQ-005
- **Issue:** The architecture does not explicitly address CSRF protection. Auth.js provides built-in CSRF protection for its own endpoints (`/api/auth/*`) via a CSRF token cookie. However, Next.js Server Actions have their own CSRF protection mechanism (they require a valid session and use the `Origin` header check). The search API route (`GET /api/search`) is not a Server Action -- it is a regular GET route that returns data. GET routes are generally CSRF-safe (no state changes), but this should be explicitly verified. If any future API routes handle mutations (POST/PUT/DELETE), they would need explicit CSRF protection since they bypass Server Actions' built-in mechanism.
- **Recommendation:** (a) Document that all mutations MUST use Server Actions (which have built-in CSRF protection in Next.js 15). (b) If any API routes for mutations are added in the future, add explicit CSRF token validation. (c) Verify that the Auth.js CSRF cookie is set with `SameSite=Lax` and `Secure` flags. (d) Add explicit `Content-Type` checking on any POST API routes.

### SEC-026: Cookie Security Settings Not Specified

- **Severity:** MEDIUM
- **Affected requirement:** REQ-005
- **Issue:** The architecture specifies JWT session strategy but does not document cookie security settings. Critical settings that must be configured:
  - `httpOnly`: Prevents JavaScript access to session cookies (must be true)
  - `secure`: Only send over HTTPS (must be true in production)
  - `sameSite`: Prevents cross-site request attachment (should be `lax` or `strict`)
  - `path`: Should be `/` for session cookies
  - `domain`: Should be scoped appropriately

  Auth.js sets reasonable defaults, but these are not documented and could be inadvertently overridden.
- **Recommendation:** Explicitly configure cookie options in the Auth.js config:
  ```typescript
  cookies: {
    sessionToken: {
      name: `__Secure-next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  ```
  Add `__Host-` prefix for additional security in production.

---

## 8. Multi-Tenant Data Isolation

### SEC-027: No Systematic Workspace Scoping in Query Functions

- **Severity:** CRITICAL
- **Affected requirement:** REQ-009 through REQ-053 (all workspace-scoped features)
- **Issue:** This is the most architecturally significant security concern. The data isolation model relies on individual query functions and Server Actions to correctly filter by `workspaceId`. There is no systematic enforcement layer. Consider these attack scenarios:

  1. **IDOR on issue detail:** `getIssueByKey(key)` returns an issue by its globally unique key. If the query does not also verify the issue's project belongs to a workspace the user is a member of, any authenticated user could view any issue in the system by guessing/enumerating issue keys (which follow a predictable pattern: PREFIX-NUMBER).

  2. **Cross-workspace label assignment:** `updateIssue` accepts `labelIds`. If it does not verify labels belong to the same workspace as the issue's project, a user could attach labels from workspace B to an issue in workspace A (leaking workspace B's label names).

  3. **Cross-workspace status assignment:** `moveIssue` and `updateIssue` accept `statusId`. If not verified against the issue's project, a user could set an issue to a status from a different project (possibly in a different workspace).

  4. **Cross-workspace assignee:** `updateIssue` accepts `assigneeId`. If not verified as a member of the issue's workspace, a user could assign issues to users outside the workspace.

  5. **Search across workspaces:** Already covered in SEC-017.

- **Recommendation:** Implement workspace isolation as a mandatory architectural pattern, not optional per-query logic:
  1. **Prisma middleware/extension:** Add a global middleware that automatically injects workspace filtering on all queries for workspace-scoped models. Use Prisma's `$extends` with model-level query modifications.
  2. **Server Action pattern:** Every mutation must start with `requireWorkspaceMember(workspaceId)` and then verify that all referenced entity IDs (statusId, labelIds, assigneeId) belong to the same workspace.
  3. **Defense in depth:** Add database-level row-level security (RLS) if using PostgreSQL directly, or add CHECK constraints where possible.
  4. **Testing mandate:** Require cross-workspace access tests for every query and mutation. For example: "User in workspace A cannot read/write issues in workspace B."

### SEC-028: Soft-Deleted Issues May Still Be Accessible

- **Severity:** MEDIUM
- **Affected requirement:** REQ-038
- **Issue:** Issues use soft delete (`deletedAt` timestamp). The architecture mentions "excluded from queries via Prisma middleware" but this middleware is not defined in the contracts. If the middleware is not implemented correctly or consistently, soft-deleted issues could appear in search results, board views, or be directly accessible via their issue key URL. Additionally, the `Activity` table has `onDelete: SetNull` for `issueId`, meaning activity logs persist after deletion but with null issue references -- which is fine for audit, but the activity query must handle this.
- **Recommendation:** (a) Define the Prisma middleware for soft delete filtering explicitly in the contracts:
  ```typescript
  prisma.$use(async (params, next) => {
    if (params.model === 'Issue' || params.model === 'Project') {
      if (params.action === 'findMany' || params.action === 'findFirst' || params.action === 'findUnique') {
        params.args.where = { ...params.args.where, deletedAt: null };
      }
    }
    return next(params);
  });
  ```
  (b) Ensure the search endpoint also excludes soft-deleted issues. (c) Add explicit `deletedAt: null` filter in the `getIssueByKey` query as a belt-and-suspenders measure.

---

## 9. Summary & Prioritized Remediation Plan

### Findings by Severity

| Severity | Count | Finding IDs |
|----------|-------|-------------|
| CRITICAL | 5 | SEC-003, SEC-009, SEC-018, SEC-022, SEC-027 |
| HIGH | 8 | SEC-001, SEC-004, SEC-005, SEC-008, SEC-015, SEC-017, SEC-006 (reclassified to HIGH) |
| MEDIUM | 10 | SEC-002, SEC-007, SEC-010, SEC-014, SEC-016, SEC-020, SEC-023, SEC-024, SEC-025, SEC-026, SEC-028 |
| LOW | 5 | SEC-011, SEC-012, SEC-013, SEC-019, SEC-021 |

### Remediation Priority (Pre-Implementation Blockers)

These MUST be addressed in the spec/contracts before implementation begins:

| Priority | Finding | Fix |
|----------|---------|-----|
| **P0** | SEC-027 | Add systematic workspace scoping pattern to architecture |
| **P0** | SEC-009 | Replace `z.any()` with Tiptap JSON schema + size limit |
| **P0** | SEC-018 | Define Tiptap content sanitization strategy |
| **P0** | SEC-003 | Use crypto-random invitation tokens |
| **P0** | SEC-022 | Add rate limiting section to architecture |
| **P1** | SEC-001 | Fix password schema to match spec requirements |
| **P1** | SEC-005 | Add account lockout/brute-force protection |
| **P1** | SEC-008 | Add callbackUrl validation |
| **P1** | SEC-015 | Add password field exclusion pattern |
| **P1** | SEC-017 | Add workspace membership check to search API |
| **P2** | SEC-004 | Restrict invitation transferability |
| **P2** | SEC-006 | Restrict ADMIN invite-as-ADMIN capability |
| **P2** | SEC-002 | Add resetPasswordSchema |
| **P2** | SEC-026 | Document cookie security settings |
| **P2** | SEC-028 | Define soft-delete Prisma middleware in contracts |

### Architecture Changes Required

1. **Add a "Security" section** to architecture.md covering: rate limiting strategy, CSRF approach, cookie configuration, content sanitization, and workspace isolation enforcement pattern.
2. **Add `src/lib/security/`** directory to the project structure for: rate limiter, content sanitizer, workspace guard middleware.
3. **Update all Zod schemas** per findings above (SEC-001, SEC-002, SEC-009, SEC-010, SEC-012, SEC-013, SEC-014).
4. **Add security headers** configuration (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy) to `next.config.ts`.

---

*End of Security Critique. 28 findings across 8 categories.*
