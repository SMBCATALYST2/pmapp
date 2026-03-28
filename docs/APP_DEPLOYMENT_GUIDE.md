# PMApp — SMBNext-Cloud Deployment Guide

## Overview

PMApp is a JIRA-like project management application built with Next.js 16 (standalone mode). It runs as a single container serving both the frontend and API routes behind Caddy.

---

## 10-Point Compatibility Checklist

| # | Requirement | Status | Details |
|---|-------------|--------|---------|
| 1 | Docker images pushed to DOCR | Done | `registry.digitalocean.com/smbnext/pmapp:latest` |
| 2 | Compose overlay file | Done | `templates/pmapp.yml` |
| 3 | Config from env vars | Done | `DB_HOST`, `DB_PASSWORD`, `REDIS_URL`, `ADMIN_EMAIL`, etc. |
| 4 | Health endpoint | Done | `GET /api/health` returns HTTP 200 |
| 5 | Database migrations | Done | `prisma migrate deploy` runs in entrypoint |
| 6 | provision_tenant command | Done | `scripts/provision_tenant.ts` |
| 7 | Admin gets full permissions | Done | OWNER role assigned in provision command |
| 8 | Frontend behind Caddy | Done | Next.js serves `/api/*` and `/*` on port 3000 |
| 9 | Registered in app_manifests | Done | SQL below |
| 10 | CI/CD pushes images | Done | `.github/workflows/release.yml` |

---

## Architecture

```
Internet → Caddy (HTTPS) → pmapp:3000 (Next.js standalone)
                          → postgres:5432 (base infra)
                          → redis:6379 (base infra)
```

Since Next.js is a full-stack framework, a single container serves:
- `/*` — React frontend (SSR + static assets)
- `/api/*` — API routes (health, search, auth)
- Server Actions — Form mutations over POST

---

## Environment Variables

The control plane generates a `.env` file per tenant. The entrypoint constructs `DATABASE_URL` from individual vars if not set directly.

