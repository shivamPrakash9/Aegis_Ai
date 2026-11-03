# AegisAI Enterprise AI Security & Governance Gateway — Frontend

The web dashboard and administrative console for **AegisAI Enterprise AI Security & Governance Gateway**, built with **React**, **Vite**, **TypeScript (Strict Mode)**, **Tailwind CSS v4**, **shadcn/ui design tokens**, and **Lucide Icons**.

---

## 1. System Architecture & Integrated Microservices

The frontend natively interfaces with all 6 AegisAI microservices:

| Service | Port | Description | Integrated Endpoints |
|---|---|---|---|
| **Identity Service** | `:3000` | Authentication, RBAC, Organizations | `POST /v1/auth/login`, `POST /v1/auth/refresh`, `GET /v1/auth/me`, `GET /v1/users`, `POST /v1/users`, `GET /v1/organizations/:id` |
| **AI Gateway** | `:3001` | Core request orchestration & pipeline | `POST /v1/ai-requests` (with `Idempotency-Key`), `GET /v1/ai-requests/:id`, `GET /v1/ai-requests`, `POST /v1/ai-requests/:id/resume` |
| **Privacy Scanner** | `:3002` | PII & Secret Redaction | `POST /v1/scan`, `GET /v1/config/limitations`, `GET /v1/config`, `POST /v1/config/patterns` |
| **Policy Approval** | `:3003` | Rules evaluation & human approval gates | `GET /v1/policies`, `POST /v1/policies`, `GET /v1/approvals`, `POST /v1/approvals/:id/decision` |
| **Model Provider** | `:3004` | Upstream LLM catalog & dispatch telemetry | `GET /v1/models`, `POST /v1/models/:id/enable`, `POST /v1/models/:id/disable`, `GET /v1/usage` |
| **Security Audit** | `:3005` | Cryptographic audit ledger & traces | `GET /v1/events`, `GET /v1/events/:id/verify`, `GET /v1/traces/:traceId`, `GET /v1/requests/:id/events` |

---

## 2. Key Capabilities & Implemented Pages

1. **Overview Dashboard (`/overview`)**: Real-time request metrics, status distribution charts (Recharts), live cluster microservice health grid, and recent audit activity.
2. **AI Playground (`/playground`)**: Interactive prompt composer with model selection, capability routing, client-side bounded status polling (`HTTP 202 Accepted`), automated detection banners for `WAITING_FOR_APPROVAL` or `BLOCKED`, and sanitized response viewing.
3. **AI Request Explorer (`/requests` & `/requests/:id`)**: Searchable, filterable request table with detailed inspection, sanitized results, timing metrics, and direct Gateway resume capability for unblocking approved requests.
4. **Request Traces (`/traces`)**: End-to-end distributed execution trace timeline with per-event cryptographic verification of HMAC/SHA-256 audit digests.
5. **Privacy Scanner (`/privacy`)**: Interactive testing interface with sample presets (PII, AWS secrets, IP address), rule-set limitations viewer, and custom regex pattern management.
6. **Policy Management (`/policies`)**: Policy rules catalog, condition inspectors, priority settings, activation toggles, and creation modal with validation.
7. **Human Approval Center (`/approvals`)**: Dedicated reviewer queue for pending flagged requests, audit reason justification input, and automated AI Gateway pipeline resumption.
8. **Model & Provider Admin (`/models`)**: Active model catalog, capability flags, enable/disable toggles for administrators, and upstream token usage telemetry.
9. **Security Audit Explorer (`/audit`)**: Audit event ledger with severity filtering, source service filters, cryptographic integrity verification, and full JSON payload modal.
10. **Users & Organizations (`/users`)**: Member listing with RBAC role badges, organization metadata card, and secure user provisioning.
11. **Settings & Diagnostics (`/settings`)**: Live HTTP ping probes for all 6 microservice health endpoints, authenticated principal JWT claim inspection, and persistent theme controls.

---

## 3. Security Design Guarantees

- **Token Isolation**: Session access and refresh tokens are stored in secure browser memory and `sessionStorage`, completely isolated from persistent `localStorage`.
- **Automatic Token Rotation**: Centralized API client automatically handles HTTP 401 responses with a mutex-locked token refresh workflow against `POST /v1/auth/refresh`.
- **Zero Raw Secret Storage**: No provider API keys, database credentials, or signing keys are embedded in frontend source code or environment variables.
- **Auditable Cryptographic Digests**: Events in the audit ledger can be verified on-demand against backend HMAC/SHA-256 signatures.

---

## 4. Getting Started Locally

### Prerequisites
- Node.js >= 20.0.0
- npm >= 10.0.0

### Installation
```bash
cd frontend
npm install --legacy-peer-deps
```

### Running Local Development Server
```bash
npm run dev
```
The application will start at `http://localhost:5173`.
Vite will automatically proxy requests matching `/api/{identity,gateway,privacy,policy,model,audit}` to the respective backend microservices running on ports `:3000` through `:3005`.

---

## 5. Verification & Testing

### TypeScript Strict Mode Check
```bash
npx tsc -b
```

### Vitest Unit & Component Test Suite
```bash
npx vitest run
```

### Production Build
```bash
npm run build
```
Compiled static assets will be output to `frontend/dist/`.

---

## 6. Docker Container Deployment

To build and run the production-optimized multi-stage Docker image:

```bash
docker build -t aegisai-frontend:latest -f Dockerfile .
docker run -p 80:80 aegisai-frontend:latest
```
A lightweight Alpine Nginx server serves the compiled Single Page Application with embedded security headers (CSP, HSTS, X-Frame-Options) and Gzip compression.
