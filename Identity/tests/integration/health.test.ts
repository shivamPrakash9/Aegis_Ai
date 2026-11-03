// Integration Tests: Health and Readiness Endpoints

import request from 'supertest';
import { app } from '../../src/app';
import * as dbModule from '../../src/config/database';

describe('Health Endpoints', () => {
  describe('GET /health/live', () => {
    it('should return 200 with status UP', async () => {
      const response = await request(app).get('/health/live');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('UP');
      expect(response.body.service).toBe('aegis-identity-service');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('GET /health/ready', () => {
    it('should return 200 with status UP when database is reachable', async () => {
      jest.spyOn(dbModule, 'checkDatabaseHealth').mockResolvedValueOnce({
        isHealthy: true,
        latencyMs: 5
      });

      const response = await request(app).get('/health/ready');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('UP');
      expect(response.body.checks.database).toBe('UP');
      expect(response.body.checks.latencyMs).toBe(5);
    });

    it('should return 503 with status DOWN when database is unreachable without leaking error details', async () => {
      jest.spyOn(dbModule, 'checkDatabaseHealth').mockResolvedValueOnce({
        isHealthy: false,
        latencyMs: 120,
        error: 'Connection refused at 5432'
      });

      const response = await request(app).get('/health/ready');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('DOWN');
      expect(response.body.checks.database).toBe('DOWN');
      // Verify no sensitive connection string or internal trace leaked
      expect(response.body.error).toBeUndefined();
      expect(response.text).not.toContain('5432');
    });
  });
});
