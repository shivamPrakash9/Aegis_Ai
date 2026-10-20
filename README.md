# AegisAI Policy & Approval Microservice (Service 4)

The **Policy & Approval Microservice** is a core component of **AegisAI — Enterprise AI Security & Governance Gateway**. It is responsible for deterministic governance policy evaluation, rule matching, risk mitigation, and human approval workflow management for AI requests passing through the AI Gateway.

---

## 1. Service Responsibilities & Boundaries

### What the Policy & Approval Service Owns:
- **Deterministic Policy Evaluation**: Evaluating incoming AI requests against active enterprise policies using an AST-based declarative condition evaluator (`conditionEvaluator.js`). Zero dynamic code execution (`eval()`, `new Function()`).
- **Strict Decision Precedence**: Enforcing fail-closed precedence: `DENY > REQUIRE_APPROVAL > ALLOW`.
- **Policy Lifecycle & Versioning**: Multi-tenant CRUD operations, semantic policy versioning (`PolicyVersion`), and immediate activation/deactivation.
- **Human Approval Workflow**: State machine (`PENDING` -> `APPROVED` / `REJECTED`), atomic decision recording, self-approval prevention, role authorization, and TTL expiration tracking.
- **AI Gateway Integration**: Serving `POST /v1/evaluate` conforming directly to the contract expected by AI Gateway's [`policyClient.js`](file:///c:/Users/shiva/OneDrive/Documents/WebServicesProject/AgeisAi/AIGateway/src/clients/policyClient.js).

### What the Policy & Approval Service Does NOT Own:
- **Identity & Session Verification**: Owned by Service 1 (Identity Service).
- **Inbound AI Request Routing & Orchestration**: Owned by Service 2 (AI Gateway).
- **PII & DLP Secret Detection**: Owned by Service 3 (Privacy Scanner).
- **Model Invocations & LLM Credentials**: Owned by Service 5 (Model & Provider Service).
- **Raw Audit Logs & Event Lake**: Owned by Service 6 (Security & Audit Service in MongoDB).

---

## 2. Technology Stack

- **Runtime**: Node.js `v24.15.0`
- **Language**: Pure JavaScript (CommonJS module system, strict mode, zero TypeScript)
- **HTTP Framework**: Express `^5.3.0`
- **Database ORM**: Prisma ORM `6.19.3` (`prisma-client-js`) with dedicated PostgreSQL database `aegis_policy`
- **Schema Validation**: AJV `^8.20.0` with `ajv-formats` `^3.0.1`
- **Structured Logging**: Pino `^10.4.0` with sensitive field scrubbing
- **Testing**: Jest `^30.5.2` and Supertest `^7.3.1`
- **API Documentation**: OpenAPI 3.1 YAML with Swagger UI at `/docs`

---

## 3. Environment Variables

Create `.env` using `.env.example`:

| Variable | Description | Default / Example |
|---|---|---|
| `PORT` | HTTP port | `3003` |
| `NODE_ENV` | Environment | `development` / `production` / `test` |
| `LOG_LEVEL` | Pino logging level | `info` |
| `POLICY_DATABASE_URL` | Dedicated PostgreSQL URL | `postgresql://aegis_policy_user:aegis_policy_secure_password@localhost:5432/aegis_policy?schema=public` |
| `POLICY_JWT_SECRET` | Signing key for local JWT verification | Secure secret placeholder |
| `POLICY_JWT_ISSUER` | Expected JWT issuer | `aegis-identity` |
| `POLICY_JWT_AUDIENCE` | Expected JWT audience | `aegis-policy` |
| `INTERNAL_SERVICE_KEY` | Service-to-service preshared secret | Configured secret string |
| `IDENTITY_SERVICE_URL` | Identity Service URL | `http://localhost:3000` |
| `AI_GATEWAY_URL` | AI Gateway Service URL | `http://localhost:3001` |
| `PRIVACY_SCANNER_URL` | Privacy Scanner URL | `http://localhost:3002` |
| `MAX_REQUEST_BODY_BYTES` | Maximum JSON body limit | `1048576` (1MB) |
| `MAX_RULES_PER_POLICY` | Max rules per policy | `50` |
| `MAX_CONDITION_DEPTH` | Maximum AST recursion depth | `5` |
| `REQUEST_TIMEOUT_MS` | Processing timeout | `15000` |

---

## 4. Database Architecture & Schema (`aegis_policy`)

The service connects exclusively to its isolated PostgreSQL database `aegis_policy`.

