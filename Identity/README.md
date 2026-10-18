# AegisAI — Identity Service (Service 1)

The **Identity Service** is the authoritative Identity and Access Management (IAM) microservice for the **AegisAI Enterprise AI Security & Governance Gateway**. It is independently deployable and provides tenant lifecycle management, Argon2id authentication, short-lived JWT access tokens, token family replay detection, service account machine identities, and session verification for the AI Gateway.

---

## 1. Responsibilities and Service Boundaries

### Core Responsibilities
- **Multi-Tenant Organization Management**: Register organizations, enforce tenant boundaries, and configure organization status.
- **User Authentication**: Authenticate users using Argon2id password hashing, issue short-lived JWT access tokens, and manage refresh token rotation with replay attack detection.
- **Organization User Management**: Manage user lifecycles, user activation/deactivation, and role assignments.
- **Machine Identity Management (Service Accounts)**: Create, rotate, and revoke service accounts for automated machine-to-machine agents and microservices with cryptographically secure API keys.
- **Session Verification**: Provide a dedicated verification endpoint (`POST /v1/sessions/verify`) allowing the AI Gateway to authenticate and extract caller identity without accessing the Identity Service database directly.
- **Role-Based Authorization (RBAC)**: Enforce granular permission checking across all protected endpoints.

### Out of Scope (Service Boundaries)
- **AI Request Routing & Proxying**: Owned by Service 2 (AI Gateway Service).
- **Privacy & DLP Scanning**: Owned by Service 3 (Privacy Scanner Service).
- **Policy Enforcement**: Owned by Service 4 (Policy & Approval Service).
- **Model Providers & LLM Integrations**: Owned by Service 5 (Model & Provider Service).
- **Audit Logging Storage & Request Traces**: Owned by Service 6 (Security & Audit Service).

Other services must interact with the Identity Service exclusively via REST API contracts (`/v1`). They must **never** connect to or query the `aegis_identity` database directly.

---

## 2. Technology Stack

- **Runtime**: Node.js v24 LTS
- **Language**: TypeScript (strict type checking)
- **HTTP Framework**: Express 5
- **Primary Database**: Dedicated PostgreSQL (`aegis_identity`)
- **ORM**: Prisma ORM v6
- **Password Hashing**: Argon2id (`argon2` with OWASP-recommended parameters)
- **Token Management**: JSON Web Tokens (`jsonwebtoken` with HS256 algorithm enforcement)
- **Validation**: JSON Schema with AJV (`ajv` + `ajv-formats`)
- **Logging**: Structured JSON logging with sensitive-field redaction (`pino`)
- **Testing**: Jest + Supertest (`ts-jest`)
- **Documentation**: OpenAPI 3.1 & Swagger UI (`/docs`)
- **Containerization**: Docker multi-stage build & Docker Compose

---

## 3. Dedicated Database Architecture

The Identity Service requires its own dedicated PostgreSQL database named:

```
aegis_identity
```

### Relational Schema Models
1. **`organizations`**: Multi-tenant boundary entity with unique slug and lifecycle status (`ACTIVE`, `SUSPENDED`, `DEACTIVATED`).
2. **`users`**: Organization-scoped users with normalized email uniqueness, Argon2id password hash, role (`ORGANIZATION_ADMIN`, `DEVELOPER`, `SECURITY_AUDITOR`), and status (`ACTIVE`, `INACTIVE`, `SUSPENDED`).
3. **`service_accounts`**: Machine identities with unique public `key_prefix` (e.g. `aegis_sa_9b8c12a4`), SHA-256 hashed secret, granular permissions array, and lifecycle status (`ACTIVE`, `INACTIVE`, `REVOKED`).
4. **`refresh_tokens`**: Hashed session tokens with `family_id` for rotation and automated replay attack detection.

---

## 4. Environment Variables

Copy `.env.example` to `.env` before running the service:

```bash
cp .env.example .env
```

