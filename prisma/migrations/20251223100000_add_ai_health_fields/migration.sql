-- AlterTable: Add AI health monitoring fields to whatsapp_ai_configs
ALTER TABLE "whatsapp_ai_configs" ADD COLUMN IF NOT EXISTS "ai_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "whatsapp_ai_configs" ADD COLUMN IF NOT EXISTS "ai_status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "whatsapp_ai_configs" ADD COLUMN IF NOT EXISTS "ai_error_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "whatsapp_ai_configs" ADD COLUMN IF NOT EXISTS "ai_last_error" TEXT;
ALTER TABLE "whatsapp_ai_configs" ADD COLUMN IF NOT EXISTS "ai_last_error_at" TIMESTAMP(3);
ALTER TABLE "whatsapp_ai_configs" ADD COLUMN IF NOT EXISTS "ai_disabled_at" TIMESTAMP(3);
ALTER TABLE "whatsapp_ai_configs" ADD COLUMN IF NOT EXISTS "ai_restored_at" TIMESTAMP(3);
