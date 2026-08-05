import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';
import { resolveDatabaseUrl } from './runtime.js';

/**
 * A single client for the process. In dev, `tsx watch` reloads the module graph
 * on every save, so the instance is parked on globalThis to avoid exhausting
 * the connection pool with orphaned clients. On a serverless instance the same
 * caching means the database is only copied into place once per cold start.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    datasources: { db: { url: resolveDatabaseUrl(env.DATABASE_URL) } },
  });

if (!env.isProduction) {
  globalForPrisma.prisma = prisma;
}
