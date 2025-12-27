-- Ensure roleLevel column exists (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'roleLevel'
    ) THEN
        ALTER TABLE "users" ADD COLUMN "roleLevel" INTEGER NOT NULL DEFAULT 30;
    END IF;
END $$;

-- Update roleLevel for existing users based on role
UPDATE "users" SET "roleLevel" = CASE
    WHEN UPPER("role") = 'OWNER' THEN 100
    WHEN UPPER("role") = 'ADMIN' THEN 90
    WHEN UPPER("role") = 'SUPER_ADMIN' THEN 90
    WHEN UPPER("role") = 'MANAGER' THEN 70
    WHEN UPPER("role") = 'FINANCE' THEN 60
    ELSE 30
END
WHERE "roleLevel" = 30 OR "roleLevel" IS NULL;
