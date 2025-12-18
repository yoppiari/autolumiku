-- Add Showroom table for multi-branch support
CREATE TABLE IF NOT EXISTS "showrooms" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "province" TEXT,
    "phone" TEXT,
    "whatsappNumber" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "showrooms_pkey" PRIMARY KEY ("id")
);

-- Add unique constraint for tenant + code
CREATE UNIQUE INDEX IF NOT EXISTS "showrooms_tenantId_code_key" ON "showrooms"("tenantId", "code");

-- Add indexes for showrooms
CREATE INDEX IF NOT EXISTS "showrooms_tenantId_idx" ON "showrooms"("tenantId");
CREATE INDEX IF NOT EXISTS "showrooms_isActive_idx" ON "showrooms"("isActive");

-- Add foreign key from showrooms to tenants
ALTER TABLE "showrooms" ADD CONSTRAINT "showrooms_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add showroomId column to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "showroomId" TEXT;

-- Add index for users.showroomId
CREATE INDEX IF NOT EXISTS "users_showroomId_idx" ON "users"("showroomId");

-- Add foreign key from users to showrooms
ALTER TABLE "users" ADD CONSTRAINT "users_showroomId_fkey"
    FOREIGN KEY ("showroomId") REFERENCES "showrooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add showroomId column to vehicles table
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "showroomId" TEXT;

-- Add indexes for vehicles
CREATE INDEX IF NOT EXISTS "vehicles_showroomId_idx" ON "vehicles"("showroomId");
CREATE INDEX IF NOT EXISTS "vehicles_createdBy_idx" ON "vehicles"("createdBy");

-- Add foreign key from vehicles to showrooms
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_showroomId_fkey"
    FOREIGN KEY ("showroomId") REFERENCES "showrooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add foreign key from vehicles to users (for createdBy)
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
