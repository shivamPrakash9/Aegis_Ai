# AegisAI Model & Provider Microservice (Service 5)

The **Model & Provider Microservice** is a core component of **AegisAI — Enterprise AI Security & Governance Gateway**. It provides a unified, secure, provider-independent model execution interface for AI requests passing through the AI Gateway.

---

## 1. Service Responsibilities & Boundaries

### What the Model & Provider Service Owns:
- **Unified Completion Execution**: Exposing `POST /v1/chat/completions` conforming directly to the contract expected by AI Gateway's [`modelProviderClient.js`](file:///c:/Users/shiva/OneDrive/Documents/WebServicesProject/AgeisAi/AIGateway/src/clients/modelProviderClient.js).
- **Multi-Provider Abstraction**: Normalizing request and response payloads across OpenAI-compatible providers, Anthropic Claude, and deterministic mock adapters.
- **Model Allowlisting & Registry**: Enforcing explicit model verification. Unknown, unregistered, or disabled models are rejected with 404 or 403.
- **Outbound HTTP Security & SSRF Prevention**: Enforcing strict host allowlisting, rejecting cloud metadata services (`169.254.169.254`), non-HTTP/HTTPS protocols, and injecting credentials server-side.
- **Usage & Operational Telemetry**: Recording prompt tokens, completion tokens, total tokens, and execution latency per request in dedicated database `aegis_model`.
- **Zero Raw Prompt / Completion Persistence**: Prompts and generated text are never stored in the database or logged in application traces.

### What the Model & Provider Service Does NOT Own:
- **Identity & Session Verification**: Owned by Service 1 (Identity Service).
- **Inbound AI Request Routing & Orchestration**: Owned by Service 2 (AI Gateway).
- **PII & DLP Secret Detection**: Owned by Service 3 (Privacy Scanner).
- **Enterprise Policy & Governance Gates**: Owned by Service 4 (Policy & Approval Service).
- **Persistent Event Stream & Audit Log Lake**: Owned by Service 6 (Security & Audit Service in MongoDB).

---

## 2. Technology Stack

- **Runtime**: Node.js `v24.15.0`
- **Language**: Pure JavaScript (CommonJS module system, strict mode, zero TypeScript)
- **HTTP Framework**: Express `^5.3.0`
- **Database ORM**: Prisma ORM `6.19.3` (`prisma-client-js`) with dedicated PostgreSQL database `aegis_model`
- **Schema Validation**: AJV `^8.20.0` with `ajv-formats` `^3.0.1`
- **Structured Logging**: Pino `^10.4.0` with sensitive field scrubbing
- **Testing**: Jest `^30.5.2` and Supertest `^7.3.1`
- **API Documentation**: OpenAPI 3.1 YAML with Swagger UI at `/docs`

---

## 3. Environment Variables

Create `.env` using `.env.example`:

| Variable | Description | Default / Example |
|---|---|---|
| `PORT` | HTTP port | `3004` |
| `NODE_ENV` | Environment | `development` / `production` / `test` |
| `LOG_LEVEL` | Pino logging level | `info` |
| `MODEL_DATABASE_URL` | Dedicated PostgreSQL URL | `postgresql://aegis_model_user:aegis_model_secure_password@localhost:5432/aegis_model?schema=public` |
| `MODEL_JWT_SECRET` | Signing key for local JWT verification | Secure secret placeholder |
| `MODEL_JWT_ISSUER` | Expected JWT issuer | `aegis-identity` |
| `MODEL_JWT_AUDIENCE` | Expected JWT audience | `aegis-model` |
| `INTERNAL_SERVICE_KEY` | Service-to-service preshared secret | Configured secret string |
| `IDENTITY_SERVICE_URL` | Identity Service URL | `http://localhost:3000` |
| `AI_GATEWAY_URL` | AI Gateway Service URL | `http://localhost:3001` |
| `OPENAI_API_KEY` | OpenAI API key (optional for dev/test) | `sk-...` |
| `OPENAI_BASE_URL` | OpenAI API endpoint | `https://api.openai.com/v1` |
| `ANTHROPIC_API_KEY` | Anthropic API key (optional for dev/test) | `sk-ant-...` |
| `ANTHROPIC_BASE_URL` | Anthropic API endpoint | `https://api.anthropic.com` |
| `DEFAULT_MODEL` | Default model identifier | `gpt-4o-mini` |
| `DEFAULT_PROVIDER` | Default provider identifier | `openai` |
| `ALLOWED_PROVIDER_HOSTS`| Host allowlist for SSRF prevention | `api.openai.com,api.anthropic.com,127.0.0.1,localhost` |
| `PROVIDER_TIMEOUT_MS` | Outbound request timeout | `30000` |
| `MAX_REQUEST_BODY_BYTES`| Maximum JSON body limit | `1048576` (1MB) |

