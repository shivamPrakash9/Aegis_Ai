// Request Logger and Correlation ID Middleware

const { generateCorrelationId } = require('../utils/correlationId');
const { logger } = require('../utils/logger');

function requestLogger(req, res, next) {
  const correlationId =
    req.headers['x-correlation-id'] ||
    req.headers['x-request-id'] ||
    generateCorrelationId();

  req.correlationId = correlationId;
  res.setHeader('X-Correlation-Id', correlationId);

  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info(
      {
        correlationId,
        method: req.method,
        path: req.originalUrl || req.path,
        statusCode: res.statusCode,
        durationMs: duration
      },
      'HTTP Request completed'
    );
  });

  next();
}

module.exports = { requestLogger };
