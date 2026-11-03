// Standardized Global Error Handler Middleware

const { AppError } = require('../utils/errors');
const { logger } = require('../utils/logger');
const { env } = require('../config/env');

function errorHandler(err, req, res, next) {
  const correlationId = req.correlationId || 'unknown';

  let statusCode = 500;
  let code = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected internal error occurred.';
  let details = undefined;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err.type === 'entity.too.large') {
    statusCode = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'Request body size exceeds maximum limit of 1MB.';
  } else if (err.name === 'SyntaxError' && err.status === 400 && 'body' in err) {
    statusCode = 400;
    code = 'BAD_REQUEST';
    message = 'Malformed JSON in request body.';
  }

  // Safe logging: Never log raw sensitive values, prompt payloads, or secrets
  logger.error(
    {
      correlationId,
      statusCode,
      code,
      message,
      path: req.originalUrl || req.path,
      method: req.method,
      stack: env.isProduction ? undefined : err.stack
    },
    'Request encountered error'
  );

  const errorResponse = {
    error: {
      code,
      message,
      correlationId,
      ...(details ? { details } : {})
    }
  };

  res.status(statusCode).json(errorResponse);
}

module.exports = { errorHandler };
