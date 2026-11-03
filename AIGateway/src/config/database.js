// PostgreSQL Database Connection via Prisma Client for aegis_gateway

const { PrismaClient } = require('@prisma/client');
const { logger } = require('../utils/logger');

let prismaInstance = null;

function getPrismaClient() {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
    });
  }
  return prismaInstance;
}

/**
 * Checks database connectivity without leaking credentials.
 * @returns {Promise<boolean>}
 */
async function checkDatabaseHealth() {
  try {
    const client = getPrismaClient();
    await client.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.warn({ err: error.message }, 'Database health check failed');
    return false;
  }
}

/**
 * Disconnects Prisma client cleanly.
 */
async function disconnectDatabase() {
  if (prismaInstance) {
    try {
      await prismaInstance.$disconnect();
    } catch (error) {
      logger.error({ err: error.message }, 'Error disconnecting Prisma client');
    }
  }
}

module.exports = {
  getPrismaClient,
  checkDatabaseHealth,
  disconnectDatabase
};
