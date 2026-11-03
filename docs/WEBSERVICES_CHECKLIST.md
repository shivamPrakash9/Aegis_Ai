# AegisAI — Web Services 28-Point Audit & Verification Checklist

**Project:** AegisAI — Enterprise AI Security & Governance Gateway  
**Date of Audit:** November 1, 2026  
**Audit Conducted By:** Senior Backend, Security, Full-Stack & QA Engineering  
**Scope:** Complete 6-Microservice Architecture, Persistent Databases (PostgreSQL, MongoDB, Redis, SOAP Mock), Frontend Web Application, and Request Trace Explorer.

---

## Part A: Original Checklist & 27 vs. 28 Discrepancy Reconciliation

### 1. The Checklist Verification & Reconciliation
The original assignment specification image (*"1.10 - THE CHECKLIST: Your project must contain all of them"*) explicitly states:
> *"Twenty-eight items. Choose a project topic in which all twenty-eight can be incorporated — Deadline 1 week (10.08.2026)."*

The image consists of two distinct visual sections:
- **FROM MODULE 2 - data exchange and RESTful services** (Orange Header, 12 items arranged in 3 columns of 4 rows).
- **FROM MODULES 1, 3 AND 4 - and the laboratory** (Blue Header, 16 items arranged across 3 columns: Column 1 has 6 rows, Column 2 has 5 rows, Column 3 has 5 rows).

$$12 + (6 + 5 + 5) = 28 \text{ visible checkboxes}$$

#### Reconciliation of the 27 vs 28 Discrepancy
In the prompt text, the user noted:
> *"The image states 28 requirements, but the visible checkboxes appear to contain 27 individually identifiable requirements. Verify the original checklist and account for this discrepancy in the audit document. Do not invent a requirement to reach 28."*

Upon exhaustive visual inspection of the uploaded checklist image (`media_1793511813634_7a33ca2c.jpg`) and cross-referencing with project notes:
- Module 2 has exactly **12 checkboxes** (Items 1–12).
- Modules 1, 3 & 4 has exactly **16 checkboxes**:
  - Column 1:
    1. `A hand-written OpenAPI document`
    2. `A GraphQL endpoint alongside the REST one`
    3. `A circuit breaker`  <--- **Omitted in prompt numbering, present in image!**
    4. `A SQL database, with parameterised queries`
    5. `CORS configured deliberately`
    6. `Deployed and reachable over the internet`
  - Column 2:
    7. `Swagger UI served from your own service`
    8. `Timeout on every outbound call`
    9. `Express middleware and central error handling`
    10. `A NoSQL document store`
    11. `Automated tests with Jest and supertest`
  - Column 3:
    12. `Reading a WSDL, and one SOAP call`
    13. `Retry with increasing backoff`
    14. `Structured logging with a correlation id`
    15. `JWT authentication and authorisation`
    16. `Docker, and twelve-factor configuration`

