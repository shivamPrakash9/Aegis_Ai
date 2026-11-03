// Health & Readiness Controllers

import { Request, Response } from 'express';
import { checkDatabaseHealth } from '../config/database';

export async function getLive(req: Request, res: Response): Promise<Response> {
  return res.status(200).json({
    status: 'UP',
    service: 'aegis-identity-service',
    timestamp: new Date().toISOString()
  });
}

export async function getReady(req: Request, res: Response): Promise<Response> {
  const dbHealth = await checkDatabaseHealth();

  if (!dbHealth.isHealthy) {
    return res.status(503).json({
      status: 'DOWN',
      service: 'aegis-identity-service',
      checks: {
        database: 'DOWN'
      },
      timestamp: new Date().toISOString()
    });
  }

  return res.status(200).json({
    status: 'UP',
    service: 'aegis-identity-service',
    checks: {
      database: 'UP',
      latencyMs: dbHealth.latencyMs
    },
    timestamp: new Date().toISOString()
  });
}
