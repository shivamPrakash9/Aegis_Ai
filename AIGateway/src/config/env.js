// Environment Configuration and Validation

const dotenv = require('dotenv');

dotenv.config();

if (!process.env.GATEWAY_DATABASE_URL) {
  process.env.GATEWAY_DATABASE_URL = 'postgresql://aegis_gateway_user:aegis_gateway_secure_password@localhost:5432/aegis_gateway?schema=public';
}
if (!process.env.REDIS_URL) {
  process.env.REDIS_URL = 'redis://localhost:6379';
}

const env = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',

  // Database
  databaseUrl: process.env.GATEWAY_DATABASE_URL,

  // Redis
  redisUrl: process.env.REDIS_URL,

  // Downstream Microservices
  identityServiceUrl: (process.env.IDENTITY_SERVICE_URL || 'http://localhost:3000').replace(/\/$/, ''),
  privacyScannerUrl: (process.env.PRIVACY_SCANNER_URL || 'http://localhost:3002').replace(/\/$/, ''),
  policyServiceUrl: (process.env.POLICY_SERVICE_URL || 'http://localhost:3003').replace(/\/$/, ''),
  modelProviderUrl: (process.env.MODEL_PROVIDER_SERVICE_URL || 'http://localhost:3004').replace(/\/$/, ''),
  securityAuditUrl: (process.env.SECURITY_AUDIT_SERVICE_URL || 'http://localhost:3005').replace(/\/$/, ''),

  // Idempotency and Rate Limiting
  idempotencyTtlSeconds: parseInt(process.env.IDEMPOTENCY_TTL_SECONDS || '86400', 10),
  rateLimitWindowSeconds: parseInt(process.env.RATE_LIMIT_WINDOW_SECONDS || '60', 10),
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),

  // Resilience & Timeouts
  requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS || '15000', 10),
  maxRequestBodyBytes: parseInt(process.env.MAX_REQUEST_BODY_BYTES || '1048576', 10), // 1MB default

  // Security & Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  corsOrigins: process.env.CORS_ORIGINS || '*'
};

// Validate required configurations in production
if (env.isProduction) {
  if (!process.env.GATEWAY_DATABASE_URL) {
    throw new Error('GATEWAY_DATABASE_URL is required in production mode.');
  }
}

module.exports = { env };
