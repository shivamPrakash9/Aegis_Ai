// Structured JSON Logger with Sensitive Data Redaction

const pino = require('pino');

const isTest = process.env.NODE_ENV === 'test';
const isDev = process.env.NODE_ENV === 'development';

const redactOptions = {
  paths: [
    'req.headers.authorization',
    'req.headers["x-internal-service-key"]',
    'authorization',
    'apiKey',
    'token',
    'password',
    'secret',
    'prompt',
    'completion',
    'rawPrompt',
    'rawCompletion',
    'messages',
    'creditCard',
    'ssn',
    '*.password',
    '*.apiKey',
    '*.token',
    '*.secret'
  ],
  censor: '[REDACTED]'
};

const logger = pino({
  level: isTest ? 'silent' : process.env.LOG_LEVEL || 'info',
  redact: redactOptions,
  base: {
    service: 'SecurityAudit'
  },
  timestamp: pino.stdTimeFunctions.isoTime
});

module.exports = { logger };
