-- CreateTable
CREATE TABLE "scanner_configurations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "enabled_categories" TEXT NOT NULL DEFAULT '["EMAIL","PHONE","PAN","AADHAAR","SECRET","CREDENTIAL_ASSIGNMENT","IP_ADDRESS"]',
    "masking_configuration" TEXT NOT NULL DEFAULT '{}',
    "ruleset_version" TEXT NOT NULL DEFAULT '1.0.0',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scanner_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_sensitive_patterns" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'CUSTOM',
    "pattern" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'HIGH',
    "action" TEXT NOT NULL DEFAULT 'BLOCK',
    "replacement" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_sensitive_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_metadata" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "request_id" TEXT,
    "ruleset_version" TEXT NOT NULL DEFAULT '1.0.0',
    "detected_categories" TEXT NOT NULL DEFAULT '[]',
    "findings_count" INTEGER NOT NULL DEFAULT 0,
    "decision" TEXT NOT NULL,
    "processing_duration_ms" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scan_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scanner_configurations_organization_id_key" ON "scanner_configurations"("organization_id");

-- CreateIndex
CREATE INDEX "scanner_configurations_organization_id_idx" ON "scanner_configurations"("organization_id");

-- CreateIndex
CREATE INDEX "custom_sensitive_patterns_organization_id_enabled_idx" ON "custom_sensitive_patterns"("organization_id", "enabled");

-- CreateIndex
CREATE INDEX "scan_metadata_organization_id_created_at_idx" ON "scan_metadata"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "scan_metadata_request_id_idx" ON "scan_metadata"("request_id");
