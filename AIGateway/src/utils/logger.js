// Structured Logging with Pino and Sensitive Field Redaction

const pino = require('pino');

const isTest = process.env.NODE_ENV === 'test';
const isDev = process.env.NODE_ENV === 'development';

const logger = pino({
  level: isTest ? 'silent' : (process.env.LOG_LEVEL || 'info'),
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers["idempotency-key"]',
      'password',
      'secret',
      'token',
      'access_token',
      'refresh_token',
      'apiKey',
      'api_key',
      'prompt',
      'messages[*].content',
      'result.content'
    ],
    censor: '[REDACTED]'
  },
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname'
        }
      }
    : undefined
});

module.exports = { logger };
