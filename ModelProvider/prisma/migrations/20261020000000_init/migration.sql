-- CreateTable ModelConfig
CREATE TABLE "ModelConfig" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerModelName" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "maxTokens" INTEGER NOT NULL DEFAULT 4096,
    "contextWindow" INTEGER NOT NULL DEFAULT 128000,
    "defaultTemperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "capabilities" TEXT NOT NULL DEFAULT '["chat"]',
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable CompletionUsage
CREATE TABLE "CompletionUsage" (
    "id" TEXT NOT NULL,
    "requestId" TEXT,
    "traceId" TEXT,
    "organizationId" TEXT NOT NULL,
    "callerId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompletionUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ModelConfig_modelId_key" ON "ModelConfig"("modelId");
CREATE INDEX "ModelConfig_provider_enabled_idx" ON "ModelConfig"("provider", "enabled");
CREATE INDEX "ModelConfig_enabled_idx" ON "ModelConfig"("enabled");

-- CreateIndex
CREATE INDEX "CompletionUsage_organizationId_createdAt_idx" ON "CompletionUsage"("organizationId", "createdAt");
CREATE INDEX "CompletionUsage_requestId_idx" ON "CompletionUsage"("requestId");
CREATE INDEX "CompletionUsage_traceId_idx" ON "CompletionUsage"("traceId");
CREATE INDEX "CompletionUsage_provider_model_idx" ON "CompletionUsage"("provider", "model");
