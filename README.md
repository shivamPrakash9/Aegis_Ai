# AegisAI — Enterprise AI Security & Governance Gateway

AegisAI is an enterprise-grade AI security, governance, and compliance gateway that intercepts, sanitizes, evaluates, controls, and audits AI inference requests across distributed multi-tenant environments.

---

## Architecture Overview

AegisAI is structured into **six backend microservices** and a modern **React/Vite frontend**:

| Service | Port | Database | Primary Responsibility |
| :--- | :--- | :--- | :--- |
| **Identity Service** | `3000` | PostgreSQL (`aegis_identity`) | Tenant isolation, Argon2id auth, JWT verification, RBAC, organization & developer onboarding. |
| **AI Gateway** | `3001` | PostgreSQL (`aegis_gateway`), Redis | Inbound request orchestration, idempotency locking, rate-limiting, pipeline lifecycle, and normalized response delivery. |
| **Privacy Scanner** | `3002` | PostgreSQL (`aegis_privacy`) | Pre-flight PII/PHI/secret detection, tokenized masking, synthetic sanitization, and output privacy validation. |
| **Policy Approval** | `3003` | PostgreSQL (`aegis_policy`) | Real-time policy evaluation (`ALLOW`, `DENY`, `REQUIRE_APPROVAL`), human oversight escalation, and budget governance. |
| **Model Provider** | `3004` | PostgreSQL (`aegis_model`) | Upstream provider adapters (OpenAI, Anthropic, Ollama, deterministic mock), credential encryption, and telemetry. |
| **Security Audit** | `3005` | MongoDB (`aegis_audit`) | Distributed trace collection, tamper-evident HMAC signing, and cryptographic audit log verification. |
| **Frontend Web App** | `5173` | Browser / React Router / TanStack Query | Public landing page, onboarding portal, interactive architecture explorer, dashboard, and management tools. |

---

## Key Features & Completed Objectives

### 1. Normalized AI Gateway Response Contract
- AI Gateway cleanly separates sanitized prompts from actual model completions.
- Canonical contract field `assistantAnswer` delivers the extracted assistant text from upstream LLM providers (e.g. `choices[0].message.content`) or deterministic mock providers.
- Sanitized input prompt summary is preserved in `sanitizedPromptSummary`.
- Backward-compatible aliases (`sanitizedResult`, `result`, `response`) remain synchronized.
- UI explicitly distinguishes deterministic mock completions from live upstream provider inferences.

### 2. Multi-Tenant Organization Creation & Management
- Self-service organization registration (`POST /api/identity/v1/organizations`) atomically bootstraps tenant records and initial administrators with `ORGANIZATION_ADMIN` permissions.
- Authorized administrators can view tenant metadata, monitor member headcounts, and update organization details (`PATCH /api/identity/v1/organizations/:id`).
- Strict tenant isolation guarantees that callers cannot access or modify resources belonging to another organization.

### 3. Developer Onboarding & Role-Based Access Control (RBAC)
- Organization Administrators can provision developers directly (`POST /api/identity/v1/users`) with role scoping (`DEVELOPER`, `SECURITY_AUDITOR`, `ORGANIZATION_ADMIN`).
- Developers receive immediate credentials and are strictly restricted:
  - Can submit inference requests and view their own traces.
  - Forbidden from managing organization metadata (returns `403 Forbidden`).
  - Forbidden from inviting or removing team members (returns `403 Forbidden`).
  - Forbidden from viewing requests belonging to other users or tenants.
- Member removal and account deactivation supported via `DELETE /api/identity/v1/users/:id`.

### 4. Public Landing Page & Technical Documentation
- Public routes mounted before authentication:
  - `/` — Interactive home page featuring 6-microservice architecture inspector, interactive request lifecycle simulation (PII masking demo), zero-trust security breakdown, and feature cards.
  - `/get-started` — Onboarding hub supporting new organization creation and instructions for joining existing tenants.
  - `/docs` — Comprehensive technical architecture guide, service port registry, and copyable cURL integration snippets.
  - `/login` — Secure authentication portal with pre-configured development role quick-fills.
- Protected routes remain guarded under `DashboardLayout` (`/overview`, `/playground`, `/requests`, `/policies`, `/approvals`, `/models`, `/audit`, `/organization`, `/developers`, `/settings`).

---

## Quickstart

### Prerequisites
- Node.js >= 20.x
- PostgreSQL 16+ running on `localhost:5432`
- MongoDB running on `localhost:27017`
- Redis running on `localhost:6379`

### Environment Configuration
Copy `.env.example` to `.env` or set environment variables:
```bash
cp .env.example .env
```

### Starting All Services & Frontend
Run the complete platform concurrently:
```bash
npm run start
```
Or start only backend microservices:
```bash
npm run start:services
```

The web application will be accessible at `http://localhost:5173`.

---

## Verification & Automated Test Suites

### Unit & Integration Suites
```bash
# Frontend typecheck & Vitest suite (37 tests)
npm --prefix frontend test -- --run

# Identity Service Jest suite (70 tests)
npm run test:identity

# AI Gateway Jest suite (45 tests)
npm run test:gateway

# Privacy Scanner Jest suite
npm run test:privacy

# Policy Approval Jest suite
npm run test:policy

# Model Provider Jest suite
npm run test:model

# Security Audit Jest suite
npm run test:audit
```

### Full-System End-to-End Suites
```bash
# Full request lifecycle (Identity -> Gateway -> Privacy -> Policy -> Model -> Audit)
npm run test:e2e

# Multi-database persistence & restart survival
npm run test:persistence
```

### Production Build
```bash
npm --prefix frontend run build
```
Builds production assets using Vite and validates TypeScript with zero errors.