| Variable | Description | Example / Default |
|---|---|---|
| `PORT` | HTTP server port | `3001` |
| `NODE_ENV` | Runtime environment (`development`, `production`, `test`) | `development` |
| `LOG_LEVEL` | Logging verbosity (`debug`, `info`, `warn`, `error`) | `info` |
| `CORS_ORIGINS` | Comma-separated allowed origins | `http://localhost:3000,http://localhost:5173` |
| `IDENTITY_DATABASE_URL` | Dedicated PostgreSQL connection URL | `postgresql://aegis_id_user:password@localhost:5432/aegis_identity?schema=public` |
| `JWT_ACCESS_SECRET` | Secret key for signing access tokens (min 32 chars) | `your_super_secret_jwt_access_key_min_32_chars!` |
| `JWT_ACCESS_TTL` | Access token time-to-live | `15m` |
| `JWT_REFRESH_SECRET` | Secret key for refresh tokens (min 32 chars) | `your_super_secret_jwt_refresh_key_min_32_chars!` |
| `JWT_REFRESH_TTL` | Refresh token time-to-live | `7d` |
| `JWT_ISSUER` | Trusted JWT issuer claim (`iss`) | `aegis-identity-service` |
| `JWT_AUDIENCE` | Expected JWT audience claim (`aud`) | `aegis-gateway` |
| `ADMIN_BOOTSTRAP_KEY` | One-time secret key for administrative bootstrap | `bootstrap_secret_token_change_in_production` |
| `REDIS_URL` | (Optional) Redis connection URL for distributed rate limiting | `redis://localhost:6379` |

---

## 5. Local Setup and Migration Instructions

### Prerequisites
- Node.js `v20+` or `v24+`
- PostgreSQL `15+` or `16+`

### Installation
```bash
npm install
```

### Database Schema Generation & Migrations
```bash
# Generate Prisma Client
npm run db:generate

# Apply migrations to development database
npm run db:migrate

# Deploy migrations in production / CI
npm run db:deploy

# Inspect migration status
npm run db:status
```

---

## 6. Secure Administrator Bootstrap

To prevent unauthorized public administrator registration, initialize the first organization and administrator using the secure CLI bootstrap script:

```bash
npm run bootstrap:admin -- \
  --org-name="Aegis Root Enterprise" \
  --org-slug="aegis-root" \
  --admin-email="admin@aegis.local" \
  --admin-password="StrongAdminPassword123!" \
  --admin-name="Primary Administrator"
```

The script verifies that an administrator does not already exist and securely generates the initial administrator account.

Alternatively, the initial administrator can be provisioned via the API using `POST /v1/organizations` with the `bootstrapKey` configured in `ADMIN_BOOTSTRAP_KEY`.

---

## 7. Development & Production Run Commands

```bash
# Start development server with live reload
npm run dev

# Type check codebase
npm run typecheck

# Build production bundle
npm run build

# Start production server
npm run start
```

---

## 8. Automated Testing

The service includes comprehensive unit and integration test suites covering Argon2id hashing, timing protection, JWT verification, tenant isolation, privilege escalation protection, service accounts, and session verification.

```bash
# Run all unit and integration tests (70 tests)
npm run test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration
```

---

## 9. API Endpoints Summary

Base URL: `/v1` (Interactive Swagger documentation available at `http://localhost:3001/docs` and `/openapi.json`)

### Health
- `GET /health/live` — Liveness probe (returns 200 UP)
- `GET /health/ready` — Readiness probe (validates PostgreSQL connectivity; returns 200 UP or 503 DOWN without exposing credentials)

### Organizations
- `POST /v1/organizations` — Register an organization (with optional bootstrap key gating)
- `GET /v1/organizations/:organizationId` — Retrieve organization details (requires `organization:read` permission; enforces tenant isolation)
- `PATCH /v1/organizations/:organizationId` — Update organization (requires `organization:update` permission)

