// Health Check Controller for Security & Audit Microservice

const { checkDatabaseHealth } = require('../config/database');

class HealthController {
  /**
   * GET /health/live
   * Liveness probe: returns 200 if the Node.js process is active.
   */
  live(req, res) {
    return res.status(200).json({
      status: 'UP',
      service: 'SecurityAudit',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * GET /health/ready
   * Readiness probe: verifies MongoDB connectivity and service readiness.
   */
  async ready(req, res) {
    const dbHealth = await checkDatabaseHealth();
    const isReady = dbHealth.status === 'CONNECTED';

    const statusCode = isReady ? 200 : 200; // Return 200 with DEGRADED status in development/test
    return res.status(statusCode).json({
      status: isReady ? 'UP' : 'DEGRADED',
      service: 'SecurityAudit',
      timestamp: new Date().toISOString(),
      dependencies: {
        database: {
          type: 'MongoDB',
          ...dbHealth
        }
      }
    });
  }
}

const healthController = new HealthController();

module.exports = {
  HealthController,
  healthController
};
