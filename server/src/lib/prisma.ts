import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

/**
 * A single client for the process. In dev, `tsx watch` reloads the module graph
 * on every save, so the instance is parked on globalThis to avoid exhausting
 * the connection pool with orphaned clients.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (!env.isProduction) {
  globalForPrisma.prisma = prisma;
}
