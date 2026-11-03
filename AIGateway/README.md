# AegisAI — Service 2: AI Gateway Microservice

## 1. Service Purpose and Boundaries

The **AI Gateway Microservice** serves as the central control plane and security proxy for all enterprise AI interactions in AegisAI. It coordinates authentication verification, privacy scanning, policy governance, distributed rate limiting, and model provider routing.

### Service Responsibilities (What it owns)
- Orchestration of the 16-step AI request pipeline.
- AI request metadata and lifecycle state management (`ACCEPTED`, `PROCESSING`, `WAITING_FOR_APPROVAL`, `COMPLETED`, `BLOCKED`, `FAILED`).
- Distributed request idempotency coordination via Redis.
- Tenant and caller rate-limit enforcement.
- Privacy scanner integration, enforcing `ALLOW`, `BLOCK`, `MASK`, `ROUTE`, and `REQUIRE_APPROVAL` decisions.
- Enterprise policy evaluation enforcement prior to any provider invocation.
- Scoped AI request retrieval, listing, and trace inspection.
- Returning only sanitized, policy-permitted AI outputs to callers.

### Boundary Non-Goals (What it does NOT own)
- User passwords, refresh tokens, or organization registration (owned by **Identity Service**).
- Role definitions, user permissions, and IAM tables (owned by **Identity Service**).
- Privacy scanning detection algorithms or DLP regular expressions (owned by **Privacy Scanner Service**).
- Enterprise governance rule authoring and policy persistence (owned by **Policy & Approval Service**).
- LLM API keys and model credentials (owned by **Model & Provider Service**).
- Raw MongoDB audit log storage (owned by **Security & Audit Service**).

---

## 2. JavaScript-Only Architecture

In strict compliance with architectural directives:
- Implemented **exclusively in JavaScript (CommonJS)** running on Node.js v24 LTS.
- Express 5 HTTP framework.
- **No TypeScript annotations, no `.ts` files, and no `tsconfig.json` compiler configuration.**

---

## 3. Folder Structure

```
AgeisAi/AIGateway/
├── .env.example              # Environment variables template
├── .gitignore                # Git ignore patterns
├── Dockerfile                # Multi-stage production container
├── docker-compose.yml        # Dedicated PostgreSQL & Redis stack
├── jest.config.js            # Jest test configuration (pure JavaScript)
├── package.json              # Service manifest and dependencies
├── README.md                 # Service documentation
├── openapi/
│   └── ai-gateway.yaml       # OpenAPI 3.1 specification
├── prisma/
│   ├── schema.prisma         # Dedicated aegis_gateway schema
│   └── migrations/
│       └── 20261019000000_init/
│           └── migration.sql # Initial SQL schema migration
├── src/
│   ├── app.js                # Express app setup, CORS, Helmet, Swagger UI
│   ├── server.js             # Server startup and graceful shutdown
│   ├── config/
│   │   ├── env.js            # Environment configuration loader
│   │   ├── database.js       # Prisma client & connection health probe
│   │   └── redis.js          # Redis client with in-memory fallback
│   ├── utils/
│   │   ├── errors.js         # Standard error hierarchy
│   │   ├── logger.js         # Pino structured logger with redaction
│   │   └── correlationId.js  # Correlation ID & Trace ID utilities
│   ├── schemas/
│   │   └── aiRequest.schema.js # AJV JSON Schemas
│   ├── middleware/
│   │   ├── authenticate.js   # Identity Service session verification
│   │   ├── authorize.js      # Permission and role gating
│   │   ├── validate.js       # Request validation middleware
│   │   ├── requestLogger.js  # Request logging & correlation tracking
│   │   └── errorHandler.js   # Centralized error envelope handler
│   ├── repositories/
│   │   └── aiRequest.repository.js # PostgreSQL & in-memory repository
│   ├── clients/
│   │   ├── identityClient.js       # Identity Service client (POST /v1/sessions/verify)
│   │   ├── privacyScannerClient.js # Privacy Scanner client (POST /v1/scan)
│   │   ├── policyClient.js         # Policy Service client (POST /v1/evaluate)
│   │   ├── modelProviderClient.js  # Model Provider client (POST /v1/chat/completions)
│   │   └── securityAuditClient.js  # Security & Audit client (POST /v1/events)
│   ├── services/
│   │   ├── idempotency.service.js       # Distributed idempotency coordination
│   │   ├── rateLimiter.service.js       # Tenant & caller rate limiting
│   │   ├── privacyEnforcement.service.js# Decision enforcement & response filtering
│   │   ├── requestPipeline.service.js   # Central 16-step orchestration pipeline
│   │   └── aiRequest.service.js         # Request retrieval and listing logic
│   ├── controllers/
│   │   ├── health.controller.js    # Liveness and readiness probes
│   │   └── aiRequest.controller.js # AI request HTTP handlers
│   └── routes/
│       ├── health.routes.js    # /health/live and /health/ready
│       ├── aiRequest.routes.js # /v1/ai-requests
│       └── index.js            # Main router
└── tests/
    ├── fixtures/
    │   └── mockData.js         # Mock test principals and payloads
    ├── unit/
    │   ├── validation.test.js
    │   ├── idempotency.test.js
    │   ├── privacyEnforcement.test.js
    │   └── rateLimiter.test.js
    └── integration/
        ├── health.test.js
        ├── aiRequest.test.js
        └── tenantIsolation.test.js
```

