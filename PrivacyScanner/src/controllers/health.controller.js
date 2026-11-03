// Health Probe Controller

const { checkDatabaseHealth } = require('../config/database');

class HealthController {
  /**
   * Liveness probe: reports process is running.
   */
  async getLive(req, res) {
    res.status(200).json({
      status: 'UP',
      service: 'PrivacyScanner',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Readiness probe: checks essential dependencies (dedicated PostgreSQL).
   */
  async getReady(req, res) {
    const isDbHealthy = await checkDatabaseHealth();

    const status = isDbHealthy ? 'READY' : 'DEGRADED';
    const statusCode = isDbHealthy ? 200 : 503;

    res.status(statusCode).json({
      status,
      service: 'PrivacyScanner',
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
