// Environment Variable Configuration & Strict Startup Validation

import dotenv from 'dotenv';
dotenv.config();

export interface AppConfig {
  port: number;
  nodeEnv: string;
  corsOrigins: string[];
  databaseUrl: string;
  jwt: {
    accessSecret: string;
    accessTtl: string;
    refreshSecret: string;
    refreshTtl: string;
    issuer: string;
    audience: string;
  };
  adminBootstrapKey?: string;
  redisUrl?: string;
}

export function loadAndValidateConfig(): AppConfig {
  const port = parseInt(process.env.PORT || '3001', 10);
  const nodeEnv = process.env.NODE_ENV || 'development';
  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
    : ['*'];

  const databaseUrl = process.env.IDENTITY_DATABASE_URL || '';
  const accessSecret = process.env.JWT_ACCESS_SECRET || '';
  const accessTtl = process.env.JWT_ACCESS_TTL || '15m';
  const refreshSecret = process.env.JWT_REFRESH_SECRET || '';
  const refreshTtl = process.env.JWT_REFRESH_TTL || '7d';
  const issuer = process.env.JWT_ISSUER || 'aegis-identity-service';
  const audience = process.env.JWT_AUDIENCE || 'aegis-gateway';
  const adminBootstrapKey = process.env.ADMIN_BOOTSTRAP_KEY;
  const redisUrl = process.env.REDIS_URL;

  // Validation rules:
  // In production or when strictly checking, secrets must be present and at least 32 characters
  const errors: string[] = [];

  if (!databaseUrl && nodeEnv === 'production') {
    errors.push('IDENTITY_DATABASE_URL is required in production.');
  }

  if (nodeEnv === 'production') {
    if (!accessSecret || accessSecret.length < 32) {
      errors.push('JWT_ACCESS_SECRET must be defined and at least 32 characters in production.');
    }
    if (!refreshSecret || refreshSecret.length < 32) {
      errors.push('JWT_REFRESH_SECRET must be defined and at least 32 characters in production.');
    }
  }

  // Provide sensible fallback secrets for test/dev if not provided to ensure unit tests run cleanly
  const finalAccessSecret =
    accessSecret || (nodeEnv === 'test' ? 'test_jwt_access_secret_minimum_32_characters_long_12345' : 'dev_jwt_access_secret_minimum_32_characters_long_12345');
  const finalRefreshSecret =
    refreshSecret || (nodeEnv === 'test' ? 'test_jwt_refresh_secret_minimum_32_characters_long_12345' : 'dev_jwt_refresh_secret_minimum_32_characters_long_12345');

  if (errors.length > 0) {
    const errorMsg = `[Configuration Error] Critical configuration missing:\n${errors.join('\n')}`;
    throw new Error(errorMsg);
  }

  return {
    port,
    nodeEnv,
    corsOrigins,
    databaseUrl,
    jwt: {
      accessSecret: finalAccessSecret,
      accessTtl,
      refreshSecret: finalRefreshSecret,
      refreshTtl,
      issuer,
      audience
    },
    adminBootstrapKey,
    redisUrl
  };
}

export const config = loadAndValidateConfig();
