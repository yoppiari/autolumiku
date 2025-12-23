-- AlterTable: Add AI health monitoring fields to whatsapp_ai_configs
-- Using DO block to handle columns that may already exist

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='whatsapp_ai_configs' AND column_name='ai_enabled') THEN
        ALTER TABLE "whatsapp_ai_configs" ADD COLUMN "ai_enabled" BOOLEAN NOT NULL DEFAULT true;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='whatsapp_ai_configs' AND column_name='ai_status') THEN
        ALTER TABLE "whatsapp_ai_configs" ADD COLUMN "ai_status" TEXT NOT NULL DEFAULT 'active';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='whatsapp_ai_configs' AND column_name='ai_error_count') THEN
        ALTER TABLE "whatsapp_ai_configs" ADD COLUMN "ai_error_count" INTEGER NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='whatsapp_ai_configs' AND column_name='ai_last_error') THEN
        ALTER TABLE "whatsapp_ai_configs" ADD COLUMN "ai_last_error" TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='whatsapp_ai_configs' AND column_name='ai_last_error_at') THEN
        ALTER TABLE "whatsapp_ai_configs" ADD COLUMN "ai_last_error_at" TIMESTAMP(3);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='whatsapp_ai_configs' AND column_name='ai_disabled_at') THEN
        ALTER TABLE "whatsapp_ai_configs" ADD COLUMN "ai_disabled_at" TIMESTAMP(3);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='whatsapp_ai_configs' AND column_name='ai_restored_at') THEN
        ALTER TABLE "whatsapp_ai_configs" ADD COLUMN "ai_restored_at" TIMESTAMP(3);
    END IF;
END $$;
