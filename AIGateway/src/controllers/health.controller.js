// Health Controller: Liveness and Dependency Readiness Probes

const { checkDatabaseHealth } = require('../config/database');
const { checkRedisHealth } = require('../config/redis');

async function getLiveness(req, res) {
  res.status(200).json({
    status: 'UP',
    service: 'aegis-ai-gateway',
    timestamp: new Date().toISOString()
  });
}

async function getReadiness(req, res) {
  const [dbOk, redisOk] = await Promise.all([
    checkDatabaseHealth(),
    checkRedisHealth()
  ]);

  const isReady = dbOk && redisOk;
  const statusCode = isReady ? 200 : 503;

  res.status(statusCode).json({
    status: isReady ? 'UP' : 'DOWN',
    service: 'aegis-ai-gateway',
    checks: {
      database: dbOk ? 'UP' : 'DOWN',
      redis: redisOk ? 'UP' : 'DOWN'
    },
    timestamp: new Date().toISOString()
  });
}

module.exports = {
  getLiveness,
  getReadiness
};
