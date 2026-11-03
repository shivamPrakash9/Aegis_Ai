// Environment Configuration and Validation for Privacy Scanner Microservice

const dotenv = require('dotenv');

dotenv.config();

if (!process.env.PRIVACY_DATABASE_URL) {
  process.env.PRIVACY_DATABASE_URL = 'postgresql://aegis_privacy_user:aegis_privacy_secure_password@localhost:5432/aegis_privacy?schema=public';
}

const env = {
  port: parseInt(process.env.PORT || '3002', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',

  // Dedicated Database
  databaseUrl: process.env.PRIVACY_DATABASE_URL,

  // Authentication & Internal Security
  privacyJwtSecret: process.env.PRIVACY_JWT_SECRET || 'aegis_privacy_dev_jwt_secret_change_in_production',
  privacyJwtIssuer: process.env.PRIVACY_JWT_ISSUER || 'aegis-identity',
  privacyJwtAudience: process.env.PRIVACY_JWT_AUDIENCE || 'aegis-privacy',
  internalServiceKey: process.env.INTERNAL_SERVICE_KEY || 'aegis_internal_service_key_dev_only',

  // Downstream Identity Service (optional verification fallback)
  identityServiceUrl: (process.env.IDENTITY_SERVICE_URL || 'http://localhost:3000').replace(/\/$/, ''),

  // Scanner Protection & Content Limits
  maxRequestBodyBytes: parseInt(process.env.MAX_REQUEST_BODY_BYTES || '1048576', 10), // 1MB default
  maxContentLength: parseInt(process.env.MAX_CONTENT_LENGTH || '50000', 10), // 50k chars per message
  maxScanItems: parseInt(process.env.MAX_SCAN_ITEMS || '100', 10), // 100 messages max
  scanTimeoutMs: parseInt(process.env.SCAN_TIMEOUT_MS || '5000', 10),

  // Default Scanner Rules
  defaultMode: process.env.PRIVACY_DEFAULT_MODE || 'MASK',
  rulesetVersion: process.env.PRIVACY_RULESET_VERSION || '1.0.0',

  // Logging & CORS
  logLevel: process.env.LOG_LEVEL || 'info',
  corsOrigins: process.env.CORS_ORIGINS || '*'
};

if (env.isProduction) {
  if (!process.env.PRIVACY_DATABASE_URL) {
    throw new Error('PRIVACY_DATABASE_URL is required in production mode.');
  }
  if (!process.env.PRIVACY_JWT_SECRET && !process.env.INTERNAL_SERVICE_KEY) {
    throw new Error('PRIVACY_JWT_SECRET or INTERNAL_SERVICE_KEY is required in production mode.');
  }
}

module.exports = { env };
