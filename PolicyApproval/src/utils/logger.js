// Structured Logger with Strict Sensitive Data Redaction

const pino = require('pino');

const sensitiveFields = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'req.headers["x-internal-service-key"]',
  'authorization',
  'cookie',
  'password',
  'token',
  'apiKey',
  'api_key',
  'client_secret',
  'secret',
  'messages',
  'content',
  'prompt'
];

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: sensitiveFields,
    censor: '[REDACTED]'
  },
  base: {
    service: 'PolicyApproval'
  },
  timestamp: pino.stdTimeFunctions.isoTime
});

module.exports = { logger };
