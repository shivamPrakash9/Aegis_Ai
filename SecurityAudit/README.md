# AegisAI — Security & Audit Service (Service 6)

## Overview
The **Security & Audit Service** is the central audit, compliance, and security monitoring microservice of the **AegisAI Enterprise AI Security & Governance Gateway**. It provides an append-only, tamper-resistant-by-design audit repository for tracking AI request lifecycles, DLP redaction findings, policy decisions, model invocations, and identity verifications across the enterprise platform.

### Primary Integration Points
1. **Event Ingestion**: `POST /v1/events` — Primary endpoint consumed by AI Gateway's `securityAuditClient.js` to emit security and lifecycle events.
2. **Trace Lookup**: `GET /v1/traces/:traceId?organizationId=...` — Directly queried by the AI Gateway to reconstruct the end-to-end processing pipeline of any AI request.
3. **Audit Search**: `GET /v1/events` — Multi-criteria search with tenant isolation, pagination, and NoSQL injection defenses.
4. **Integrity Verification**: `GET /v1/events/:eventId/verify` — Cryptographically validates the SHA-256 canonical digest to detect tampering.

---

## Architectural Principles & Guarantees

### 1. Dedicated Persistent Storage: MongoDB
- **Database**: `aegis_audit`
- **Collection**: `audit_events`
- **Indexes**:
  - `{ eventId: 1 }` (unique)
  - `{ organizationId: 1, ingestedAt: -1 }` (multi-tenant chronological index)
  - `{ organizationId: 1, traceId: 1 }` (fast trace lookup)
  - `{ organizationId: 1, requestId: 1 }` (request event lookup)
  - `{ organizationId: 1, eventType: 1 }` (type filtering)
  - `{ organizationId: 1, sourceEventId: 1 }` (sparse unique idempotency key)

### 2. Append-Only Immutability
- The service exposes **zero** `PUT`, `PATCH`, or `DELETE` endpoints for historical audit records.
- Historical records are immutable once persisted.

### 3. Cryptographic Tamper-Evidence (SHA-256 Canonical Digest)
- Each ingested event is assigned a server-controlled ingestion timestamp and a deterministic canonical representation:
  `eventId|eventVersion|eventType|occurredAt|organizationId|sourceService|requestId|traceId|severity|canonicalJson(details)`
- An SHA-256 cryptographic digest is calculated and stored alongside the record in `integrity: { digest, algorithm: 'sha256' }`.
- Any unauthorized database modification to metadata, event type, severity, or payload triggers a digest mismatch during verification.

### 4. Zero Sensitive Data Storage (DLP & Privacy Safeguards)
- The service enforces strict sanitization on all event metadata before persistence:
  - Raw prompts (`prompt`, `rawPrompt`, `userPrompt`), completions (`completion`, `rawCompletion`), credentials (`password`, `apiKey`, `token`, `secret`), and PII (`ssn`, `creditCard`) are automatically redacted with `[REDACTED_SENSITIVE_DATA]`.
  - Nested metadata depth is capped at 5 levels to prevent DoS via circular/deep payloads.
  - Large strings are bounded to 2000 characters.

### 5. Multi-Tenant Isolation & NoSQL Injection Immunity
- Every event query requires an authenticated tenant context (`organizationId`).
- Cross-tenant queries are blocked with `403 Forbidden`.
- Client query parameters are strictly sanitized: any keys containing MongoDB operators (`$`, `.`) are stripped to prevent NoSQL operator injection.

---

## Supported Event Taxonomy