---

## 4. Database Architecture & Schema (`aegis_model`)

The service connects exclusively to its isolated PostgreSQL database `aegis_model`.

```prisma
model ModelConfig {
  id                 String   @id
  modelId            String   @unique
  provider           String
  providerModelName  String
  enabled            Boolean  @default(true)
  isDefault          Boolean  @default(false)
  maxTokens          Int      @default(4096)
  contextWindow      Int      @default(128000)
  defaultTemperature Float    @default(0.7)
  capabilities       String   @default("[\"chat\"]")
  description        String?
  version            Int      @default(1)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@index([provider, enabled])
  @@index([enabled])
}

model CompletionUsage {
  id               String   @id
  requestId        String?
  traceId          String?
  organizationId   String
  callerId         String?
  provider         String
  model            String
  promptTokens     Int      @default(0)
  completionTokens Int      @default(0)
  totalTokens      Int      @default(0)
  latencyMs        Int      @default(0)
  status           String   @default("COMPLETED")
  errorCode        String?
  createdAt        DateTime @default(now())

  @@index([organizationId, createdAt])
  @@index([requestId])
  @@index([traceId])
  @@index([provider, model])
}
```

---

## 5. Supported Provider Adapters

1. **OpenAI-Compatible (`OpenAiCompatibleProvider`)**:
   - Supports `gpt-4o`, `gpt-4o-mini`, and OpenAI-compatible gateways/self-hosted vLLM.
   - Dual-token normalization (`promptTokens` / `prompt_tokens`).
2. **Anthropic Claude (`AnthropicProvider`)**:
   - Supports `claude-3-5-sonnet`, `claude-3-haiku` via Messages API.
   - Extracts top-level system prompts and converts content blocks to standard choice messages.
3. **Deterministic Mock (`MockProvider`)**:
   - Enables offline testing with zero live credentials or API costs.
   - Configurable mock responses, simulated errors (rate limits, timeouts), and realistic token counts.

---

## 6. Outbound Security & SSRF Protection

All outbound requests pass through [`safeFetch`](file:///c:/Users/shiva/OneDrive/Documents/WebServicesProject/AgeisAi/ModelProvider/src/utils/httpSecurity.js):
- **Host Allowlisting**: Only hosts explicitly listed in `ALLOWED_PROVIDER_HOSTS` are permitted.
- **SSRF Immunity**: Prohibits cloud metadata IP (`169.254.169.254`, `metadata.google.internal`) and unapproved private networks in production.
- **Header Isolation**: Gateway authorization and internal service keys are stripped and never sent to external providers.
- **Bounded Timeouts**: Hard timeout enforcement with `AbortController` mapping to HTTP 504 Gateway Timeout.

---

## 7. API Endpoints

### Health Probes
- `GET /health/live`: Liveness probe.
- `GET /health/ready`: Readiness probe verifying PostgreSQL connectivity.

### Chat Completions
- `POST /v1/chat/completions`: Main model completion endpoint. Invoked by AI Gateway [`modelProviderClient.js`](file:///c:/Users/shiva/OneDrive/Documents/WebServicesProject/AgeisAi/AIGateway/src/clients/modelProviderClient.js).

### Model Catalog Administration
- `GET /v1/models`: List available models.
- `GET /v1/models/:id`: Retrieve specific model configuration.
- `POST /v1/models`: Register or update model configuration (Requires Admin).
- `POST /v1/models/:id/enable`: Enable a model (Requires Admin).
- `POST /v1/models/:id/disable`: Disable a model (Requires Admin).

### Operational Telemetry
- `GET /v1/usage`: Query organization token usage history.

### Interactive Documentation
- `GET /docs`: Swagger UI OpenAPI 3.1 documentation.
- `GET /docs.yaml`: Raw OpenAPI YAML specification.

---

## 8. Verification & Testing

Run all unit, integration, and security tests:
```bash
npm test
```

Test Suites:
1. `tests/unit/providerRegistry.test.js`: Model catalog resolution, case insensitivity, unknown and disabled model rejection.
2. `tests/unit/openaiProvider.test.js`: OpenAI request/response normalization, token calculation, error handling.
3. `tests/unit/anthropicProvider.test.js`: Anthropic system prompt extraction, block translation, token calculation.
4. `tests/security/httpSecurity.test.js`: SSRF prevention against cloud metadata and unauthorized hosts.
5. `tests/integration/health.test.js`: `/health/live` and `/health/ready` endpoints.
6. `tests/integration/completions.test.js`: End-to-end `POST /v1/chat/completions` with Gateway and OpenAI formats.
7. `tests/integration/models.test.js`: Model catalog CRUD and token usage queries.
8. `tests/integration/gatewayCompatibility.test.js`: Direct invocation with AI Gateway's real `ModelProviderClient`.
