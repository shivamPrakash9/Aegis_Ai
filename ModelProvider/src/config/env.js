// Environment Configuration and Validation for Model & Provider Microservice

const dotenv = require('dotenv');
const path = require('path');

dotenv.config();
// Also attempt loading root project .env if present
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

if (!process.env.MODEL_DATABASE_URL) {
  process.env.MODEL_DATABASE_URL =
    'postgresql://aegis_model_user:aegis_model_secure_password@localhost:5432/aegis_model?schema=public';
}

const env = {
  port: parseInt(process.env.MODEL_PORT || '3004', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',

  // Database
  databaseUrl: process.env.MODEL_DATABASE_URL,

  // Authentication & Internal Security
  modelJwtSecret:
    process.env.MODEL_JWT_SECRET ||
    process.env.JWT_SECRET ||
    process.env.JWT_ACCESS_SECRET ||
    (process.env.NODE_ENV === 'test'
      ? 'test_jwt_access_secret_minimum_32_characters_long_12345'
      : 'dev_jwt_access_secret_minimum_32_characters_long_12345'),
  modelJwtIssuer: process.env.MODEL_JWT_ISSUER || 'aegis-identity-service',
  modelJwtAudience: process.env.MODEL_JWT_AUDIENCE || 'aegis-gateway',
  internalServiceKey: process.env.INTERNAL_SERVICE_KEY || 'aegis_internal_service_key_dev_only',
  encryptionKey:
    process.env.MODEL_PROVIDER_ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',

  // Downstream / Peer Microservices
  identityServiceUrl: (process.env.IDENTITY_SERVICE_URL || 'http://localhost:3000').replace(/\/$/, ''),
  aiGatewayUrl: (process.env.AI_GATEWAY_URL || 'http://localhost:3001').replace(/\/$/, ''),

  // LLM Providers Configuration
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  geminiBaseUrl: (process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com').replace(/\/$/, ''),
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiBaseUrl: (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  anthropicBaseUrl: (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, ''),
  groqApiKey: process.env.GROQ_API_KEY || '',
  groqBaseUrl: (process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/$/, ''),

  // Defaults & Catalog
  defaultModel:
    process.env.DEFAULT_MODEL ||
    (process.env.NODE_ENV === 'test'
      ? 'mock-gpt-4o'
      : process.env.GEMINI_API_KEY
      ? process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'
      : process.env.GROQ_API_KEY
      ? 'gpt-4o'
      : 'gpt-4o-mini'),
  defaultProvider:
    process.env.DEFAULT_PROVIDER ||
    (process.env.NODE_ENV === 'test'
      ? 'mock'
      : process.env.GEMINI_API_KEY
      ? 'gemini'
      : process.env.GROQ_API_KEY
      ? 'groq'
      : 'openai'),

  // Outbound Security & SSRF Protection
  allowedProviderHosts: (
    process.env.ALLOWED_PROVIDER_HOSTS ||
    'api.openai.com,api.anthropic.com,api.groq.com,openrouter.ai,api.mistral.ai,api.deepseek.com,generativelanguage.googleapis.com,127.0.0.1,localhost'
  )
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean),

  // Limits & Timeouts
  providerTimeoutMs: parseInt(process.env.PROVIDER_TIMEOUT_MS || '30000', 10),
  maxRequestBodyBytes: parseInt(process.env.MAX_REQUEST_BODY_BYTES || '1048576', 10), // 1MB
  maxTokensLimit: parseInt(process.env.MAX_TOKENS_LIMIT || '8192', 10),

  // Logging & CORS
  logLevel: process.env.LOG_LEVEL || 'info',
  corsOrigins: process.env.CORS_ORIGINS || '*'
};

if (env.isProduction) {
  if (!process.env.MODEL_DATABASE_URL) {
    throw new Error('MODEL_DATABASE_URL is required in production mode.');
  }
}

module.exports = { env };
