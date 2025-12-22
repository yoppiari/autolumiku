-- AlterTable
ALTER TABLE "whatsapp_ai_configs" ADD COLUMN IF NOT EXISTS "aiEnabled" BOOLEAN NOT NULL DEFAULT true;
