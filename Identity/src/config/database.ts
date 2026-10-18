// Prisma Client Database Connection & Health Check

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

// Prevent multiple instances of Prisma Client in development / test
declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

export const prisma =
  global.prismaGlobal ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'error' },
            { emit: 'event', level: 'warn' }
          ]
        : [{ emit: 'event', level: 'error' }]
  });

if (process.env.NODE_ENV !== 'production') {
  global.prismaGlobal = prisma;
}

/**
 * Check connectivity and responsiveness of PostgreSQL database
 */
export async function checkDatabaseHealth(): Promise<{
  isHealthy: boolean;
  latencyMs?: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      isHealthy: true,
      latencyMs: Date.now() - start
    };
  } catch (error: any) {
    logger.error({ err: error.message }, 'Database health check failed');
    return {
      isHealthy: false,
      latencyMs: Date.now() - start,
      error: error.message || 'Database unreachable'
    };
  }
}

/**
 * Graceful database disconnect
 */
export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
  } catch (error: any) {
    logger.error({ err: error.message }, 'Error disconnecting Prisma client');
  }
}
