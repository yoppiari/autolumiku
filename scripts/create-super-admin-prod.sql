-- ============================================================================
-- Create Super Admin User for AutoLumiku Production
-- ============================================================================
-- Run this SQL script directly on your production PostgreSQL database
--
-- Usage:
--   psql -h your-db-host -U your-db-user -d your-db-name -f create-super-admin-prod.sql
--
-- Credentials:
--   Email:    admin@autolumiku.com
--   Password: admin123
-- ============================================================================

DO $$
DECLARE
  admin_count INTEGER;
  admin_id UUID;
BEGIN
  -- Check if super admin already exists
  SELECT COUNT(*) INTO admin_count FROM "User" WHERE role = 'super_admin';

  IF admin_count > 0 THEN
    RAISE NOTICE '⚠️  Super admin already exists!';
    RAISE NOTICE 'Email: %', (SELECT email FROM "User" WHERE role = 'super_admin' LIMIT 1);
    RAISE NOTICE '';
    RAISE NOTICE 'To reset password, run:';
    RAISE NOTICE 'UPDATE "User" SET "passwordHash" = ''$2a$10$.ve6rg5SfLim9jfESvp.5uWGM5na9XtoMr3rZCujivpUbb4itut.S'' WHERE role = ''super_admin'';';
  ELSE
    -- Create super admin with bcrypt hash for 'admin123'
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
      "failedLoginAttempts",
      "createdAt",
      "updatedAt"
    ) VALUES (
      gen_random_uuid(),
      'admin@autolumiku.com',
      '$2a$10$.ve6rg5SfLim9jfESvp.5uWGM5na9XtoMr3rZCujivpUbb4itut.S', -- Password: admin123
      'Super',
      'Admin',
      '+62-800-000-0000',
      'super_admin',
      NULL,
      TRUE,
      0,
      NOW(),
      NOW()
    )
    RETURNING id INTO admin_id;

    RAISE NOTICE '';
    RAISE NOTICE '✅ Super admin created successfully!';
    RAISE NOTICE '';
    RAISE NOTICE '════════════════════════════════════════════════════════';
    RAISE NOTICE '📝 SUPER ADMIN CREDENTIALS';
    RAISE NOTICE '════════════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE '   Email:     admin@autolumiku.com';
    RAISE NOTICE '   Password:  admin123';
    RAISE NOTICE '   Role:      super_admin';
    RAISE NOTICE '   ID:        %', admin_id;
    RAISE NOTICE '';
    RAISE NOTICE '   Login URL: https://auto.lumiku.com/admin/login';
    RAISE NOTICE '';
    RAISE NOTICE '════════════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  IMPORTANT: Change the default password immediately after first login!';
    RAISE NOTICE '';
  END IF;
END $$;
