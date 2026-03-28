#!/bin/bash
set -e

# ─────────────────────────────────────────────────────────────
# PMApp Docker Entrypoint
# Builds DATABASE_URL from individual env vars if not provided,
# runs migrations, optionally provisions tenant, then starts app.
# ─────────────────────────────────────────────────────────────

# Build DATABASE_URL from individual components if not already set
if [ -z "$DATABASE_URL" ]; then
  DB_USER="${DB_USER:-pmapp}"
  DB_PASSWORD="${DB_PASSWORD:-pmapp}"
  DB_HOST="${DB_HOST:-postgres}"
  DB_PORT="${DB_PORT:-5432}"
  DB_NAME="${DB_NAME:-pmapp}"
  export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public"
fi

echo "==> Running database migrations..."
npx prisma migrate deploy --schema=./prisma/schema.prisma

# Provision tenant if ADMIN_EMAIL is provided (first-time setup)
if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ]; then
  TENANT_SLUG="${TENANT_SLUG:-default}"
  TENANT_NAME="${TENANT_NAME:-Default Workspace}"

  echo "==> Provisioning tenant: $TENANT_SLUG ($ADMIN_EMAIL)"
  tsx ./scripts/provision_tenant.ts \
    --admin-email "$ADMIN_EMAIL" \
    --admin-password "$ADMIN_PASSWORD" \
    --slug "$TENANT_SLUG" \
    --name "$TENANT_NAME"
fi

echo "==> Starting PMApp..."
exec "$@"
