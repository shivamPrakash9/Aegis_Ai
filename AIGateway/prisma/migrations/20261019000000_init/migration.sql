-- CreateTable
CREATE TABLE "ai_requests" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "caller_id" TEXT NOT NULL,
    "caller_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACCEPTED',
    "model_selected" TEXT,
    "sanitized_prompt_summary" TEXT,
    "sanitized_result" TEXT,
    "trace_id" TEXT NOT NULL,
    "idempotency_key" TEXT,
    "payload_fingerprint" TEXT,
    "privacy_action" TEXT,
    "policy_decision" TEXT,
    "error_code" TEXT,
    "error_message" TEXT,
    "metadata" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "ai_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE INDEX "ai_requests_organization_id_status_idx" ON "ai_requests"("organization_id", "status");
CREATE INDEX "ai_requests_organization_id_created_at_idx" ON "ai_requests"("organization_id", "created_at");
CREATE INDEX "ai_requests_organization_id_idempotency_key_idx" ON "ai_requests"("organization_id", "idempotency_key");
CREATE INDEX "ai_requests_trace_id_idx" ON "ai_requests"("trace_id");
