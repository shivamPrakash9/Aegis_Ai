// Structured Logging with Sensitive Field Scrubbing (Zero Raw Prompts/Completions in Logs)

const pino = require('pino');

const sensitiveFields = [
  'authorization',
  'headers.authorization',
  'x-internal-service-key',
  'apiKey',
  'openaiApiKey',
  'anthropicApiKey',
  'key',
  'token',
  'secret',
  'password',
  'messages',
  'message.content',
  'content',
  'prompt',
  'completion',
  'sanitizedResult',
  'rawBody'
];

const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
  base: { service: 'ModelProvider' },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: sensitiveFields,
    censor: '[REDACTED]'
  }
});

module.exports = { logger };
