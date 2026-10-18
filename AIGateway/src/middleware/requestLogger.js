// Request Logging Middleware with Correlation ID Tracking

const { getOrGenerateCorrelationId } = require('../utils/correlationId');
const { logger } = require('../utils/logger');

function requestLogger(req, res, next) {
  const correlationId = getOrGenerateCorrelationId(
    req.headers['x-correlation-id'] || req.headers['correlation-id']
  );

  req.correlationId = correlationId;
  res.setHeader('X-Correlation-Id', correlationId);

  const start = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const logLevel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    logger[logLevel](
      {
        correlationId,
        method: req.method,
        path: req.originalUrl || req.url,
        statusCode: res.statusCode,
        durationMs,
        ip: req.ip || req.socket.remoteAddress
      },
      'HTTP Request completed'
    );
  });

  next();
}

module.exports = { requestLogger };
