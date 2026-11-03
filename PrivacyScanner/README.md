# AegisAI Privacy Scanner Microservice (Service 3)

The **Privacy Scanner Microservice** is a core component of **AegisAI — Enterprise AI Security & Governance Gateway**. It is responsible for inspecting inbound chat prompts and text messages for Personally Identifiable Information (PII), secrets, cloud API keys, cryptographic materials, and custom organization-configured confidential keywords; producing deterministic sanitized content; and returning structured privacy findings and gate decisions for the AI Gateway.

---

## 1. Service Responsibilities & Boundaries

### What the Privacy Scanner Owns:
- **Modular PII & DLP Detection**: Deterministic regex and algorithmic detectors for Emails, Phone numbers, Indian PAN, Indian Aadhaar, Secrets/Tokens, Credential Assignments, IP Addresses, and Custom Patterns.
- **Deterministic Masking**: Transforming detected sensitive spans into consistent tokens (`[EMAIL_1]`, `[PHONE_1]`, `[SECRET_1]`, etc.) without index shifting or payload corruption.
- **Privacy Decision Precedence**: Calculating deterministic scanner actions (`BLOCK > REQUIRE_APPROVAL > MASK > ROUTE > ALLOW`).
- **Scanner Configuration & Versioning**: Organization-scoped rulesets and ReDoS-validated custom patterns.
- **Scan Telemetry**: Non-sensitive execution metadata persistence (category counts, duration, decisions).

### What the Privacy Scanner Does NOT Own:
- **User Authentication / Passwords**: Owned by Service 1 (Identity Service).
- **Enterprise Governance Policy Authoring**: Owned by Service 4 (Policy & Approval Service).
- **AI Model Selection & Invocation**: Owned by Service 5 (Model & Provider Service).
- **Raw Audit Log Storage**: Owned by Service 6 (Security & Audit Service in MongoDB).
- **Direct Model Provider Invocations**: The Privacy Scanner NEVER communicates with LLMs or external AI providers.

---

## 2. Technology Stack

- **Runtime**: Node.js `v24.15.0`
- **Language**: Pure JavaScript (CommonJS module system, strict mode, zero TypeScript)
- **HTTP Framework**: Express `^5.3.0`
- **Database ORM**: Prisma ORM `6.19.3` (`prisma-client-js`) with dedicated PostgreSQL database `aegis_privacy`
- **Schema Validation**: AJV `^8.20.0` with `ajv-formats` `^3.0.1`
- **Structured Logging**: Pino `^10.4.0` with sensitive field scrubbing
- **Testing**: Jest `^30.5.2` and Supertest `^7.3.1`
- **API Documentation**: OpenAPI 3.1 YAML with Swagger UI at `/docs`

---

## 3. Environment Variables

Create `.env` using `.env.example`:

| Variable | Description | Default / Example |
|---|---|---|
| `PORT` | HTTP port | `3002` |
| `NODE_ENV` | Environment | `development` / `production` / `test` |
| `LOG_LEVEL` | Pino logging level | `info` |
| `PRIVACY_DATABASE_URL` | Dedicated PostgreSQL URL | `postgresql://aegis_privacy_user:aegis_privacy_secure_password@localhost:5432/aegis_privacy?schema=public` |
| `PRIVACY_JWT_SECRET` | Signing key for local JWT verification | Secure secret placeholder |
| `PRIVACY_JWT_ISSUER` | Expected JWT issuer | `aegis-identity` |
| `PRIVACY_JWT_AUDIENCE` | Expected JWT audience | `aegis-privacy` |
| `INTERNAL_SERVICE_KEY` | Service-to-service preshared secret | Configured secret string |
| `IDENTITY_SERVICE_URL` | Identity Service URL | `http://localhost:3000` |
| `MAX_REQUEST_BODY_BYTES` | Maximum JSON body limit | `1048576` (1MB) |
| `MAX_CONTENT_LENGTH` | Max characters per message | `50000` |
| `MAX_SCAN_ITEMS` | Max messages per request | `100` |
| `SCAN_TIMEOUT_MS` | Scan processing timeout | `5000` |
| `PRIVACY_DEFAULT_MODE` | Default scan mode | `MASK` |
| `PRIVACY_RULESET_VERSION`| Default ruleset version | `1.0.0` |

---

## 4. Supported Detection Capabilities

