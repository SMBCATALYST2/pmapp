// src/lib/db/index.ts
// Prisma client singleton for Next.js
//
// In development, Next.js hot-reloads server modules which would create
// multiple PrismaClient instances. This singleton pattern prevents that
// by caching the client on the global object.

import { PrismaClient } from '../../../generated/prisma';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// -----------------------------------------------------------------
// Prisma middleware: soft-delete query exclusion
// Automatically adds `deletedAt: null` to all findMany/findFirst/findUnique
// queries on Issue and Project models (addresses critique: soft-delete gaps)
// -----------------------------------------------------------------
prisma.$use(async (params, next) => {
  const softDeleteModels = ['Issue', 'Project'];

  if (params.model && softDeleteModels.includes(params.model)) {
    // For read operations, exclude soft-deleted records by default
    if (params.action === 'findMany' || params.action === 'findFirst') {
      if (!params.args) params.args = {};
      if (!params.args.where) params.args.where = {};
      // Only add if deletedAt is not explicitly set in the query
      if (params.args.where.deletedAt === undefined) {
        params.args.where.deletedAt = null;
      }
    }

    if (params.action === 'findUnique' || params.action === 'findUniqueOrThrow') {
      if (!params.args) params.args = {};
      // Convert to findFirst to support the deletedAt filter
      // (findUnique doesn't support arbitrary where clauses)
      if (params.args.where?.deletedAt === undefined) {
        const { where, ...rest } = params.args;
        params.action = 'findFirst' as typeof params.action;
        params.args = {
          ...rest,
          where: {
            ...where,
            deletedAt: null,
          },
        };
      }
    }

    // For delete operations, convert to soft delete (update deletedAt)
    if (params.action === 'delete') {
      params.action = 'update' as typeof params.action;
      if (!params.args) params.args = {};
      params.args.data = { deletedAt: new Date() };
    }

    if (params.action === 'deleteMany') {
      params.action = 'updateMany' as typeof params.action;
      if (!params.args) params.args = {};
      params.args.data = { deletedAt: new Date() };
    }
  }

  return next(params);
});

// Alias for consistent import across the codebase: import { db } from '@/lib/db'
export const db = prisma;

export default prisma;
