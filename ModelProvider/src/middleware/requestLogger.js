// Request Logger and Correlation/Trace Tracking Middleware

const { generateCorrelationId, generateTraceId } = require('../utils/correlationId');
const { logger } = require('../utils/logger');

function requestLogger(req, res, next) {
  const correlationId =
    req.headers['x-correlation-id'] ||
    req.headers['x-request-id'] ||
    generateCorrelationId();

  const traceId =
    req.headers['x-trace-id'] ||
    generateTraceId();

  req.correlationId = correlationId;
  req.traceId = traceId;

  res.setHeader('X-Correlation-Id', correlationId);
  res.setHeader('X-Trace-Id', traceId);

  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info(
      {
        correlationId,
        traceId,
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