```prisma
model Policy {
  id             String          @id
  organizationId String
  name           String
  description    String?
  category       String          @default("GENERAL")
  priority       Int             @default(100)
  status         PolicyStatus    @default(ACTIVE)
  activeVersion  Int             @default(1)
  createdBy      String?
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
  versions       PolicyVersion[]

  @@index([organizationId, status])
}

model PolicyVersion {
  id          String   @id @default(uuid())
  policyId    String
  version     Int
  rules       String   @db.Text // Validated JSON array of rules
  description String?
  createdBy   String?
  createdAt   DateTime @default(now())
  policy      Policy   @relation(fields: [policyId], references: [id], onDelete: Cascade)

  @@unique([policyId, version])
}

model ApprovalRequest {
  id             String         @id
  organizationId String
  requestId      String?
  policyId       String?
  policyVersion  Int?
  ruleId         String?
  reason         String
  modelRequested String?
  status         ApprovalStatus @default(PENDING)
  requesterId    String
  requesterRole  String?
  requesterType  String         @default("USER")
  approverId     String?
  approverRole   String?
  decisionReason String?
  decisionAt     DateTime?
  expiresAt      DateTime?
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt

  @@index([organizationId, status])
  @@index([requestId])
}
```

---

## 5. Policy Engine & Rule Conditions

### Supported AST Operators
- **Equality**: `eq`, `neq`
- **Membership**: `in`, `notIn`
- **String Inspection**: `contains`, `startsWith`, `endsWith`
- **Numeric Comparison**: `gt`, `gte`, `lt`, `lte`
- **Existence**: `exists`
- **Role & Capabilities**: `has_role`, `has_permission`
- **Composite Logic**: `all` (AND), `any` (OR), `not` (NOT)

### Security Bounds:
- Maximum recursion depth strictly capped at 5 levels (`MAX_DEPTH`).
- Prototype pollution vectors (`__proto__`, `constructor`, `prototype`) are ignored.
- Zero string evaluation or dynamic execution.

---

## 6. API Endpoints

### Health Probes
- `GET /health/live`: Liveness probe.
- `GET /health/ready`: Readiness probe verifying PostgreSQL connectivity.

### Governance Evaluation
- `POST /v1/evaluate`: Evaluates AI request against active organization policies. Called by AI Gateway [`policyClient.js`](file:///c:/Users/shiva/OneDrive/Documents/WebServicesProject/AgeisAi/AIGateway/src/clients/policyClient.js).

### Policy Administration
- `POST /v1/policies`: Create new policy with initial version 1 (Requires `POLICY_ADMIN` or `ADMIN`).
- `GET /v1/policies`: List policies for the authenticated organization.
- `GET /v1/policies/:id`: Get policy details by ID.
- `POST /v1/policies/:id/versions`: Publish a new version.
- `POST /v1/policies/:id/activate`: Activate policy.
- `POST /v1/policies/:id/deactivate`: Deactivate policy.
- `POST /v1/policies/:id/versions/:versionNumber/activate`: Set active version.

### Human Approval Workflow
- `GET /v1/approvals`: List approval requests with pagination and status filter.
- `GET /v1/approvals/:id`: Get details of an approval request.
- `POST /v1/approvals/:id/decision`: Submit `APPROVED` or `REJECTED` decision (Enforces self-approval check and approver roles).

### Interactive Documentation
- `GET /docs`: Swagger UI OpenAPI 3.1 documentation.
- `GET /docs.yaml`: Raw OpenAPI YAML specification.

---

## 7. AI Gateway Contract Compatibility

When AI Gateway invokes `POST /v1/evaluate`:
```json
{
  "organizationId": "org_enterprise_alpha",
  "principal": { "id": "usr_123", "role": "MEMBER" },
  "messages": [{ "role": "user", "content": "Explain quantum entanglement" }],
  "modelPreference": { "model": "gpt-4o", "provider": "openai" }
}
```

The service responds with:
```json
{
  "decision": "REQUIRE_APPROVAL",
  "policyVersion": 1,
  "reasonCode": "APPROVAL_REQUIRED_FRONTIER_MODEL",
  "reason": "Usage of GPT-4o requires manager approval.",
  "violations": [],
  "requiredApprovers": ["SECURITY_ADMIN", "MANAGER"],
  "approvalId": "appr_789123456",
  "evaluationId": "eval_456789123"
}
```

---

## 8. Verification & Testing

Run all unit and integration tests:
```bash
npm test
```

Test Suites:
1. `tests/unit/conditionEvaluator.test.js`: Leaf and composite condition evaluations, security limits, prototype safety.
2. `tests/unit/ruleMatcher.test.js`: Rule schema validation, priority ordering.
3. `tests/unit/decisionResolver.test.js`: Deterministic precedence (`DENY > REQUIRE_APPROVAL > ALLOW`), violation accumulation.
4. `tests/integration/health.test.js`: `/health/live` and `/health/ready` endpoints.
5. `tests/integration/evaluation.test.js`: End-to-end `POST /v1/evaluate` testing.
6. `tests/integration/policyCrud.test.js`: Multi-tenant policy administration and versioning.
7. `tests/integration/approvalWorkflow.test.js`: Complete human approval lifecycle, self-approval prevention, atomic resolution.
8. `tests/integration/gatewayCompatibility.test.js`: Direct invocation using AI Gateway's `PolicyClient`.
