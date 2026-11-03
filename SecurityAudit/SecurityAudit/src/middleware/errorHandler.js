// Central Error Handling Middleware for Security & Audit Microservice

const { AppError } = require('../utils/errors');
const { logger } = require('../utils/logger');
const { env } = require('../config/env');

function errorHandler(err, req, res, next) {
  const correlationId = req.correlationId || 'unknown';
  const traceId = req.traceId || null;

  let statusCode = 500;
  let code = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected internal error occurred.';
  let details = null;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err.status && typeof err.status === 'number') {
    // Body-parser or Express syntax errors
    statusCode = err.status;
    code = 'BAD_REQUEST';
    message = err.message;
  }

  // Safe logging: never log raw prompts or passwords
  logger.error(
    {
      correlationId,
      traceId,
      statusCode,
      code,
      message,
      path: req.originalUrl || req.url,
      method: req.method,
      stack: env.isProduction ? undefined : err.stack
    },
    'Request encountered error'
  );

  res.status(statusCode).json({
    error: {
      code,
      message,
      statusCode,
      correlationId,
      traceId,
      details: details || undefined
    }
  });
}

module.exports = { errorHandler };
