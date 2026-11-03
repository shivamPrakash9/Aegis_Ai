// Server Entry Point & Process Lifecycle Management

import { app } from './app';
import { disconnectDatabase } from './config/database';
import { config } from './config/env';
import { logger } from './utils/logger';

const server = app.listen(config.port, () => {
  logger.info(
    {
      port: config.port,
      nodeEnv: config.nodeEnv,
      corsOrigins: config.corsOrigins
    },
    'AegisAI Identity Service initialized and listening'
  );
});

async function handleShutdown(signal: string) {
  logger.info({ signal }, 'Received termination signal, shutting down gracefully...');

  server.close(async () => {
    logger.info('HTTP server closed, disconnecting database...');
    await disconnectDatabase();
    logger.info('Graceful shutdown completed successfully.');
    process.exit(0);
  });

  // Force exit after 10s if graceful shutdown hangs
  setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

process.on('unhandledRejection', (reason: any) => {
  logger.error({ reason: reason?.message || reason }, 'Unhandled Promise Rejection');
});

process.on('uncaughtException', (err: Error) => {
  logger.error({ err: err.message, stack: err.stack }, 'Uncaught Exception');
  process.exit(1);
});
