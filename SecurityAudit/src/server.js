// Server Entrypoint for Security & Audit Microservice

const app = require('./app');
const { env } = require('./config/env');
const { database } = require('./config/database');
const { auditEventRepository } = require('./repositories/auditEvent.repository');
const { logger } = require('./utils/logger');

async function startServer() {
  // Connect to MongoDB
  await database.connect();
  await auditEventRepository.initIndexes();

  const server = app.listen(env.port, () => {
    logger.info(
      {
        port: env.port,
        nodeEnv: env.nodeEnv,
        database: env.mongodbDatabase
      },
      `AegisAI Security & Audit Service running on port ${env.port}`
    );
  });

  // Graceful Shutdown
  const shutdown = async (signal) => {
    logger.info({ signal }, 'Shutting down Security & Audit Service...');
    server.close(async () => {
      await database.disconnect();
      logger.info('HTTP server closed, exiting process.');
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Forceful shutdown after timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

if (require.main === module) {
  startServer().catch((err) => {
    logger.error({ err: err.message }, 'Failed to start Security & Audit Service');
    process.exit(1);
  });
}

module.exports = { startServer };