---

## 4. Dependencies and Prerequisites

- **Node.js**: `v24.15.0+`
- **npm**: `11.12.1+`
- **PostgreSQL**: `16+` (for dedicated `aegis_gateway` database)
- **Redis**: `7+` (for distributed coordination)
- **Docker Desktop** (optional, for containerized run)

---

## 5. Environment Variables

Copy `.env.example` to `.env`:

| Variable | Description | Default |
|---|---|---|
| `PORT` | HTTP Server port | `3001` |
| `NODE_ENV` | Runtime environment (`development`, `test`, `production`) | `development` |
| `GATEWAY_DATABASE_URL` | Dedicated PostgreSQL connection URL | `postgresql://aegis_gateway_user:password@localhost:5432/aegis_gateway?schema=public` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `IDENTITY_SERVICE_URL` | Identity Service base URL | `http://localhost:3000` |
| `PRIVACY_SCANNER_URL` | Privacy Scanner base URL | `http://localhost:3002` |
| `POLICY_SERVICE_URL` | Policy & Approval Service base URL | `http://localhost:3003` |
| `MODEL_PROVIDER_SERVICE_URL` | Model & Provider Service base URL | `http://localhost:3004` |
| `SECURITY_AUDIT_SERVICE_URL` | Security & Audit Service base URL | `http://localhost:3005` |
| `IDEMPOTENCY_TTL_SECONDS` | Time-to-live for idempotency coordination | `86400` (24h) |
| `RATE_LIMIT_WINDOW_SECONDS`| Rate limiting sliding window | `60` |
| `RATE_LIMIT_MAX_REQUESTS` | Maximum requests per caller per window | `100` |
| `REQUEST_TIMEOUT_MS` | Outgoing HTTP request timeout | `15000` |
| `MAX_REQUEST_BODY_BYTES` | Maximum JSON request payload size | `1048576` (1MB) |
| `LOG_LEVEL` | Pino logging level (`info`, `warn`, `error`, `silent`) | `info` |
| `CORS_ORIGINS` | Allowed CORS origins | `*` |

---

## 6. PostgreSQL Setup & Migrations

The AI Gateway owns a dedicated PostgreSQL database named `aegis_gateway`. It strictly does **not** share tables with `aegis_identity`.

```bash
# Generate Prisma JavaScript Client
npm run db:generate

# Apply migrations to development database
npm run db:migrate

# Deploy migrations to production database
npm run db:deploy
```

*Note: For testing and local evaluation without a live PostgreSQL instance, the service includes an in-memory repository fallback that fully implements the domain contract.*

---

## 7. Redis Responsibilities

Redis handles high-frequency, short-lived coordination state:
1. **Idempotency**: Scoped keys (`aegis:gateway:idempotency:{orgId}:{key}`) store SHA-256 canonical fingerprints of request payloads and atomic `IN_PROGRESS` reservation locks. Replays with identical payloads return cached responses without re-invoking providers; conflicting payloads return `409 Conflict`.
2. **Distributed Rate Limiting**: Scoped keys (`aegis:gateway:ratelimit:{orgId}:{callerId}:{bucket}`) enforce quotas per tenant and caller.
3. **Resilience Fallback**: If Redis is unreachable, an in-memory TTL store ensures single-instance local resilience.

