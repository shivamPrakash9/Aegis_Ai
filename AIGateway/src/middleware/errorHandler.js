// Global Centralized Error Handler Middleware

const { AppError } = require('../utils/errors');
const { logger } = require('../utils/logger');

function errorHandler(err, req, res, _next) {
  const correlationId = req.correlationId || 'unknown';

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

    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        correlationId,
        ...(err.details ? { details: err.details } : {})
      }
    });
  }

  // Handle JSON parsing syntax errors (e.g. malformed body)
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: {
        code: 'INVALID_JSON',
        message: 'Malformed JSON payload in request body',
        correlationId
      }
    });
  }

  // Handle payload too large
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: {
        code: 'CONTENT_TOO_LARGE',
        message: 'Request payload exceeds maximum allowed size',
        correlationId
      }
    });
  }

  // Handle Prisma unique constraint violation safely
  if (err.code === 'P2002') {
    return res.status(409).json({
      error: {
        code: 'CONFLICT',
        message: 'A resource with this key or identifier already exists',
        correlationId
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
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected internal server error occurred.',
      correlationId
    }
  });
}

module.exports = { errorHandler };
