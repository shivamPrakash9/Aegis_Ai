// Global Error Handler Middleware
// Conforms to Web Services Assignment Module 2 Requirement 9 & 12

import { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details?: unknown) {
    super(404, 'NOT_FOUND', message, details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict', details?: unknown) {
    super(409, 'CONFLICT', message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', details?: unknown) {
    super(401, 'UNAUTHORIZED', message, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', details?: unknown) {
    super(403, 'FORBIDDEN', message, details);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad Request', details?: unknown) {
    super(400, 'BAD_REQUEST', message, details);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too Many Requests', details?: unknown) {
    super(429, 'TOO_MANY_REQUESTS', message, details);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service Unavailable', details?: unknown) {
    super(503, 'SERVICE_UNAVAILABLE', message, details);
  }
}

export class GatewayTimeoutError extends AppError {
  constructor(message = 'Gateway Timeout', details?: unknown) {
    super(504, 'GATEWAY_TIMEOUT', message, details);
  }
}

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): Response {
  const correlationId = req.correlationId || req.headers['x-correlation-id'] as string || 'unknown';

  if (err instanceof AppError) {
    logger.warn(
      {
        correlationId,
        statusCode: err.statusCode,
        code: err.code,
        message: err.message,
        details: err.details
      },
      'Client application error'
    );

    // Rate limiting response headers (Requirement 12)
    if (err.statusCode === 429 || err.code === 'TOO_MANY_REQUESTS') {
      const resetSeconds = 60;
      res.setHeader('Retry-After', String(resetSeconds));
      res.setHeader('RateLimit-Limit', '100');
      res.setHeader('RateLimit-Remaining', '0');
      res.setHeader('RateLimit-Reset', String(resetSeconds));
      res.setHeader('X-RateLimit-Limit', '100');
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', String(resetSeconds));
    }

    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        correlationId,
        requestId: correlationId,
        details: Array.isArray(err.details) ? err.details : err.details ? [err.details] : []
      }
    });
  }

  // Handle Prisma errors safely
  if ((err as any).code === 'P2002') {
    logger.warn({ correlationId, target: (err as any).meta?.target }, 'Prisma unique constraint violation');
    return res.status(409).json({
      success: false,
      error: {
        code: 'CONFLICT',
        message: 'A resource with this identifier already exists.',
        correlationId,
        requestId: correlationId,
        details: [(err as any).meta?.target || 'unique_constraint']
      }
    });
  }

  if ((err as any).code === 'P2025') {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found.',
        correlationId,
        requestId: correlationId,
        details: []
      }
    });
  }

  // Unhandled / 500 error: redact and log full stack internally, return generic error to client
  logger.error(
    {
      correlationId,
      errorName: err.name,
      errorMessage: err.message,
      stack: err.stack
    },
    'Unhandled internal server error'
  );

  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected internal server error occurred.',
      correlationId,
      requestId: correlationId,
      details: []
    }
  });
}
