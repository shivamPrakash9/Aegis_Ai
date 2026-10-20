// Environment Configuration and Validation for Policy & Approval Microservice

const dotenv = require('dotenv');

dotenv.config();

if (!process.env.POLICY_DATABASE_URL) {
  process.env.POLICY_DATABASE_URL = 'postgresql://aegis_policy_user:aegis_policy_secure_password@localhost:5432/aegis_policy?schema=public';
}

const env = {
  port: parseInt(process.env.PORT || '3003', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',

  // Database
  databaseUrl: process.env.POLICY_DATABASE_URL,

  // Authentication & Internal Security
  policyJwtSecret: process.env.POLICY_JWT_SECRET || 'aegis_policy_dev_jwt_secret_change_in_production',
  policyJwtIssuer: process.env.POLICY_JWT_ISSUER || 'aegis-identity',
  policyJwtAudience: process.env.POLICY_JWT_AUDIENCE || 'aegis-policy',
  internalServiceKey: process.env.INTERNAL_SERVICE_KEY || 'aegis_internal_service_key_dev_only',

  // Downstream / Peer Microservices
  identityServiceUrl: (process.env.IDENTITY_SERVICE_URL || 'http://localhost:3000').replace(/\/$/, ''),
  aiGatewayUrl: (process.env.AI_GATEWAY_URL || 'http://localhost:3001').replace(/\/$/, ''),
  privacyScannerUrl: (process.env.PRIVACY_SCANNER_URL || 'http://localhost:3002').replace(/\/$/, ''),

  // Constraints & Timeouts
  maxRequestBodyBytes: parseInt(process.env.MAX_REQUEST_BODY_BYTES || '1048576', 10), // 1MB
  maxRulesPerPolicy: parseInt(process.env.MAX_RULES_PER_POLICY || '50', 10),
  maxConditionDepth: parseInt(process.env.MAX_CONDITION_DEPTH || '5', 10),
  requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS || '15000', 10),

  // Logging & CORS
  logLevel: process.env.LOG_LEVEL || 'info',
  corsOrigins: process.env.CORS_ORIGINS || '*'
};

if (env.isProduction) {
  if (!process.env.POLICY_DATABASE_URL) {
    throw new Error('POLICY_DATABASE_URL is required in production mode.');
  }
}

module.exports = { env };