| Variable | Required | Description |
|----------|----------|-------------|
| `DB_HOST` | Yes | PostgreSQL host (default: `postgres`) |
| `DB_PORT` | No | PostgreSQL port (default: `5432`) |
| `DB_NAME` | Yes | Database name |
| `DB_USER` | Yes | Database user |
| `DB_PASSWORD` | Yes | Database password |
| `DATABASE_URL` | No | Full URL (overrides individual DB_* vars) |
| `REDIS_URL` | No | Redis connection URL |
| `NEXTAUTH_SECRET` | Yes | JWT signing secret (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Yes | Public URL (e.g., `https://tenant.example.com`) |
| `NEXT_PUBLIC_APP_URL` | Yes | Same as NEXTAUTH_URL |
| `NEXT_PUBLIC_APP_NAME` | No | Display name (default: `PMApp`) |
| `ADMIN_EMAIL` | Yes* | Admin email for initial provisioning |
| `ADMIN_PASSWORD` | Yes* | Admin password for initial provisioning |
| `TENANT_SLUG` | No | Workspace slug (default: `default`) |
| `TENANT_NAME` | No | Workspace display name |

*Only required on first provisioning. Can be removed after initial setup.

---

## Provisioning Flow

1. Control plane creates the droplet and deploys base infra (Postgres, Redis, Caddy)
2. Control plane deploys `templates/pmapp.yml` overlay
3. On container start, `docker-entrypoint.sh`:
   - Constructs `DATABASE_URL` from `DB_*` env vars
   - Runs `prisma migrate deploy` (creates/updates all tables)
   - If `ADMIN_EMAIL` + `ADMIN_PASSWORD` are set, runs `provision_tenant.ts`
   - Starts the Next.js server
4. Control plane polls `GET /api/health` — waits for HTTP 200
5. Tenant is marked as provisioned

### Manual Provisioning

```bash
docker exec pmapp bun ./scripts/provision_tenant.ts \
  --admin-email admin@company.com \
  --admin-password "SecureP@ss123" \
  --slug my-company \
  --name "My Company"
```

---

## Compose Overlay

File: `templates/pmapp.yml`

Defines a single `pmapp` service that:
- Depends on `postgres` (waits for healthy)
- Exposes port 3000 internally
- Runs health checks every 15s
- Connects to `app-network`

Caddy routes all traffic to `pmapp:3000` — Next.js handles the `/api/*` vs `/*` split internally.

---

## Caddy Configuration

Since Next.js serves both frontend and API on the same port, the Caddy config is simple:

```caddyfile
{$DOMAIN} {
    reverse_proxy pmapp:3000
}
```

No path-based splitting needed — Next.js routing handles everything.

---

## app_manifests SQL

```sql
INSERT INTO app_manifests (
    app_key,
    display_name,
    description,
    icon_url,
    backend_image,
    frontend_image,
    compose_template,
    health_endpoint,
    health_timeout_seconds,
    provision_command,
    migrate_command,
    env_schema,
    default_env,
    is_active,
    created_at,
    updated_at
) VALUES (
    'pmapp',
    'PMApp',
    'JIRA-like project management with Kanban boards, sprints, and issue tracking',
    NULL,
    'registry.digitalocean.com/smbnext/pmapp:latest',
    NULL,  -- Single image serves both frontend and backend
    'templates/pmapp.yml',
    '/api/health',
    60,
    'bun ./scripts/provision_tenant.ts --admin-email {{ADMIN_EMAIL}} --admin-password {{ADMIN_PASSWORD}} --slug {{TENANT_SLUG}} --name "{{TENANT_NAME}}"',
    'npx prisma migrate deploy --schema=./prisma/schema.prisma',
    '{
        "DB_HOST": {"required": true, "default": "postgres"},
        "DB_PORT": {"required": false, "default": "5432"},
        "DB_NAME": {"required": true},
        "DB_USER": {"required": true},
        "DB_PASSWORD": {"required": true, "generate": "random_password"},
        "NEXTAUTH_SECRET": {"required": true, "generate": "random_base64_32"},
        "NEXTAUTH_URL": {"required": true, "template": "https://{{DOMAIN}}"},
        "NEXT_PUBLIC_APP_URL": {"required": true, "template": "https://{{DOMAIN}}"},
        "NEXT_PUBLIC_APP_NAME": {"required": false, "default": "PMApp"},
        "ADMIN_EMAIL": {"required": true},
        "ADMIN_PASSWORD": {"required": true, "generate": "random_password"},
        "TENANT_SLUG": {"required": false, "default": "default"},
        "TENANT_NAME": {"required": false, "default": "Default Workspace"},
        "REDIS_URL": {"required": false, "template": "redis://redis:6379"}
    }',
    '{
        "NEXT_PUBLIC_APP_NAME": "PMApp",
        "DB_HOST": "postgres",
        "DB_PORT": "5432"
    }',
    true,
    NOW(),
    NOW()
);
```

---

## CI/CD

GitHub Actions workflow (`.github/workflows/release.yml`) triggers on:
- Git tags matching `v*`
- GitHub Releases

Steps:
1. Checks out code
2. Authenticates to DOCR via `doctl`
3. Builds the Docker image
4. Pushes with both version tag and `latest`

**Required GitHub Secrets:**
- `DIGITALOCEAN_ACCESS_TOKEN` — DO API token with registry write access

### Releasing

```bash
git tag v1.0.0
git push origin v1.0.0
# or create a GitHub Release in the UI
```

---

## Local Testing

```bash
# Build the image
docker build -t pmapp:local .

# Run with docker compose (against local postgres)
docker compose -f docker-compose.yml -f templates/pmapp.yml up -d

# Or run standalone
docker run -p 3000:3000 \
  -e DB_HOST=host.docker.internal \
  -e DB_PORT=5432 \
  -e DB_NAME=pmapp \
  -e DB_USER=pmapp \
  -e DB_PASSWORD=secret \
  -e NEXTAUTH_SECRET=$(openssl rand -base64 32) \
  -e NEXTAUTH_URL=http://localhost:3000 \
  -e NEXT_PUBLIC_APP_URL=http://localhost:3000 \
  -e ADMIN_EMAIL=admin@test.com \
  -e ADMIN_PASSWORD=Test1234! \
  pmapp:local
```

### Verify health

```bash
curl http://localhost:3000/api/health
# {"status":"healthy","timestamp":"2026-03-28T..."}
```
