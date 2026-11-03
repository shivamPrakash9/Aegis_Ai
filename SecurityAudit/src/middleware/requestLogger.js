// Request/Response Tracing and Correlation Logging Middleware

const { generateCorrelationId } = require('../utils/correlationId');
const { logger } = require('../utils/logger');

function requestLogger(req, res, next) {
  const correlationId =
    req.headers['x-correlation-id'] || generateCorrelationId();
  const traceId = req.headers['x-trace-id'] || null;

  req.correlationId = correlationId;
  req.traceId = traceId;

  res.setHeader('X-Correlation-Id', correlationId);
  if (traceId) {
    res.setHeader('X-Trace-Id', traceId);
  }

  const startTime = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    logger.info(
      {
        correlationId,
        traceId,
        method: req.method,
        path: req.originalUrl || req.url,
        statusCode: res.statusCode,
        durationMs
      },
      'HTTP Request completed'
    );
  });

  next();
}

module.exports = { requestLogger };
