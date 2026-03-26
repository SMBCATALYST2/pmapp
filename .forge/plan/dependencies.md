# Dependency Map: PMApp (JIRA-like Project Management)

**Date:** 2026-03-26
**Author:** DependencyMapper (Forge Pipeline)
**Stack:** Next.js 15 + TypeScript + PostgreSQL + Prisma + Tailwind CSS v4 + shadcn/ui + NextAuth.js

---

## Table of Contents

1. [NPM Packages (Categorized)](#1-npm-packages-categorized)
2. [External Services](#2-external-services)
3. [Infrastructure](#3-infrastructure)
4. [shadcn/ui Components](#4-shadcnui-components)
5. [Build & Tooling Config](#5-build--tooling-config)
6. [Dependency Graph & Init Order](#6-dependency-graph--init-order)
7. [Environment Variables](#7-environment-variables)
8. [Install Commands](#8-install-commands)

---

## 1. NPM Packages (Categorized)

### A. Core Framework

| Package | Version | Type | Purpose |
|---------|---------|------|---------|
| `next` | ^15.2.x | prod | App framework (App Router, Server Components, Server Actions) |
| `react` | ^19.2.x | prod | UI library |
| `react-dom` | ^19.2.x | prod | React DOM renderer |
| `typescript` | ^5.7.x | dev | Type safety |
| `@types/node` | ^22.x | dev | Node.js type definitions |
| `@types/react` | ^19.x | dev | React type definitions |
| `@types/react-dom` | ^19.x | dev | React DOM type definitions |

### B. Database & ORM

| Package | Version | Type | Purpose |
|---------|---------|------|---------|
| `prisma` | ^7.5.x | dev | Schema management, migrations, CLI |
| `@prisma/client` | ^7.5.x | prod | Generated database client |

**External:** PostgreSQL 16+ (via Docker or hosted service)

### C. Authentication

| Package | Version | Type | Purpose |
|---------|---------|------|---------|
| `next-auth` | ^5.0.0-beta.30 | prod | Auth.js v5 -- OAuth, credentials, session management |
| `@auth/prisma-adapter` | latest | prod | Prisma adapter for NextAuth.js (User/Account/Session tables) |
| `bcryptjs` | ^3.0.x | prod | Password hashing for credentials provider |
| `@types/bcryptjs` | ^3.0.x | dev | TypeScript types for bcryptjs |

### D. UI Framework & Components

| Package | Version | Type | Purpose |
|---------|---------|------|---------|
| `tailwindcss` | ^4.2.x | prod | Utility-first CSS (v4 CSS-based config) |
| `@tailwindcss/postcss` | ^4.2.x | dev | PostCSS plugin for Tailwind v4 |
| `lucide-react` | ^0.500.x | prod | Icon library (default for shadcn/ui) |
| `class-variance-authority` | ^0.7.x | prod | Component variant styling (used by shadcn/ui) |
| `clsx` | ^2.1.x | prod | Conditional class names |
| `tailwind-merge` | ^3.x | prod | Deduplicate/merge Tailwind classes |
| `cmdk` | ^1.1.x | prod | Command palette (powers shadcn/ui Command) |
| `next-themes` | ^0.4.x | prod | Dark/light mode with Next.js |
| `sonner` | ^2.0.x | prod | Toast notifications |

**Note:** shadcn/ui is not an npm package. It is a CLI that copies component source files into `src/components/ui/`. The underlying Radix UI primitives are installed automatically per component.

### E. Drag-and-Drop (Kanban Board)

| Package | Version | Type | Purpose |
|---------|---------|------|---------|
| `@dnd-kit/core` | ^6.3.x | prod | DnD engine -- sensors, collision detection, context |
| `@dnd-kit/sortable` | ^10.0.x | prod | Sortable lists -- Kanban columns + card reordering |
| `@dnd-kit/utilities` | ^3.2.x | prod | CSS transform helpers for performance |

### F. Rich Text Editor (Issue Descriptions & Comments)

| Package | Version | Type | Purpose |
|---------|---------|------|---------|
| `@tiptap/react` | ^3.20.x | prod | Tiptap React integration (useEditor hook) |
| `@tiptap/starter-kit` | ^3.20.x | prod | Core extensions: bold, italic, lists, headings, code blocks |
| `@tiptap/extension-task-list` | ^3.20.x | prod | Checkbox task lists in descriptions |
| `@tiptap/extension-task-item` | ^3.20.x | prod | Individual task items |
| `@tiptap/extension-link` | ^3.20.x | prod | Auto-link URLs |
| `@tiptap/extension-placeholder` | ^3.20.x | prod | Placeholder text for empty editor |
| `@tiptap/extension-mention` | ^3.20.x | prod | @mentions (Phase 2, but install now for architecture) |
| `@tiptap/extension-image` | ^3.20.x | prod | Image embedding (Phase 2, optional at MVP) |

### G. State Management & Data Fetching

| Package | Version | Type | Purpose |
|---------|---------|------|---------|
| `@tanstack/react-query` | ^5.95.x | prod | Server state cache, optimistic updates, polling |
| `zustand` | ^5.0.x | prod | Lightweight client-side UI state (sidebar, modals, active workspace) |
| `nuqs` | ^2.8.x | prod | Type-safe URL search params for filter persistence |

### H. Forms & Validation

| Package | Version | Type | Purpose |
|---------|---------|------|---------|
| `zod` | ^3.24.x | prod | Schema validation (shared client + server) |
| `react-hook-form` | ^7.72.x | prod | Performant form state management |
| `@hookform/resolvers` | ^5.2.x | prod | Zod resolver for react-hook-form integration |

### I. Data Tables (List View)

| Package | Version | Type | Purpose |
|---------|---------|------|---------|
| `@tanstack/react-table` | ^8.21.x | prod | Headless data table -- sorting, filtering, pagination, column visibility |

### J. Utilities

| Package | Version | Type | Purpose |
|---------|---------|------|---------|
| `date-fns` | ^4.1.x | prod | Date manipulation (tree-shakeable, immutable) |
| `fractional-indexing` | ^3.2.x | prod | Position ordering for Kanban card sort order |
| `@paralleldrive/cuid2` | ^3.3.x | prod | URL-safe unique ID generation |

### K. Charts (Phase 2+ but list for awareness)

| Package | Version | Type | Purpose |
|---------|---------|------|---------|
| `recharts` | ^2.15.x | prod | Sprint burndown, velocity, dashboard charts |

### L. Development & Quality

| Package | Version | Type | Purpose |
|---------|---------|------|---------|
| `eslint` | ^9.x | dev | Linting (flat config) |
| `eslint-config-next` | ^15.x | dev | Next.js ESLint rules |
| `prettier` | ^3.8.x | dev | Code formatting |
| `prettier-plugin-tailwindcss` | latest | dev | Auto-sort Tailwind classes |
| `@trivago/prettier-plugin-sort-imports` | latest | dev | Sort import statements |

### M. Testing (Phase 2+ but list for awareness)

| Package | Version | Type | Purpose |
|---------|---------|------|---------|
| `vitest` | ^4.x | dev | Unit/integration testing |
| `@testing-library/react` | ^16.x | dev | React component testing |
| `playwright` | latest | dev | E2E browser testing |

---

## 2. External Services

### Required for MVP

| Service | Purpose | Local Dev | Production |
|---------|---------|-----------|------------|
| **PostgreSQL 16+** | Primary database | Docker Compose (`docker-compose.yml`) | Neon / Supabase / Railway |
| **Google OAuth** | Social sign-in | Google Cloud Console (OAuth 2.0 credentials) | Same credentials |
| **GitHub OAuth** | Social sign-in | GitHub Developer Settings (OAuth App) | Same credentials |

### Phase 2+

| Service | Purpose | Options |
|---------|---------|---------|
| **SMTP / Email** | Invite emails, password reset | Resend, SendGrid, or Nodemailer with SMTP |
| **Object Storage** | File attachments | Cloudflare R2, AWS S3, Supabase Storage |
| **CDN** | Static assets & images | Vercel Edge Network (automatic) |

### Phase 3+

| Service | Purpose | Options |
|---------|---------|---------|
| **Real-time** | Live board updates | SSE (built-in), or Pusher/Ably for WebSocket |
| **Search** | Full-text search (if beyond PG) | PostgreSQL tsvector (built-in) or Meilisearch |
| **Monitoring** | Error tracking & APM | Sentry, Vercel Analytics |

---

## 3. Infrastructure

### Docker Compose (Local Development)

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    container_name: pmapp-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: pmapp
      POSTGRES_PASSWORD: pmapp_dev_password
      POSTGRES_DB: pmapp
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

### Build Configuration (next.config.ts)

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',          // For Docker deployment
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',      // For rich text content
    },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' }, // Google avatars
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' }, // GitHub avatars
    ],
  },
};

export default nextConfig;
```

---

## 4. shadcn/ui Components

### Initialization

```bash
npx shadcn@latest init
# Select: New York style, Zinc base color, CSS variables: yes
```

### Components Needed (MVP)

| Component | Used For | Radix Dependency |
|-----------|----------|------------------|
| **Button** | All interactive buttons, submit, cancel | - |
| **Input** | Text fields (issue title, project name, search) | - |
| **Label** | Form field labels | @radix-ui/react-label |
| **Textarea** | Multi-line text (project description, comments fallback) | - |
| **Dialog** | Create issue modal, confirm delete, invite member | @radix-ui/react-dialog |
| **Sheet** | Issue detail slide-over panel (right side) | @radix-ui/react-dialog |
| **Popover** | Date picker host, label picker, assignee picker | @radix-ui/react-popover |
| **DropdownMenu** | Issue actions menu, user menu, sort options | @radix-ui/react-dropdown-menu |
| **Select** | Status, priority, type, sprint dropdowns | @radix-ui/react-select |
| **Command** | Cmd+K global search, assignee/label combobox search | cmdk |
| **Badge** | Labels, status chips, priority indicators | - |
| **Avatar** | User avatars (assignee, members, comments) | @radix-ui/react-avatar |
| **Card** | Issue cards on Kanban board, project cards | - |
| **Table** | List view, member list, settings tables | - |
| **Tabs** | Activity/Comments tabs, Board/List view toggle | @radix-ui/react-tabs |
| **Separator** | Visual dividers in sidebar, detail view | @radix-ui/react-separator |
| **ScrollArea** | Sidebar project list, Kanban columns, comments | @radix-ui/react-scroll-area |
| **Skeleton** | Loading states for cards, tables, detail view | - |
| **Tooltip** | Icon button hints, truncated text reveal | @radix-ui/react-tooltip |
| **Calendar** | Date picker for due dates | - (react-day-picker) |
| **Checkbox** | Bulk select issues, task item toggles | @radix-ui/react-checkbox |
| **Switch** | Settings toggles (notifications, preferences) | @radix-ui/react-switch |
| **Form** | Form wrapper with react-hook-form integration | - |
| **Collapsible** | Sidebar sections, sub-task lists | @radix-ui/react-collapsible |
| **Toggle** | View mode switch (Board/List), filter toggles | @radix-ui/react-toggle |
| **ToggleGroup** | Multi-toggle selections (view modes) | @radix-ui/react-toggle-group |
| **Breadcrumb** | Navigation: Workspace > Project > Issue | - |
| **Sidebar** | Main app sidebar (shadcn/ui sidebar component) | - |
| **Sonner** | Toast notification wrapper | sonner |

### Install Command (all at once)

```bash
npx shadcn@latest add button input label textarea dialog sheet popover dropdown-menu select command badge avatar card table tabs separator scroll-area skeleton tooltip calendar checkbox switch form collapsible toggle toggle-group breadcrumb sidebar sonner
```

**Total: 28 shadcn/ui components**

### Radix UI Primitives Auto-Installed

These are installed automatically as dependencies of shadcn/ui components:

- `@radix-ui/react-avatar`
- `@radix-ui/react-checkbox`
- `@radix-ui/react-collapsible`
- `@radix-ui/react-dialog`
- `@radix-ui/react-dropdown-menu`
- `@radix-ui/react-label`
- `@radix-ui/react-popover`
- `@radix-ui/react-scroll-area`
- `@radix-ui/react-select`
- `@radix-ui/react-separator`
- `@radix-ui/react-switch`
- `@radix-ui/react-tabs`
- `@radix-ui/react-toggle`
- `@radix-ui/react-toggle-group`
- `@radix-ui/react-tooltip`
- `react-day-picker` (Calendar)

---

## 5. Build & Tooling Config

### tsconfig.json

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      { "name": "next" }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### ESLint Config (eslint.config.mjs)

```javascript
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      semi: ['error', 'always'],
      quotes: ['error', 'single', { avoidEscape: true }],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
];

export default eslintConfig;
```

### Prettier Config (.prettierrc)

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

### PostCSS Config (postcss.config.mjs)

```javascript
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
```

### Tailwind CSS v4 (CSS-based config)

In Tailwind v4, configuration lives in `src/app/globals.css`:

```css
@import "tailwindcss";

@theme {
  --color-background: oklch(1 0 0);
  --color-foreground: oklch(0.145 0 0);
  /* shadcn/ui theme variables are added by `npx shadcn init` */
}
```

No `tailwind.config.ts` needed -- Tailwind v4 uses CSS-native configuration.

### components.json (shadcn/ui)

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/app/globals.css",
    "baseColor": "zinc",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

---

## 6. Dependency Graph & Init Order

### Setup Sequence (Critical Path)

```
Step 1: Project Scaffold
  └── npx create-next-app@latest pmapp --typescript --tailwind --eslint --app --src-dir --turbopack
       ├── Installs: next, react, react-dom, typescript, @types/*, tailwindcss, eslint
       └── Creates: tsconfig.json, eslint.config.mjs, postcss.config.mjs, next.config.ts

Step 2: shadcn/ui Init (depends on Step 1 -- needs Tailwind + tsconfig paths)
  └── npx shadcn@latest init
       ├── Creates: components.json, src/lib/utils.ts
       ├── Installs: clsx, tailwind-merge, class-variance-authority, lucide-react
       └── Configures: globals.css theme variables

Step 3: shadcn/ui Components (depends on Step 2)
  └── npx shadcn@latest add [all 28 components]
       ├── Installs: all @radix-ui/* primitives, cmdk, react-day-picker, sonner
       └── Creates: src/components/ui/*.tsx

Step 4: Database Setup (independent of Steps 2-3, depends on Step 1)
  ├── Docker Compose up (PostgreSQL)
  ├── npm install prisma @prisma/client
  ├── npx prisma init
  └── Creates: prisma/schema.prisma, .env with DATABASE_URL

Step 5: Auth Setup (depends on Step 4 -- needs Prisma schema for User model)
  ├── npm install next-auth@beta @auth/prisma-adapter bcryptjs
  ├── Configure: src/lib/auth/auth.ts, src/app/api/auth/[...nextauth]/route.ts
  ├── Add to schema: User, Account, Session, VerificationToken models
  └── Configure: src/middleware.ts (route protection)

Step 6: State & Data Layer (depends on Step 1)
  ├── npm install @tanstack/react-query zustand nuqs zod react-hook-form @hookform/resolvers
  ├── Create: src/lib/providers.tsx (QueryClientProvider wrapping app)
  └── Configure: src/app/layout.tsx to use Providers

Step 7: Feature Libraries (depends on Steps 2-3)
  ├── npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
  ├── npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-*
  ├── npm install @tanstack/react-table
  └── npm install date-fns fractional-indexing @paralleldrive/cuid2 next-themes

Step 8: Dev Tooling (independent)
  ├── npm install -D prettier prettier-plugin-tailwindcss
  └── Create: .prettierrc, .prettierignore
```

### Runtime Dependency Chain

```
Browser Request
  └── Next.js Middleware (auth check via next-auth)
       └── App Router (layout.tsx)
            ├── Providers wrapper
            │   ├── SessionProvider (next-auth)
            │   ├── QueryClientProvider (@tanstack/react-query)
            │   └── ThemeProvider (next-themes)
            └── Page Component (Server Component)
                 ├── Prisma queries (data fetch)
                 └── Client Components
                      ├── shadcn/ui (Radix primitives)
                      ├── @dnd-kit (Kanban board)
                      ├── Tiptap (rich text editor)
                      ├── @tanstack/react-table (list view)
                      ├── zustand (UI state)
                      ├── nuqs (URL filter state)
                      └── react-hook-form + zod (forms)
```

### Inter-Package Dependencies

```
next-auth
  ├── requires: prisma schema (User, Account, Session models)
  ├── requires: bcryptjs (credentials provider)
  └── used by: middleware.ts, all server actions

shadcn/ui components
  ├── requires: tailwindcss (styling)
  ├── requires: clsx + tailwind-merge (via cn() utility)
  ├── requires: class-variance-authority (variants)
  └── requires: @radix-ui/* (accessibility primitives)

@dnd-kit
  ├── requires: react 18+ (context, transitions)
  └── pairs with: fractional-indexing (position calculation)

@tiptap/*
  ├── requires: react 18+ (useEditor hook)
  └── self-contained (all extensions peer-depend on @tiptap/core)

@tanstack/react-query
  ├── requires: Provider in layout.tsx
  └── used by: all client-side data fetching hooks

react-hook-form + zod
  ├── connected via: @hookform/resolvers
  └── zod schemas shared between client forms and server actions
```

---

## 7. Environment Variables

### .env.example

```bash
# ============================================
# DATABASE
# ============================================
DATABASE_URL="postgresql://pmapp:pmapp_dev_password@localhost:5432/pmapp?schema=public"

# ============================================
# NEXTAUTH.JS
# ============================================
# Generate: openssl rand -base64 32
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"

# ============================================
# OAUTH PROVIDERS
# ============================================
# Google (https://console.cloud.google.com/apis/credentials)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# GitHub (https://github.com/settings/developers)
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""

# ============================================
# APP CONFIG
# ============================================
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_APP_NAME="PMApp"

# ============================================
# PHASE 2+ (uncomment when needed)
# ============================================
# SMTP / Email (Resend)
# RESEND_API_KEY=""
# EMAIL_FROM="noreply@pmapp.dev"

# File Storage (Cloudflare R2 / S3)
# S3_ENDPOINT=""
# S3_ACCESS_KEY=""
# S3_SECRET_KEY=""
# S3_BUCKET=""
# S3_REGION=""
```

**Total environment variables:** 8 for MVP, 13 with Phase 2+ services.

---

## 8. Install Commands

### One-Shot MVP Install

```bash
# Step 1: Create Next.js project
npx create-next-app@latest pmapp --typescript --tailwind --eslint --app --src-dir --turbopack --use-npm

cd pmapp

# Step 2: shadcn/ui init
npx shadcn@latest init -d

# Step 3: shadcn/ui components (all MVP components)
npx shadcn@latest add button input label textarea dialog sheet popover dropdown-menu select command badge avatar card table tabs separator scroll-area skeleton tooltip calendar checkbox switch form collapsible toggle toggle-group breadcrumb sidebar sonner

# Step 4: Database
npm install prisma --save-dev
npm install @prisma/client
npx prisma init

# Step 5: Auth
npm install next-auth@beta @auth/prisma-adapter bcryptjs
npm install @types/bcryptjs --save-dev

# Step 6: State, data, forms, validation
npm install @tanstack/react-query zustand nuqs zod react-hook-form @hookform/resolvers

# Step 7: Feature libraries
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-task-list @tiptap/extension-task-item @tiptap/extension-link @tiptap/extension-placeholder
npm install @tanstack/react-table
npm install date-fns fractional-indexing @paralleldrive/cuid2 next-themes

# Step 8: Dev tooling
npm install --save-dev prettier prettier-plugin-tailwindcss
```

### Package Count Summary

| Category | Packages | Type |
|----------|----------|------|
| Core Framework | 3 | prod |
| TypeScript Types | 3 | dev |
| Database/ORM | 2 | prod+dev |
| Authentication | 4 | prod+dev |
| UI (shadcn deps) | 6 | prod |
| Drag-and-Drop | 3 | prod |
| Rich Text (Tiptap) | 6 | prod |
| State/Data/Forms | 6 | prod |
| Data Table | 1 | prod |
| Utilities | 4 | prod |
| Dev Tools | 4 | dev |
| **Total** | **42** | |

Plus 28 shadcn/ui components (source files, not npm packages) and ~16 auto-installed Radix UI primitives.

---

## Appendix: Version Lock Strategy

Use exact semver ranges in `package.json` with `^` (caret) for minor/patch updates. Pin major versions to avoid breaking changes:

- **next**: `^15` (do not jump to 16 without migration)
- **react**: `^19` (must match next's peer dependency)
- **prisma + @prisma/client**: Must always match (e.g., both `^7.5`)
- **@tiptap/***: All extensions must be the same version (e.g., all `^3.20`)
- **@dnd-kit/***: core/sortable/utilities should be compatible versions
- **next-auth**: Pinned to `5.0.0-beta.30` until stable v5 releases

Run `npm outdated` periodically and update in controlled batches.
