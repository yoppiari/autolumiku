-- LLM Observability & Evaluation (Super Admin)

-- CreateTable
CREATE TABLE "llm_call_logs" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "tenantId" TEXT,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "finishReason" TEXT,
    "latencyMs" INTEGER NOT NULL,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "llm_call_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "llm_call_logs_createdAt_idx" ON "llm_call_logs"("createdAt");
CREATE INDEX "llm_call_logs_provider_model_idx" ON "llm_call_logs"("provider", "model");
CREATE INDEX "llm_call_logs_feature_idx" ON "llm_call_logs"("feature");
CREATE INDEX "llm_call_logs_tenantId_idx" ON "llm_call_logs"("tenantId");
CREATE INDEX "llm_call_logs_success_idx" ON "llm_call_logs"("success");

-- CreateTable
CREATE TABLE "llm_endpoints" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'text',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "llm_endpoints_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "llm_endpoints_name_key" ON "llm_endpoints"("name");
CREATE INDEX "llm_endpoints_enabled_idx" ON "llm_endpoints"("enabled");

-- CreateTable
CREATE TABLE "llm_eval_scenarios" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "systemPrompt" TEXT,
    "userPrompt" TEXT NOT NULL,
    "assertions" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "llm_eval_scenarios_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "llm_eval_scenarios_enabled_idx" ON "llm_eval_scenarios"("enabled");
CREATE INDEX "llm_eval_scenarios_category_idx" ON "llm_eval_scenarios"("category");

-- CreateTable
CREATE TABLE "llm_eval_runs" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT,
    "endpointId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "score" DOUBLE PRECISION,
    "totalAssertions" INTEGER NOT NULL DEFAULT 0,
    "passedAssertions" INTEGER NOT NULL DEFAULT 0,
    "responseText" TEXT,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "llm_eval_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "llm_eval_runs_createdAt_idx" ON "llm_eval_runs"("createdAt");
CREATE INDEX "llm_eval_runs_scenarioId_idx" ON "llm_eval_runs"("scenarioId");
CREATE INDEX "llm_eval_runs_status_idx" ON "llm_eval_runs"("status");

-- AddForeignKey
ALTER TABLE "llm_eval_runs" ADD CONSTRAINT "llm_eval_runs_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "llm_eval_scenarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "llm_eval_runs" ADD CONSTRAINT "llm_eval_runs_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "llm_endpoints"("id") ON DELETE SET NULL ON UPDATE CASCADE;