| Category | Event Type | Description |
|---|---|---|
| **Identity** | `AUTH_SUCCESS` | Successful authentication |
| | `AUTH_FAILURE` | Failed authentication attempt |
| | `SESSION_REVOKED` | User session revoked |
| | `FORBIDDEN_ACCESS` | Unauthorized access attempt |
| **AI Gateway** | `AI_REQUEST_ACCEPTED` | Initial request accepted into processing pipeline |
| | `AI_REQUEST_COMPLETED` | Request successfully fulfilled |
| | `AI_REQUEST_BLOCKED_PRIVACY` | Blocked by Privacy Scanner DLP rule |
| | `AI_REQUEST_BLOCKED_POLICY` | Blocked by Policy & Governance decision |
| | `AI_REQUEST_WAITING_APPROVAL` | Suspended awaiting human reviewer decision |
| | `AI_REQUEST_FAILED` | Processing pipeline failure |
| **Privacy Scanner** | `PRIVACY_SCAN_COMPLETED` | Input prompt scanned for sensitive PII/secrets |
| | `SENSITIVE_DATA_DETECTED` | Confidential entity detected |
| | `REQUEST_MASKED` | Prompt sanitized with synthetic tokens |
| **Policy Approval** | `POLICY_EVALUATION_COMPLETED` | Governance rule evaluation complete |
| | `APPROVAL_GRANTED` | Designated reviewer approved suspended request |
| | `APPROVAL_REJECTED` | Designated reviewer rejected suspended request |
| **Model Provider** | `MODEL_INVOCATION_STARTED` | Outbound LLM provider call dispatched |
| | `MODEL_INVOCATION_COMPLETED` | LLM inference completed successfully |
| | `MODEL_RATE_LIMITED` | Provider 429 rate limit encountered |

---

## API Reference

### 1. Ingest Event
`POST /v1/events`
- **Headers**:
  - `Authorization: Bearer <jwt>` OR `X-Internal-Service-Key: <key>`
  - `Content-Type: application/json`
  - `X-Correlation-Id: <id>`
- **Request Body**:
  ```json
  {
    "eventType": "AI_REQUEST_COMPLETED",
    "organizationId": "org_enterprise_alpha",
    "requestId": "req_019283",
    "traceId": "trace_abc123",
    "callerId": "user_101",
    "severity": "INFO",
    "details": {
      "model": "mock-gpt-4",
      "tokens": 42
    }
  }
  ```
- **Response** (`201 Created` or `200 OK` for duplicate):
  ```json
  {
    "accepted": true,
    "eventId": "evt_7e52a9f14",
    "status": "PERSISTED"
  }
  ```

### 2. Retrieve Request Trace
`GET /v1/traces/:traceId?organizationId=org_enterprise_alpha`
- **Response** (`200 OK`):
  ```json
  {
    "traceId": "trace_abc123",
    "requestId": "req_019283",
    "events": [
      {
        "eventId": "evt_1",
        "eventType": "AI_REQUEST_ACCEPTED",
        "timestamp": "2026-10-21T03:00:00.000Z",
        "severity": "INFO",
        "details": { "step": "accepted" }
      },
      {
        "eventId": "evt_2",
        "eventType": "AI_REQUEST_COMPLETED",
        "timestamp": "2026-10-21T03:00:01.200Z",
        "severity": "INFO",
        "details": { "model": "mock-gpt-4", "tokens": 42 }
      }
    ]
  }
  ```

### 3. Verify Event Integrity
`GET /v1/events/:eventId/verify`
- **Response** (`200 OK`):
  ```json
  {
    "eventId": "evt_7e52a9f14",
    "verified": true,
    "digest": "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8",
    "storedDigest": "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8",
    "algorithm": "sha256",
    "reason": "Verified"
  }
  ```

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | HTTP port | `3005` |
| `NODE_ENV` | Runtime mode (`development`, `test`, `production`) | `development` |
| `MONGODB_URI` | MongoDB connection URI | `mongodb://localhost:27017/aegis_audit` |
| `MONGODB_DATABASE` | Database name | `aegis_audit` |
| `INTERNAL_SERVICE_KEY` | Secret key for internal microservices | `aegis_internal_service_secret_key_dev` |
| `JWT_SECRET` | Secret key for verifying caller tokens | `aegis_jwt_shared_secret_dev` |
| `MAX_REQUEST_BODY_BYTES` | Maximum incoming payload size | `262144` (256 KB) |
| `AUDIT_RETENTION_DAYS` | Compliance retention lifecycle | `90` |

---

## Running the Service

### Local Development
```bash
# Install dependencies
npm install

# Start development server with file watching
npm run dev
```

### Running Tests
```bash
# Run all unit, integration, and security test suites
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run security tests only
npm run test:security
```

### Docker
```bash
docker compose up -d
```
The Swagger UI documentation is available at `http://localhost:3005/docs`.