| Category | Method | Severity | Default Action | Masking Format | Limitations |
|---|---|---|---|---|---|
| **EMAIL** | RFC-compatible bounded regex | MEDIUM | MASK | `[EMAIL_1]` | Simplified matching; does not perform MX DNS checks or capture obfuscated emails. |
| **PHONE** | International (+prefix), US/NANP, Indian mobile | MEDIUM | MASK | `[PHONE_1]` | Supported regions explicitly modeled; generic numbers without dialing structure are rejected. |
| **PAN** | Indian tax ID format `[A-Z]{5}[0-9]{4}[A-Z]` | HIGH | MASK | `[PAN_1]` | Format verification only; does not query Indian Income Tax Dept / NSDL. |
| **AADHAAR** | 12-digit Indian national UID with Verhoeff checksum | HIGH | MASK | `[AADHAAR_1]` | Format and mathematical checksum check only; does not query UIDAI. |
| **SECRET** | AWS Key, GitHub PAT, OpenAI, Anthropic, Slack, PEM Private Key, JWT | CRITICAL | BLOCK | `[SECRET_1]` | Signature-based; recognizes known cloud provider and crypto key formats. |
| **CREDENTIAL_ASSIGNMENT** | Contextual key assignment (`password=...`, `client_secret=...`) | HIGH | BLOCK | `[SECRET_1]` | Requires contextual parameter name; common dummy placeholders (e.g. `your_password`) ignored. |
| **IP_ADDRESS** | IPv4 4-octet bounded values (0-255) | LOW | MASK | `[IP_ADDRESS_1]` | IPv6 not currently covered; software versions (e.g. `v1.2.3.4`) excluded. |
| **CUSTOM** | Organization-configured patterns | HIGH / Configurable | Configurable | `[CUSTOM_1]` | ReDoS-validated regular expressions and keywords; execution time-boxed. |

---

## 5. Decision Precedence & Masking Strategy

### Decision Hierarchy:
$$\text{BLOCK} > \text{REQUIRE\_APPROVAL} > \text{MASK} > \text{ROUTE} > \text{ALLOW}$$

1. **`BLOCK`**: Triggered by high-risk credentials (`SECRET`), passwords (`CREDENTIAL_ASSIGNMENT`), or when masking cannot be verified safely (fail-closed security).
2. **`REQUIRE_APPROVAL`**: Triggered by confidential business keywords requiring human approval.
3. **`MASK`**: Sensitive PII detected and successfully sanitized.
4. **`ROUTE`**: Routing constraints or model restrictions recommended.
5. **`ALLOW`**: Zero sensitive findings detected.

### Deterministic Masking Rules:
- **No Index Shifting**: Matches are sorted in reverse position order (end to beginning) so earlier character indices are strictly preserved.
- **Referential Integrity**: Repeated occurrences of the exact same sensitive string receive identical tokens (e.g., `alice@example.com` is consistently `[EMAIL_1]` throughout the conversation).
- **No Input Mutation**: The caller's input payload is never modified.
- **Overlapping Resolution**: Prioritizes higher severity matches over lower severity matches (`CRITICAL > HIGH > MEDIUM > LOW`), followed by longer spans.

---

## 6. REST API Endpoints

### Core Scanning:
- `POST /v1/scan`: Primary privacy scan endpoint. Accepts both AI Gateway format (`{ messages, organizationId }`) and extended format (`{ requestId, content: { messages }, mode, organizationId }`).
- `GET /v1/scan/:scanId`: Retrieves non-sensitive execution telemetry (scanId, organizationId, detected categories, decision, duration).

### Configuration & Capabilities:
- `GET /v1/config`: Retrieves tenant scanner preferences and custom patterns.
- `PUT /v1/config`: Updates organization enabled categories and ruleset version.
- `POST /v1/config/patterns`: Registers a ReDoS-validated custom pattern rule.
- `GET /v1/config/limitations`: Transparency endpoint detailing engine capabilities.

### Health Probes:
- `GET /health/live`: Process liveness probe.
- `GET /health/ready`: PostgreSQL dependency readiness probe.

---

## 7. Local Development & Testing

### Running Tests:
```bash
# Run all unit and integration tests
npm test

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration
```

### Database Migrations:
```bash
# Generate Prisma Client
npm run db:generate

# Deploy migrations to live PostgreSQL
npm run db:deploy
```

### Docker Compose:
```bash
# Start dedicated aegis_privacy database and Privacy Scanner
docker compose up -d
```

---

## 8. AI Gateway Integration

The AI Gateway (`AgeisAi/AIGateway`) integrates with Privacy Scanner via `privacyScannerClient.js`:
- Client targets: `POST /v1/scan`
- Expected payload: `{ messages: Array<{role, content}>, organizationId: string }`
- Expected response: `{ action: 'ALLOW' | 'BLOCK' | 'MASK' | 'ROUTE' | 'REQUIRE_APPROVAL', sanitizedMessages: Array<{role, content}>, findings: Array<object> }`
- The Privacy Scanner natively supports this contract while concurrently returning standard extended metadata (`scanId`, `requestId`, `status`, `decision`, `sanitizedContent`, `durationMs`).
