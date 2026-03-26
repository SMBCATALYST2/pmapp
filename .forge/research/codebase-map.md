# Project Codebase Map — pmapp JIRA-like Platform

**Date**: 2026-03-26  
**Stack**: Next.js 15 + TypeScript + PostgreSQL + Prisma + Tailwind CSS v4 + shadcn/ui + NextAuth.js  
**Environment**: Node v18.19.1, npm 9.2.0, bun 1.3.4

## 1. Global Environment & Tools

### Available Tools
- **Node**: v18.19.1
- **npm**: 9.2.0
- **bun**: v1.3.4 (alternative package manager)
- **TypeScript**: 5.7.0+ (based on reference projects)
- **ESLint**: 9.0+ with FlatConfig support
- **Tailwind CSS**: v4.0+ (PostCSS-based)

### Code Style Conventions (from existing projects)
- **TypeScript**: Strict mode enabled, full type hints, ES2022 target
- **Formatting**: 2-space indent (Next.js convention)
- **Naming**: camelCase for JS/TS, kebab-case for file/folder names
- **Semicolons**: Always required
- **Quotes**: Single quotes preferred
- **Path aliases**: `@/*` for imports

---

## 2. Ideal Next.js 15 App Router Project Structure

```
pmapp/
├── .forge/                           # Forge pipeline metadata
│   ├── logs/                         # Progress logs
│   └── research/                     # Research artifacts
├── .github/workflows/                # CI/CD pipelines
├── prisma/
│   └── schema.prisma                 # Database schema
├── public/                           # Static assets
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # Root layout
│   │   ├── page.tsx                  # Home page
│   │   ├── globals.css               # Tailwind directives
│   │   ├── (auth)/                   # Route group
│   │   │   ├── login/page.tsx
│   │   │   ├── signup/page.tsx
│   │   │   └── callback/route.ts
│   │   ├── (dashboard)/              # Route group
│   │   │   ├── layout.tsx
│   │   │   ├── projects/page.tsx
│   │   │   ├── issues/page.tsx
│   │   │   └── team/page.tsx
│   │   └── api/                      # API routes
│   │       ├── projects/route.ts
│   │       └── auth/[...nextauth]/route.ts
│   ├── components/
│   │   ├── ui/                       # shadcn/ui components
│   │   ├── auth/                     # Auth components
│   │   ├── dashboard/                # Feature components
│   │   └── common/                   # Shared components
│   ├── lib/
│   │   ├── api.ts                    # API client
│   │   ├── providers.tsx             # TanStack Query provider
│   │   ├── utils.ts                  # Utilities
│   │   ├── auth/                     # NextAuth config
│   │   ├── db/                       # Prisma client
│   │   └── types/                    # Shared types
│   ├── hooks/                        # Custom hooks
│   ├── stores/                       # Zustand stores
│   ├── middleware.ts                 # Auth middleware
│   └── env.ts                        # Type-safe env
├── eslint.config.mjs                 # ESLint
├── postcss.config.mjs                # PostCSS
├── tailwind.config.ts                # Tailwind
├── tsconfig.json                     # TypeScript
├── next.config.ts                    # Next.js
├── components.json                   # shadcn/ui config
└── package.json
```

---

## 3. Key Technologies & Integration Patterns

### A. Next.js 15 App Router
- Entry point: `src/app/layout.tsx`
- Route groups: `(auth)`, `(dashboard)` organize without URL impact
- Server components by default, `'use client'` for interactivity
- API routes: `src/app/api/[resource]/route.ts`

### B. State Management
- **Zustand stores** (`src/stores/`): UI state (sidebar, modals, user context)
- **TanStack Query** (`src/hooks/use-api.ts`): Server data with caching
- No Redux/Context API

### C. Authentication (NextAuth.js)
- Config: `src/lib/auth/auth.ts`
- Middleware: `src/middleware.ts` protects routes
- Callback: `src/app/api/auth/[...nextauth]/route.ts`
- OAuth providers: Google, email/password, or database

### D. Database (Prisma + PostgreSQL)
- Schema: `prisma/schema.prisma`
- Client: `src/lib/db/client.ts`
- Queries: Custom hooks or API routes

### E. UI Library (shadcn/ui)
- Components auto-generated in `src/components/ui/`
- Icons: lucide-react
- Config: `components.json`

### F. Styling (Tailwind CSS v4)
- Entry: `src/app/globals.css`
- PostCSS-based, no build deps
- Optional dark mode with next-themes

---

## 4. File Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Component | PascalCase | `ProjectCard.tsx` |
| Hook | kebab-case, use- | `use-projects.ts` |
| Type | kebab-case | `project-types.ts` |
| Utility | kebab-case | `string-utils.ts` |
| Store | kebab-case, *-store | `app-store.ts` |
| Folder | kebab-case | `components/`, `hooks/` |

---

## 5. TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "strict": true,
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "paths": { "@/*": ["./src/*"] }
  }
}
```

---

## 6. ESLint & Code Quality

- Base: `next/core-web-vitals`, `next/typescript`
- Enforce: semicolons, single quotes
- Ignore: `.next/`, `node_modules/`

---

## 7. Development Workflow

### Package Scripts
```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit",
    "db:push": "prisma db push",
    "db:studio": "prisma studio"
  }
}
```

### Local Setup
1. npm install
2. Configure local database connection
3. npx prisma db push
4. npm run dev (http://localhost:3000)

---

## 8. Reference Patterns from Existing Projects

| Area | Reference | Path |
|------|-----------|------|
| App Router groups | smbnext-cloud | `/dashboard/app/(auth)`, `(billing)` |
| Zustand + Query | smbnext-cloud+vtsi2 | `stores/app-store.ts`, hooks |
| Auth middleware | smbnext-cloud | `middleware.ts`, `auth/callback/` |
| Tailwind v4 | smbnext-cloud | PostCSS config, shadcn setup |
| TypeScript strict | smbnext-cloud | `tsconfig.json` |
| API client | smbnext-cloud | `lib/api.ts` (error handling) |

---

## 9. Architectural Decisions

1. **Auth**: NextAuth.js + PostgreSQL adapter
2. **State**: Zustand (UI) + TanStack Query (server data)
3. **API**: Next.js API routes
4. **Styling**: Tailwind CSS v4 + shadcn/ui
5. **Database**: Prisma + PostgreSQL
6. **Deployment**: Standalone Next.js + Docker

---

**Last Updated**: 2026-03-26 by Scout