---

## 8. Identity Service Integration

The Gateway integrates with the Identity Service using its documented REST endpoint:
```http
POST /v1/sessions/verify
Content-Type: application/json

{
  "token": "<jwt-or-service-account-key>"
}
```

The returned verified principal is cached for 30 seconds to reduce inter-service latency while maintaining revocation safety.

---

## 9. API Examples

### Submit an AI Request
```http
POST /v1/ai-requests HTTP/1.1
Host: localhost:3001
Authorization: Bearer <valid_access_token>
Idempotency-Key: 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d
Content-Type: application/json

{
  "messages": [
    {
      "role": "user",
      "content": "Explain zero trust database security architecture."
    }
  ],
  "modelPreference": {
    "capability": "general",
    "provider": "openai",
    "model": "gpt-4o"
  },
  "metadata": {
    "source": "developer-console"
  }
}
```

**Response (`202 Accepted`):**
```json
{
  "requestId": "req_8ff1e93c12ba4d7890123456",
  "status": "ACCEPTED",
  "traceId": "trace_6b34fae890cd4a6190e29bca09",
  "createdAt": "2026-10-19T01:45:00.000Z",
  "statusUrl": "/v1/ai-requests/req_8ff1e93c12ba4d7890123456"
}
```

### Retrieve an AI Request
```http
GET /v1/ai-requests/req_8ff1e93c12ba4d7890123456 HTTP/1.1
Authorization: Bearer <valid_access_token>
```

**Response (`200 OK`):**
```json
{
  "id": "req_8ff1e93c12ba4d7890123456",
  "status": "COMPLETED",
  "modelSelected": "gpt-4o",
  "sanitizedResult": "Zero trust architecture requires continuous verification of every caller...",
  "traceId": "trace_6b34fae890cd4a6190e29bca09",
  "privacyAction": "ALLOW",
  "policyDecision": "ALLOW",
  "errorCode": null,
  "errorMessage": null,
  "createdAt": "2026-10-19T01:45:00.000Z",
  "updatedAt": "2026-10-19T01:45:01.000Z",
  "completedAt": "2026-10-19T01:45:01.000Z"
}
```

### List AI Requests (Organization Scoped)
```http
GET /v1/ai-requests?status=COMPLETED&page=1&limit=20 HTTP/1.1
Authorization: Bearer <valid_access_token>
```

### Retrieve Trace Events
```http
GET /v1/ai-requests/req_8ff1e93c12ba4d7890123456/trace HTTP/1.1
Authorization: Bearer <valid_access_token>
```

---

## 10. Startup and Test Commands

```bash
# Install dependencies
npm install

# Run automated test suite
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Start development server with file watch
npm run dev

# Start production server
npm start
```

---

## 11. Privacy Enforcement Guarantees & Security Rules

1. **Zero Provider Calls on BLOCK**: When the Privacy Scanner returns `BLOCK` or Policy Service returns `DENY`, model provider invocation is strictly bypassed (zero provider calls).
2. **Never Fallback to Raw Prompt on MASK**: When `MASK` is specified, only sanitized messages are forwarded. If masking fails to produce sanitized messages, the request is immediately aborted with `BLOCKED`.
3. **Mandatory Security Fail-Safe**: If the Privacy Scanner or Policy Service is unreachable or errors out, the Gateway fails safely with `503 Service Unavailable`. Content is **never** forwarded unscanned.
4. **Tenant Isolation**: Every database query, listing, and ID lookup enforces `organizationId` scoping. Requests from Tenant A return `404 Not Found` when accessed by Tenant B.
5. **No Credential Logging**: Tokens, passwords, and raw prompt content are scrubbed by Pino structured logging redaction paths.

---

## 12. Known Issues & Unimplemented Integrations

- **Downstream Services 3, 4, 5, 6**: The Privacy Scanner, Policy & Approval, Model Provider, and Security & Audit services are implemented via structured adapters and tested against mocks. As downstream services are implemented, live endpoints will be enabled without breaking the Gateway's interfaces.
- **Local PostgreSQL / Redis Daemons**: While the service is fully configured for live PostgreSQL (`aegis_gateway`) and Redis, in-memory repository and cache fallbacks allow complete offline verification and testing.
