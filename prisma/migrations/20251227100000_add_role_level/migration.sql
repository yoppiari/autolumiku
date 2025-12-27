-- Add roleLevel column to User table for access control
ALTER TABLE "users" ADD COLUMN "roleLevel" INTEGER NOT NULL DEFAULT 30;

-- Update existing users with correct roleLevel based on their role
UPDATE "users" SET "roleLevel" = CASE
    WHEN UPPER("role") = 'OWNER' THEN 100
    WHEN UPPER("role") = 'ADMIN' THEN 90
    WHEN UPPER("role") = 'SUPER_ADMIN' THEN 90
    WHEN UPPER("role") = 'MANAGER' THEN 70
    WHEN UPPER("role") = 'FINANCE' THEN 60
    WHEN UPPER("role") = 'SALES' THEN 30
    ELSE 30
END;

-- Normalize role names to uppercase
UPDATE "users" SET "role" = UPPER("role");

-- Create index for faster role-based queries
CREATE INDEX "users_role_idx" ON "users"("role");
CREATE INDEX "users_roleLevel_idx" ON "users"("roleLevel");
