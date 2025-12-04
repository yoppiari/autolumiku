-- ============================================================================
-- Create Super Admin User
-- ============================================================================
-- Email:    admin@autolumiku.com
-- Password: admin123
-- Hash generated with bcrypt, cost factor 10
-- ============================================================================

-- Delete existing super admin if any (optional, uncomment if needed)
-- DELETE FROM "User" WHERE email = 'admin@autolumiku.com';

-- Insert super admin user
INSERT INTO "User" (
  id,
  email,
  "passwordHash",
  "firstName",
  "lastName",
  phone,
  role,
  "tenantId",
  "emailVerified",
  "createdAt",
  "updatedAt"
) VALUES (
  gen_random_uuid(),
  'admin@autolumiku.com',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  'Super',
  'Admin',
  '+62-800-000-0000',
  'super_admin',
  NULL,
  true,
  NOW(),
  NOW()
)
ON CONFLICT (email)
DO UPDATE SET
  "passwordHash" = EXCLUDED."passwordHash",
  role = 'super_admin',
  "tenantId" = NULL,
  "emailVerified" = true,
  "updatedAt" = NOW();

-- Verify insertion
SELECT
  id,
  email,
  "firstName",
  "lastName",
  role,
  "tenantId",
  "emailVerified",
  "createdAt"
FROM "User"
WHERE email = 'admin@autolumiku.com';
