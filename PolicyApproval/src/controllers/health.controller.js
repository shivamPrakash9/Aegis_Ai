// Health Probe Controller for Policy & Approval Microservice

const { checkDatabaseHealth } = require('../config/database');

class HealthController {
  /**
   * Liveness probe: reports process is running.
   */
  async getLive(req, res) {
    res.status(200).json({
      status: 'UP',
      service: 'PolicyApproval',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Readiness probe: checks essential dependencies (dedicated aegis_policy PostgreSQL).
   */
  async getReady(req, res) {
    const isDbHealthy = await checkDatabaseHealth();

    const status = isDbHealthy ? 'READY' : 'DEGRADED';
    const statusCode = isDbHealthy ? 200 : 503;

    res.status(statusCode).json({
      status,
      service: 'PolicyApproval',
      timestamp: new Date().toISOString(),
      dependencies: {
        database: isDbHealthy ? 'UP' : 'DOWN'
      }
    });
  }
}

module.exports = {
  HealthController,
  healthController: new HealthController()
};