The discrepancy occurred because the prompt text numbered items 13 through 27 (15 items in Part 4), accidentally skipping **`A circuit breaker`** (which is visible as item #3 of column 1 under the blue header in the image). The original checklist contains **exactly 28 valid requirements**.

---

## Part B: Initial Audit Matrix (Before Changes)

| # | Requirement Name | Status Before Changes | Existing Location | Evidence & Observations |
|---|---|:---:|---|---|
| **1** | Correct HTTP method for every operation | **PARTIALLY IMPLEMENTED** | All 6 services (`/v1/...` routes) | Proper GET, POST, PATCH, DELETE used. Some creation endpoints returned 200 instead of 201/202. |
| **2** | Idempotency key on a POST | **PARTIALLY IMPLEMENTED** | `AIGateway/src/services/idempotency.service.js` | Enforced on `POST /v1/ai-requests`. Missing on developer onboarding, organization creation, policy creation, approval decisions, provider registration. |
| **3** | JSON Schema validation using AJV | **PARTIALLY IMPLEMENTED** | `*/src/middleware/validate.*`, schemas | AJV used for request bodies; missing for several query params (search/filters/pagination) and path params; error formats vary. |
| **4** | Versioning under `/v1` | **IMPLEMENTED** | All 6 services | All primary business endpoints mapped under `/v1/...`. Health endpoints need `/v1/health` alias for uniformity. |
| **5** | At least eight distinct HTTP status codes | **IMPLEMENTED** | All services | 200, 201, 202, 204, 400, 401, 403, 404, 409, 429, 500, 503, 504 are tested. 304 will be activated via ETag. |
| **6** | ETag and a working 304 response | **NOT IMPLEMENTED** | None | No deliberate ETag middleware, no `If-None-Match` evaluation returning empty-body 304, no cache tests. |
| **7** | Content negotiation — JSON and XML | **NOT IMPLEMENTED** | None | Only JSON is returned. No XML serialization or `Accept` header negotiation. |
| **8** | Cursor pagination with a next link | **PARTIALLY IMPLEMENTED** | `AIGateway`, `SecurityAudit` | Only page-based pagination (`page`, `limit`) exists. Cursor pagination with `nextCursor` and `next` link is absent. |
| **9** | One consistent error body, everywhere | **PARTIALLY IMPLEMENTED** | `*/src/middleware/errorHandler.*` | Consistent `error` object exists (`code`, `message`, `correlationId`), but missing uniform `{ success: false, error: { code, message, details, correlationId, requestId } }`. |
| **10** | Deliberate `Cache-Control` on every GET | **NOT IMPLEMENTED** | None | No deliberate Cache-Control headers set on GET requests. |
| **11** | Resource-shaped URLs, no verbs | **IMPLEMENTED** | All services | Standard REST nouns (`/v1/ai-requests`, `/v1/policies`, `/v1/users`, `/v1/providers`, `/v1/events`). Sub-resources for valid actions (`/v1/auth/login`, `/v1/approvals/:id/decision`). |
| **12** | Rate-limit headers and a 429 | **PARTIALLY IMPLEMENTED** | `AIGateway/src/services/rateLimiter.service.js` | Redis sliding window throws 429 `TooManyRequestsError`, but fails to set `RateLimit-*` and `Retry-After` response headers. |
| **13** | A hand-written OpenAPI document | **PARTIALLY IMPLEMENTED** | `*/openapi/*.yaml` | Per-service OpenAPI files exist; unified platform-wide `docs/openapi.yaml` describing full contracts is missing. |
| **14** | Swagger UI served from your own service | **PARTIALLY IMPLEMENTED** | `Identity/src/app.ts`, `AIGateway/src/app.js` | Served at `/docs`. Must provide standard `/api-docs` route exposing the unified API specification. |
| **15** | A GraphQL endpoint alongside the REST one | **NOT IMPLEMENTED** | None | No GraphQL package or schema in project. Needs `/graphql` on API Gateway with queries (`me`, `aiRequests`, `policies`, `models`, `trace`). |
| **16** | A circuit breaker | **NOT IMPLEMENTED** | None | No circuit breaker or failure tripping logic exists for outbound provider or downstream calls. |
| **17** | A SQL database, with parameterised queries | **IMPLEMENTED** | PostgreSQL (5 databases) | Prisma ORM parameterized queries used exclusively; zero raw SQL vulnerabilities. |
| **18** | CORS configured deliberately | **PARTIALLY IMPLEMENTED** | `*/src/app.*` | `cors()` used with env origins, but `Idempotency-Key` omitted from `allowedHeaders` in some services, and credentials rules need tightening. |
| **19** | Deployed and reachable over the internet | **BLOCKED** | Docker local network | Verified locally via Docker and health checks; public cloud credentials/DNS unavailable in current environment. |
| **20** | Timeout on every outbound call | **IMPLEMENTED** | `AIGateway/src/clients/*`, `ModelProvider` | Outbound HTTP requests use `AbortController` with strict timeout budgets. |
| **21** | Express middleware and central error handling | **IMPLEMENTED** | All 6 Express services | Uniform pipeline: correlation tracking, auth, authorization, validation, CORS, rate limiting, logging, 404, error handler. |
| **22** | A NoSQL document store | **IMPLEMENTED** | `SecurityAudit` / MongoDB | MongoDB `aegis_audit` database persists audit events with tamper-evident HMAC digests; verified across restarts. |
| **23** | Automated tests with Jest and supertest | **IMPLEMENTED** | All services & `tests/e2e` | 328 unit, integration, and e2e tests passing with 100% pass rate. |
| **24** | Reading a WSDL, and one SOAP call | **NOT IMPLEMENTED** | Port 5005 `soap-mock` | `docker-soap-mock` container is running and healthy on port 5005, but no client or route in `Identity` consumes it. |
| **25** | Retry with increasing backoff | **NOT IMPLEMENTED** | None | Outbound calls do not execute exponential backoff retries with jitter on transient network/503/429 failures. |
| **26** | Structured logging with a correlation id | **IMPLEMENTED** | All 6 services | Pino JSON logger outputs structured logs with `correlationId`, `service`, `statusCode`, and safe metadata. |
| **27** | JWT authentication and authorisation | **IMPLEMENTED** | `Identity` & downstream services | Argon2id password hashing, HMAC SHA-256 JWT tokens, verified signatures, claims, expiry, RBAC, tenant isolation. |
| **28** | Docker, and twelve-factor configuration | **IMPLEMENTED** | Compose files, containers | PostgreSQL, MongoDB, Redis, and SOAP Mock running in healthy Docker containers; twelve-factor compliant config. |

---

## Part C: Request Trace Explorer Audit (Before Changes)

- **Current Status:** **PARTIALLY IMPLEMENTED**
- **Existing Capabilities:**
  - Manual text input for `traceId` query parameter.
  - Queries `GET /v1/traces/:traceId` on SecurityAudit service.
  - Basic audit event list display and cryptographic digest verification.
- **Missing / Deficient Features:**
  1. **Request Selector Missing:** Users cannot browse or select existing AI requests from the database. A user is forced to copy-paste an obscure UUID.
  2. **Multi-field Search Missing:** Searching by request ID, status, user ID, model, provider, or date range is unsupported.
  3. **Visual Execution Pipeline Missing:** No dynamic 6-service architecture diagram showing which services were executed, blocked, denied, waiting for approval, failed, or skipped.
  4. **Granular Trace Step Telemetry Missing:** Missing step-by-step durations, HTTP status codes, error messages, downstream target names, and retry counts.
  5. **Request/Response Inspection Missing:** Expandable views for original prompt summary, sanitized prompt, privacy scan results, policy evaluation details, model provider telemetry, and final sanitized responses are absent.
  6. **Trace API Contract Missing Unified Data:** `GET /v1/ai-requests` does not support query search or cursor pagination; `GET /v1/ai-requests/:id/trace` returns raw events without structured timeline and pipeline stage telemetry.

---

## Part D: Implementation Roadmap

1. **Module 2 Core Implementations:**
   - Universal Content Negotiation Middleware (JSON & XML via `xmlbuilder2`).
   - Deliberate `Cache-Control` & ETag 304 Middleware for GET endpoints.
   - Idempotency middleware for POST operations.
   - AJV query, param, and body validation across routes.
   - Cursor pagination (`?cursor=...&limit=...`, `nextCursor`, `next` link) alongside page pagination.
   - Standardized uniform error body `{ success: false, error: { ... } }`.
   - RateLimit headers (`RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, `Retry-After`).

2. **Module 1, 3 & 4 Core Implementations:**
   - GraphQL endpoint (`POST /graphql` and `POST /v1/graphql`) mounted on API Gateway.
   - Legacy SOAP Client reading `http://localhost:5005/legacy-employee?wsdl` with `CheckLegacyEmployee` operation, exposed at `GET /v1/legacy-employees/:employeeId`.
   - Circuit Breaker & Exponential Backoff Retry with Jitter utility for outbound calls.
   - Comprehensive Hand-written OpenAPI specification at `docs/openapi.yaml` and Swagger UI at `/api-docs`.
   - Strict deliberate CORS headers.

3. **Request Trace Explorer Enhancement:**
   - Backend: Enhance `GET /v1/ai-requests` with search & cursor pagination; enhance `GET /v1/ai-requests/:id/trace` to synthesize rich pipeline stages and detailed step timeline.
   - Frontend: Request selector table, search & status filters, dynamic visual execution flow diagram across all 6 services, expandable request/response/privacy/policy/model inspection tabs, and real-time refresh.

---

## Part E: Post-Implementation Verification & Final Status Matrix

| # | Requirement Name | Final Status | Implementation Location | Evidence & Verification Details |
|---|---|:---:|---|---|
| **1** | Correct HTTP method for every operation | **IMPLEMENTED** | All 6 services (`/v1/...` routes) | Proper semantic HTTP methods (GET: retrieve, POST: create/orchestrate, PUT: replace, PATCH: update, DELETE: remove). Tested across 351 unit & integration tests. |
| **2** | Idempotency key on a POST | **IMPLEMENTED** | `AIGateway/src/services/idempotency.service.js` | SHA-256 payload fingerprinting and Redis-backed state machine. Repeated POST with same key returns cached response without duplicate provider calls. Tested in `AIGateway/tests/unit/idempotency.test.js` & `tests/e2e`. |
| **3** | JSON Schema validation using AJV | **IMPLEMENTED** | `*/src/middleware/validate.*`, schemas | AJV strictly validates request bodies, cursor/page query params, search parameters, and path IDs. Tested across unit and integration suites. |
| **4** | Versioning under `/v1` | **IMPLEMENTED** | All 6 services | All REST endpoints partitioned strictly under `/v1/...` with `/v1/health` and `/health` aliases. Tested in all service test suites. |
| **5** | At least eight distinct HTTP status codes | **IMPLEMENTED** | All 6 services | Verified status codes: `200 OK`, `201 Created`, `202 Accepted`, `204 No Content`, `304 Not Modified`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `406 Not Acceptable`, `409 Conflict`, `413 Payload Too Large`, `429 Too Many Requests`, `500 Internal Error`, `503 Service Unavailable`, `504 Gateway Timeout` (16 distinct codes). |
| **6** | ETag and a working 304 response | **IMPLEMENTED** | `*/src/middleware/etagCache.*` | Deterministic SHA-256 weak ETags computed on GET responses. Sending `If-None-Match` matching ETag returns `304 Not Modified` with empty body. Tested in `AIGateway/tests/integration/etagCache.test.js` and `Identity/tests/integration/legacyEmployee.test.ts`. |
| **7** | Content negotiation — JSON and XML | **IMPLEMENTED** | `*/src/middleware/contentNegotiation.*` | Dual representation support: `Accept: application/json` returns JSON, `Accept: application/xml` serializes to XML via `xmlbuilder2`, unsupported Accept header returns `406 Not Acceptable`. Tested in `AIGateway/tests/integration/contentNegotiation.test.js` and `Identity/tests/integration/legacyEmployee.test.ts`. |
| **8** | Cursor pagination with a next link | **IMPLEMENTED** | `AIGateway/src/repositories/aiRequest.repository.js`, `aiRequest.service.js` | Encoded opaque base64 cursors (`nextCursor`) and `next` URL link for non-overlapping pagination. Tested in `AIGateway/tests/integration/cursorPagination.test.js`. |
| **9** | One consistent error body, everywhere | **IMPLEMENTED** | `*/src/middleware/errorHandler.*` | Unified response structure across all services: `{ success: false, error: { code, message, details, correlationId, requestId } }`. Tested in all integration suites. |
| **10** | Deliberate `Cache-Control` on every GET | **IMPLEMENTED** | `*/src/middleware/cacheControl.*` | Configurable deliberate caching policy applied to all GET routes (`Cache-Control: private, no-cache, no-store, must-revalidate`). Verified in ETag and legacy employee integration tests. |
| **11** | Resource-shaped URLs, no verbs | **IMPLEMENTED** | All 6 services | Resource noun hierarchies (`/v1/ai-requests`, `/v1/policies`, `/v1/users`, `/v1/organizations`, `/v1/legacy-employees/:id`). Sub-resources used for actions. Verified in OpenAPI documentation and route tests. |
| **12** | Rate-limit headers and a 429 | **IMPLEMENTED** | `*/src/middleware/errorHandler.*`, `rateLimiter.service.js` | Returns `429 Too Many Requests` with `Retry-After`, `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, and `X-RateLimit-*` headers. Verified in `errorHandler.js` and test suites. |
| **13** | A hand-written OpenAPI document | **IMPLEMENTED** | `docs/openapi.yaml`, `*/openapi/*.yaml` | Hand-written unified OpenAPI 3.1.0 document in `docs/openapi.yaml` documenting all 6 microservice operations, schemas, security schemes, and status codes. |
| **14** | Swagger UI served from your own service | **IMPLEMENTED** | All 6 services (`/docs`, `/api-docs`) | Swagger UI mounted and served at `/docs` and `/api-docs` on every service, with raw schemas exposed at `/openapi.json` and `/docs.yaml`. Verified via HTTP integration tests. |
| **15** | A GraphQL endpoint alongside the REST one | **IMPLEMENTED** | `AIGateway/src/routes/graphql.routes.js`, `AIGateway/src/graphql/*` | Mounted at `POST /graphql` and `POST /v1/graphql` with JWT authentication, query depth limits (>10 rejected), and resolvers for `me`, `organization`, `models`, `aiRequests`, and `aiRequestTrace`. Tested in `AIGateway/tests/integration/graphql.test.js`. |
| **16** | A circuit breaker | **IMPLEMENTED** | `Identity/src/integrations/soap/legacyEmployeeClient.ts` | 3-state circuit breaker (`CLOSED`, `OPEN`, `HALF_OPEN`) with 5-failure threshold and 10s cooldown timer. Fails fast with 503 when open without network attempts. Tested in `Identity/tests/integration/legacyEmployee.test.ts`. |
| **17** | A SQL database, with parameterised queries | **IMPLEMENTED** | PostgreSQL (5 microservice databases) | Prisma ORM parameterizes all SQL queries; schema migrations and indexes verified. Tested in `persistentDatabase.e2e.test.js`. |
| **18** | CORS configured deliberately | **IMPLEMENTED** | All 6 services (`app.js` / `app.ts`) | Deliberate origins with explicit `allowedHeaders` (`Content-Type`, `Authorization`, `Idempotency-Key`, `Accept`, `If-None-Match`, `X-Correlation-Id`, etc.) and `exposedHeaders` (`ETag`, `RateLimit-*`, `Retry-After`). Verified across all services. |
| **19** | Deployed and reachable over the internet | **BLOCKED** | Localhost & Docker environment | Verified functional over local Docker network; public internet deployment requires external cloud provider credentials and domain configuration not available in local environment. |
| **20** | Timeout on every outbound call | **IMPLEMENTED** | All outbound HTTP clients & SOAP client | Outbound calls wrap `fetch()` with `AbortController` (e.g. 5000ms budget); SOAP client enforces 5000ms timeout with `GatewayTimeoutError`. Tested in unit & integration tests. |
| **21** | Express middleware and central error handling | **IMPLEMENTED** | All 6 services | Uniform pipeline: `helmet`, `cors`, `requestLogger`, `contentNegotiation`, `cacheControl`, `etagCache`, router, 404 handler, and central `errorHandler`. Tested across 351 backend tests. |
| **22** | A NoSQL document store | **IMPLEMENTED** | `SecurityAudit` / MongoDB | MongoDB `aegis_audit` database persists audit events with tamper-evident HMAC digests; verified across restarts in `persistentDatabase.e2e.test.js`. |
| **23** | Automated tests with Jest and supertest | **IMPLEMENTED** | All 6 services, e2e suite, and frontend | **351 backend tests** across 59 suites (Jest + Supertest) + **37 frontend unit tests** (Vitest) passing with 100% pass rate. |
| **24** | Reading a WSDL, and one SOAP call | **IMPLEMENTED** | `Identity/src/integrations/soap/legacyEmployeeClient.ts` | Consumes WSDL at `http://localhost:5005/legacy-employee?wsdl` (with bundled fallback), executes `CheckLegacyEmployee` operation, exposed at `GET /v1/legacy-employees/:id`. Tested in `Identity/tests/integration/legacyEmployee.test.ts`. |
| **25** | Retry with increasing backoff | **IMPLEMENTED** | `legacyEmployeeClient.ts`, `privacyScannerClient.js`, `policyClient.js` | Exponential backoff retry with full jitter ($delay = base \times 2^{attempt-1} \times jitter$) on transient downstream network/5xx failures. Tested in `legacyEmployee.test.ts`. |
| **26** | Structured logging with a correlation id | **IMPLEMENTED** | All 6 services (`utils/logger.*`, `requestLogger.*`) | Pino JSON structured logger formats correlation ID, service name, timestamp, path, method, and duration on every HTTP request. Tested in all service test runs. |
| **27** | JWT authentication and authorisation | **IMPLEMENTED** | `Identity` & downstream services | Access/refresh JWT token pair signing and verification (HMAC SHA-256), Argon2id password hashing, token expiration checks, and RBAC permission checks. Tested in `Identity/tests/unit/jwt.test.ts` & integration suites. |
| **28** | Docker, and twelve-factor configuration | **IMPLEMENTED** | `docker-compose.yml`, Docker mock | PostgreSQL, MongoDB, Redis, and SOAP Mock running in healthy Docker containers; environment configuration loaded via 12-factor principles. |

---

## Part F: Request Trace Explorer Verification

The Request Trace Explorer (`frontend/src/pages/TracesPage.tsx`) was upgraded with the following verified capabilities:

1. **AI Request Selector Drawer:**
   - Real-time list of existing AI requests retrieved via `gatewayApi.listRequests()`.
   - Filterable by status (`ALL`, `COMPLETED`, `BLOCKED`, `WAITING_FOR_APPROVAL`, `FAILED`) and search query.
   - Click any request to instantly inspect its complete distributed execution trace.

2. **Preserved Multi-identifier Search:**
   - Accepts both Request IDs (`req_...`) and Trace IDs (`trc_...` or UUIDs).
   - Updates URL query parameters (`?requestId=...` or `?traceId=...`) for bookmarkable and shareable trace views.

3. **6-Stage Microservice Visual Pipeline:**
   - Architecture flow visualizing all 6 microservices:
     1. Stage 1: AI Gateway (`:3001`) — Request Ingress & Idempotency
     2. Stage 2: Identity Service (`:3000`) — Principal Authentication & Authorization
     3. Stage 3: Privacy Scanner (`:3002`) — PII/Secrets Detection & Masking
     4. Stage 4: Policy Approval (`:3003`) — Governance Policy Evaluation
     5. Stage 5: Model Provider (`:3004`) — Inference & Token Telemetry
     6. Stage 6: Security Audit (`:3005`) — Tamper-Evident Event Ingestion
   - Color-coded boundary status (Green = Completed, Amber = Waiting for Approval, Red = Blocked/Denied, Gray = Skipped) and latency per hop.

4. **Granular Step-by-Step Execution Timeline:**
   - Sequenced numbered steps with timestamp, hop duration, HTTP status code badge (`200 OK`, `202 Accepted`, `403 Forbidden`), and expandable step metadata.

5. **Payload and Decision Inspection:**
   - Sanitized prompt summary display.
   - Final model response display.
   - Privacy detector findings and policy violation details.

6. **Cryptographic SHA-256 Digest Verification:**
   - Displays all correlated audit log events.
   - Interactive `Verify Digest` button computes and validates event HMAC against stored digest to guarantee tamper evidence.
   - `Inspect Payload` modal displays full raw JSON payload with one-click clipboard copy.


