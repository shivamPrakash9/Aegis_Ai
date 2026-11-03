// Global Error Handler Middleware

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

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): Response {
  const correlationId = req.correlationId || 'unknown';

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

    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        correlationId,
        details: err.details
      }
    });
  }

  // Handle Prisma errors safely
  if ((err as any).code === 'P2002') {
    logger.warn({ correlationId, target: (err as any).meta?.target }, 'Prisma unique constraint violation');
    return res.status(409).json({
      error: {
        code: 'CONFLICT',
        message: 'A resource with this identifier already exists.',
        correlationId
      }
    });
  }

  if ((err as any).code === 'P2025') {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found.',
        correlationId
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
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected internal server error occurred.',
      correlationId
    }
  });
}
