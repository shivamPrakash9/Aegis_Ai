// Correlation ID and Request Logging Middleware

import { NextFunction, Request, Response } from 'express';
import { generateCorrelationId } from '../utils/crypto';
import { logger } from '../utils/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const correlationId =
    (req.headers['x-correlation-id'] as string) || generateCorrelationId();

  req.correlationId = correlationId;
  res.setHeader('X-Correlation-Id', correlationId);

  const startTime = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    logger.info(
      {
        correlationId,
        method: req.method,
        path: req.originalUrl || req.url,
        statusCode: res.statusCode,
        durationMs,
        ip: req.ip
      },
      'HTTP Request completed'
    );
  });

  next();
}
