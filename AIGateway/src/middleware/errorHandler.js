// Global Centralized Error Handler Middleware
// Conforms to Web Services Assignment Module 2 Requirement 9 & 12

const { AppError } = require('../utils/errors');
const { logger } = require('../utils/logger');

function errorHandler(err, req, res, _next) {
  const correlationId = req.correlationId || req.headers['x-correlation-id'] || 'unknown';

  // Handled operational AppError instances
  if (err instanceof AppError) {
    logger.warn(
      {
        correlationId,
        statusCode: err.statusCode,
        code: err.code,
        message: err.message,
        details: err.details
      },
      'Client operational error'
    );

    // Rate limiting response headers (Requirement 12)
    if (err.statusCode === 429 || err.code === 'TOO_MANY_REQUESTS') {
      const resetSeconds = err.rateLimitInfo?.resetSeconds || 60;
      res.setHeader('Retry-After', String(resetSeconds));
      res.setHeader('RateLimit-Limit', String(err.rateLimitInfo?.limit || 100));
      res.setHeader('RateLimit-Remaining', String(err.rateLimitInfo?.remaining || 0));
      res.setHeader('RateLimit-Reset', String(resetSeconds));
      res.setHeader('X-RateLimit-Limit', String(err.rateLimitInfo?.limit || 100));
      res.setHeader('X-RateLimit-Remaining', String(err.rateLimitInfo?.remaining || 0));
      res.setHeader('X-RateLimit-Reset', String(resetSeconds));
    }

    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: Array.isArray(err.details) ? err.details : err.details ? [err.details] : [],
        correlationId,
        requestId: correlationId
      }
    });
  }

  // Handle JSON parsing syntax errors (e.g. malformed body)
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: 'Malformed JSON payload in request body',
        details: [err.message],
        correlationId,
        requestId: correlationId
      }
    });
  }

  // Handle payload too large
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      error: {
        code: 'CONTENT_TOO_LARGE',
        message: 'Request payload exceeds maximum allowed size',
        details: [],
        correlationId,
        requestId: correlationId
      }
    });
  }

  // Handle Prisma unique constraint violation safely
  if (err.code === 'P2002') {
    return res.status(409).json({
      success: false,
      error: {
        code: 'CONFLICT',
        message: 'A resource with this key or identifier already exists',
        details: err.meta?.target ? [String(err.meta.target)] : [],
        correlationId,
        requestId: correlationId
      }
    });
  }

  // Unhandled / 500 error: mask internal details and log stack internally
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
      details: [],
      correlationId,
      requestId: correlationId
    }
  });
}

module.exports = { errorHandler };
