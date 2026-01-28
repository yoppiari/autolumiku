-- Cleanup script to delete leads created by staff/admin users
-- Run this on your production database server

-- First, let's see what we're about to delete (DRY RUN)
SELECT 
  l.id,
  l.name,
  l.phone,
  l.source,
  l."createdAt",
  u."firstName",
  u."lastName",
  u.role
FROM "Lead" l
INNER JOIN "User" u ON (
  -- Match phone numbers (handle 62xxx vs 0xxx formats)
  REGEXP_REPLACE(l.phone, '[^0-9]', '', 'g') = REGEXP_REPLACE(u.phone, '[^0-9]', '', 'g')
  OR 
  REGEXP_REPLACE(l.phone, '[^0-9]', '', 'g') = '62' || SUBSTRING(REGEXP_REPLACE(u.phone, '[^0-9]', '', 'g') FROM 2)
  OR
  '0' || SUBSTRING(REGEXP_REPLACE(l.phone, '[^0-9]', '', 'g') FROM 3) = REGEXP_REPLACE(u.phone, '[^0-9]', '', 'g')
)
WHERE 
  u."roleLevel" >= 30 
  OR u.role IN ('STAFF', 'SALES', 'ADMIN', 'OWNER', 'SUPER_ADMIN')
ORDER BY l."createdAt" DESC;

-- After reviewing the above, uncomment and run this to DELETE:
/*
DELETE FROM "Lead"
WHERE id IN (
  SELECT l.id
  FROM "Lead" l
  INNER JOIN "User" u ON (
    REGEXP_REPLACE(l.phone, '[^0-9]', '', 'g') = REGEXP_REPLACE(u.phone, '[^0-9]', '', 'g')
    OR 
    REGEXP_REPLACE(l.phone, '[^0-9]', '', 'g') = '62' || SUBSTRING(REGEXP_REPLACE(u.phone, '[^0-9]', '', 'g') FROM 2)
    OR
    '0' || SUBSTRING(REGEXP_REPLACE(l.phone, '[^0-9]', '', 'g') FROM 3) = REGEXP_REPLACE(u.phone, '[^0-9]', '', 'g')
  )
  WHERE 
    u."roleLevel" >= 30 
    OR u.role IN ('STAFF', 'SALES', 'ADMIN', 'OWNER', 'SUPER_ADMIN')
);
*/
