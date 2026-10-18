// Structured Logger with Sensitive-Field Redaction

import pino from 'pino';

const sensitiveKeys = [
  'password',
  'passwordHash',
  'secret',
  'apiKey',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'Authorization',
  'cookie',
  'secretHash',
  'IDENTITY_DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'ADMIN_BOOTSTRAP_KEY'
];

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      ...sensitiveKeys,
      ...sensitiveKeys.map((key) => `*.${key}`),
      ...sensitiveKeys.map((key) => `*.*.${key}`),
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.secret',
      'req.body.apiKey'
    ],
    censor: '[REDACTED]'
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label.toUpperCase() })
  }
});
