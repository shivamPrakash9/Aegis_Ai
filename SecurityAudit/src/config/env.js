// Environment Configuration and Validation for Security & Audit Microservice

const dotenv = require('dotenv');

dotenv.config();

const env = {
  port: parseInt(process.env.PORT || '3005', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
  logLevel: process.env.LOG_LEVEL || 'info',

  // MongoDB Configuration
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/aegis_audit',
  mongodbDatabase: process.env.MONGODB_DATABASE || 'aegis_audit',

  // Service Authentication
  internalServiceKey: process.env.INTERNAL_SERVICE_KEY || 'aegis_internal_service_secret_key_dev',
  jwtSecret: process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET || (process.env.NODE_ENV === 'test' ? 'test_jwt_access_secret_minimum_32_characters_long_12345' : 'dev_jwt_access_secret_minimum_32_characters_long_12345'),
  jwtIssuer: process.env.JWT_ISSUER || 'aegis-identity-service',
  jwtAudience: process.env.JWT_AUDIENCE || 'aegis-gateway',

  // Downstream / Peer Microservices
  aiGatewayUrl: (process.env.AI_GATEWAY_URL || 'http://localhost:3001').replace(/\/$/, ''),
  identityServiceUrl: (process.env.IDENTITY_SERVICE_URL || 'http://localhost:3000').replace(/\/$/, ''),

  // Constraints and Limits
  maxRequestBodyBytes: parseInt(process.env.MAX_REQUEST_BODY_BYTES || '262144', 10), // 256KB
  maxMetadataDepth: parseInt(process.env.MAX_METADATA_DEPTH || '5', 10),
  maxQueryPageSize: parseInt(process.env.MAX_QUERY_PAGE_SIZE || '100', 10),
  defaultPageSize: parseInt(process.env.DEFAULT_PAGE_SIZE || '20', 10),
  auditRetentionDays: parseInt(process.env.AUDIT_RETENTION_DAYS || '90', 10)
};

// Fail closed in production mode if required security keys are missing
if (env.isProduction) {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required in production environment.');
  }
  if (!process.env.INTERNAL_SERVICE_KEY || process.env.INTERNAL_SERVICE_KEY.length < 16) {
    throw new Error('INTERNAL_SERVICE_KEY must be configured with at least 16 characters in production.');
  }
}

module.exports = { env };
