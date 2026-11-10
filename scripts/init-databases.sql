-- AegisAI Database Initialization Script
-- Creates dedicated users and isolated databases for all 5 PostgreSQL services

-- 1. Identity Service
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'aegis_identity_user') THEN
    CREATE USER aegis_identity_user WITH PASSWORD 'aegis_identity_secure_password' CREATEDB;
  END IF;
END $$;
SELECT 'CREATE DATABASE aegis_identity OWNER aegis_identity_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'aegis_identity')\gexec
GRANT ALL PRIVILEGES ON DATABASE aegis_identity TO aegis_identity_user;

-- 2. AI Gateway Service
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'aegis_gateway_user') THEN
    CREATE USER aegis_gateway_user WITH PASSWORD 'aegis_gateway_secure_password' CREATEDB;
  END IF;
END $$;
SELECT 'CREATE DATABASE aegis_gateway OWNER aegis_gateway_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'aegis_gateway')\gexec
GRANT ALL PRIVILEGES ON DATABASE aegis_gateway TO aegis_gateway_user;

-- 3. Privacy Scanner Service
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'aegis_privacy_user') THEN
    CREATE USER aegis_privacy_user WITH PASSWORD 'aegis_privacy_secure_password' CREATEDB;
  END IF;
END $$;
SELECT 'CREATE DATABASE aegis_privacy OWNER aegis_privacy_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'aegis_privacy')\gexec
GRANT ALL PRIVILEGES ON DATABASE aegis_privacy TO aegis_privacy_user;

-- 4. Policy Approval Service
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'aegis_policy_user') THEN
    CREATE USER aegis_policy_user WITH PASSWORD 'aegis_policy_secure_password' CREATEDB;
  END IF;
END $$;
SELECT 'CREATE DATABASE aegis_policy OWNER aegis_policy_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'aegis_policy')\gexec
GRANT ALL PRIVILEGES ON DATABASE aegis_policy TO aegis_policy_user;

-- 5. Model Provider Service
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'aegis_model_user') THEN
    CREATE USER aegis_model_user WITH PASSWORD 'aegis_model_secure_password' CREATEDB;
  END IF;
END $$;
SELECT 'CREATE DATABASE aegis_model OWNER aegis_model_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'aegis_model')\gexec
GRANT ALL PRIVILEGES ON DATABASE aegis_model TO aegis_model_user;

