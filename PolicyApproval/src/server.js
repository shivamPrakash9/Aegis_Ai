// Server Entry Point for AegisAI Policy & Approval Microservice

const { app } = require('./app');
const { env } = require('./config/env');
const { disconnectDatabase } = require('./config/database');
const { logger } = require('./utils/logger');

const server = app.listen(env.port, () => {
  logger.info(
    { port: env.port, env: env.nodeEnv },
    `AegisAI Policy & Approval Microservice running on port ${env.port}`
  );
});

// Graceful Shutdown Coordination
async function gracefulShutdown(signal) {
  logger.info({ signal }, `Received ${signal}. Initiating graceful shutdown...`);

  server.close(async () => {
    logger.info('HTTP server closed.');

    try {
      await disconnectDatabase();
      logger.info('Database connection released cleanly.');
      process.exit(0);
    } catch (err) {
      logger.error({ err: err.message }, 'Error encountered during graceful shutdown cleanup');
      process.exit(1);
    }
  });

  // Force shutdown after 10s if connections remain stuck
  setTimeout(() => {
    logger.error('Graceful shutdown timeout exceeded. Forcing process exit.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

module.exports = { server };