### Authentication
- `POST /v1/auth/login` — Authenticate with email and password; returns user profile and access/refresh token pair
- `POST /v1/auth/refresh` — Rotate refresh token; detects compromised token replay and revokes token family
- `POST /v1/auth/logout` — Terminate session family
- `GET /v1/auth/me` — Return caller's authenticated identity, organization, role, and permissions

### User Management
- `POST /v1/users` — Create user within caller's organization (requires `users:create`; prevents non-admins from creating admin users)
- `GET /v1/users` — List organization users with pagination (requires `users:read`; never returns password hashes)
- `GET /v1/users/:userId` — Retrieve user profile within caller's organization (requires `users:read`)
- `PATCH /v1/users/:userId` — Update user profile (requires `users:update`; role changes restricted to admins)
- `POST /v1/users/:userId/disable` — Deactivate user and immediately revoke all active refresh tokens (requires `users:disable`)

### Service Accounts
- `POST /v1/service-accounts` — Create machine identity; returns one-time API key (format: `aegis_sa_<prefix>_<secret>`)
- `GET /v1/service-accounts` — List service accounts (never returns secrets)
- `GET /v1/service-accounts/:serviceAccountId` — Get service account metadata
- `POST /v1/service-accounts/:serviceAccountId/rotate` — Rotate secret and issue new one-time API key
- `POST /v1/service-accounts/:serviceAccountId/revoke` — Revoke service account

### Session Verification (For AI Gateway)
- `POST /v1/sessions/verify` — Verify JWT or Service Account API key and return authenticated caller principal context without leaking credentials.

---

## 10. Authentication & Authorization Flow

### User Login Example
```bash
curl -X POST http://localhost:3001/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "developer@aegis.local",
    "password": "ValidPassword123!"
  }'
```

Response:
```json
{
  "user": {
    "id": "e3b0c442-98fc-1c14-9afb-4c72a8698302",
    "organizationId": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    "email": "developer@aegis.local",
    "displayName": "Developer One",
    "role": "DEVELOPER",
    "status": "ACTIVE",
    "lastLoginAt": "2026-10-19T01:00:00.000Z",
    "createdAt": "2026-10-19T00:00:00.000Z",
    "updatedAt": "2026-10-19T01:00:00.000Z"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsIn...",
    "refreshToken": "6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b...",
    "expiresIn": 900,
    "tokenType": "Bearer"
  }
}
```

### Gateway Credential Verification Example
```bash
curl -X POST http://localhost:3001/v1/sessions/verify \
  -H "Content-Type: application/json" \
  -d '{
    "token": "eyJhbGciOiJIUzI1NiIsIn..."
  }'
```

Response:
```json
{
  "valid": true,
  "principal": {
    "id": "e3b0c442-98fc-1c14-9afb-4c72a8698302",
    "organizationId": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    "type": "USER",
    "email": "developer@aegis.local",
    "displayName": "Developer One",
    "role": "DEVELOPER",
    "permissions": [
      "organization:read",
      "users:read",
      "service_accounts:read"
    ]
  },
  "expiresAt": "2026-10-19T01:15:00.000Z"
}
```

---

## 11. Docker Deployment

### Start with Docker Compose
To run both the dedicated PostgreSQL database and the Identity Service container:

```bash
docker compose up -d
```

### Inspect Container Logs
```bash
docker compose logs -f identity-service
```

---

## 12. Security Considerations

1. **Zero Secret Leakage**: Passwords, password hashes, and JWT secrets are never returned in API responses or written to logs.
2. **Timing Attack Mitigation**: Login verification executes dummy Argon2id verifications for non-existent users to maintain uniform response times.
3. **Privilege Escalation Protection**: Callers can neither promote themselves to `ORGANIZATION_ADMIN` nor grant permissions to service accounts that they do not possess.
4. **Replay Detection**: Refresh tokens are family-tracked. Replaying an already rotated token immediately invalidates all active sessions for that token family.
5. **Multi-Tenant Isolation**: Database queries enforce organization ID scoping, ensuring cross-tenant data access is strictly forbidden.
