-- =====================================================================
-- COMPREHENSIVE LEAD CLEANUP SCRIPT
-- Purpose: Remove all invalid leads (staff, deleted conversations, junk data)
-- Author: Autolumiku AI
-- Date: 2026-01-29
-- =====================================================================

-- =====================================================================
-- STEP 1: ANALYSIS FIRST (DRY RUN)
-- Run these queries to see what will be deleted
-- =====================================================================

-- 1.1 Find all staff phone numbers
SELECT 
    u.id,
    u."firstName" || ' ' || u."lastName" as staff_name,
    u.phone,
    u.role,
    u."roleLevel"
FROM "User" u
WHERE u.phone IS NOT NULL
  AND (u."roleLevel" >= 30 OR u.role IN ('SALES', 'STAFF', 'ADMIN', 'MANAGER', 'OWNER', 'SUPER_ADMIN'))
ORDER BY u."roleLevel" DESC;

-- 1.2 Find leads created by staff (using phone number match or name match)
SELECT 
    l.id,
    l.name,
    l.phone,
    l."whatsappNumber",
    l."interestedIn",
    l.status,
    l."createdAt",
    u."firstName" || ' ' || u."lastName" as staff_member_found,
    u.role as staff_role
FROM "Lead" l
INNER JOIN "User" u ON (
    -- Phone normalization match
    REPLACE(REPLACE(REPLACE(u.phone, '+', ''), '-', ''), ' ', '') = REPLACE(REPLACE(REPLACE(l.phone, '+', ''), '-', ''), ' ', '')
    OR REPLACE(REPLACE(REPLACE(u.phone, '+', ''), '-', ''), ' ', '') = REPLACE(REPLACE(REPLACE(l."whatsappNumber", '+', ''), '-', ''), ' ', '')
    OR ('0' || SUBSTRING(REPLACE(REPLACE(REPLACE(u.phone, '+', ''), '-', ''), ' ', '') FROM 3)) = REPLACE(REPLACE(REPLACE(l.phone, '+', ''), '-', ''), ' ', '')
    OR ('62' || SUBSTRING(REPLACE(REPLACE(REPLACE(u.phone, '+', ''), '-', ''), ' ', '') FROM 2)) = REPLACE(REPLACE(REPLACE(l.phone, '+', ''), '-', ''), ' ', '')
    -- Exact name match (backup)
    OR (u."firstName" || ' ' || u."lastName" = l.name)
)
WHERE u."roleLevel" >= 30 OR u.role IN ('SALES', 'STAFF', 'ADMIN', 'MANAGER', 'OWNER', 'SUPER_ADMIN')
ORDER BY l."createdAt" DESC;

-- 1.3 Count staff leads by role
SELECT 
    u.role,
    COUNT(*) as lead_count
FROM "Lead" l
INNER JOIN "User" u ON (
    REPLACE(REPLACE(REPLACE(u.phone, '+', ''), '-', ''), ' ', '') = REPLACE(REPLACE(REPLACE(l.phone, '+', ''), '-', ''), ' ', '')
    OR ('0' || SUBSTRING(REPLACE(REPLACE(REPLACE(u.phone, '+', ''), '-', ''), ' ', '') FROM 3)) = REPLACE(REPLACE(REPLACE(l.phone, '+', ''), '-', ''), ' ', '')
)
WHERE u."roleLevel" >= 30 OR u.role IN ('SALES', 'STAFF', 'ADMIN', 'MANAGER', 'OWNER', 'SUPER_ADMIN')
GROUP BY u.role
ORDER BY lead_count DESC;

-- 1.4 Find leads with deleted conversations
-- (Leads whose associated WhatsApp conversation no longer exists or is inactive)
SELECT 
    l.id,
    l.name,
    l.phone,
    l."whatsappNumber",
    l."interestedIn",
    l.status,
    l."createdAt",
    'Orphaned - No active conversation' as reason
FROM "Lead" l
WHERE l.source = 'whatsapp_auto'
  AND NOT EXISTS (
    SELECT 1 
    FROM "WhatsAppConversation" wc 
    WHERE (wc."customerPhone" = l.phone OR wc."customerPhone" = l."whatsappNumber")
      AND wc.status = 'active'
  )
ORDER BY l."createdAt" DESC;

-- 1.5 Find junk leads (no name, no vehicle interest, no budget)
SELECT 
    id,
    name,
    phone,
    "interestedIn",
    "budgetRange",
    status,
    "createdAt"
FROM "Lead"
WHERE 
    (name IS NULL OR name = phone OR name = '' OR name = 'Unknown' OR name = 'Customer Baru' OR name = 'Customer')
    AND ("interestedIn" IS NULL OR "interestedIn" = '')
    AND ("budgetRange" IS NULL OR "budgetRange" = '')
    AND status = 'NEW'
ORDER BY "createdAt" DESC;

-- =====================================================================
-- STEP 2: BACKUP (IMPORTANT!)
-- Before deleting, create a backup table
-- =====================================================================

-- Create backup table with timestamp
CREATE TABLE IF NOT EXISTS "Lead_Backup_20260129" AS 
SELECT * FROM "Lead";

-- Verify backup
SELECT COUNT(*) as total_leads_backed_up FROM "Lead_Backup_20260129";

-- =====================================================================
-- STEP 3: DELETE BAD LEADS (UNCOMMENT TO EXECUTE)
-- =====================================================================

-- 3.1 DELETE STAFF LEADS
-- UNCOMMENT THE LINES BELOW TO EXECUTE:

DELETE FROM "Lead" l
WHERE EXISTS (
    SELECT 1 FROM "User" u
    WHERE (u."roleLevel" >= 30 OR u.role IN ('SALES', 'STAFF', 'ADMIN', 'MANAGER', 'OWNER', 'SUPER_ADMIN'))
      AND (
        REPLACE(REPLACE(REPLACE(u.phone, '+', ''), '-', ''), ' ', '') = REPLACE(REPLACE(REPLACE(l.phone, '+', ''), '-', ''), ' ', '')
        OR REPLACE(REPLACE(REPLACE(u.phone, '+', ''), '-', ''), ' ', '') = REPLACE(REPLACE(REPLACE(l."whatsappNumber", '+', ''), '-', ''), ' ', '')
        OR ('0' || SUBSTRING(REPLACE(REPLACE(REPLACE(u.phone, '+', ''), '-', ''), ' ', '') FROM 3)) = REPLACE(REPLACE(REPLACE(l.phone, '+', ''), '-', ''), ' ', '')
        OR ('62' || SUBSTRING(REPLACE(REPLACE(REPLACE(u.phone, '+', ''), '-', ''), ' ', '') FROM 2)) = REPLACE(REPLACE(REPLACE(l.phone, '+', ''), '-', ''), ' ', '')
      )
);

-- 3.2 DELETE ORPHANED LEADS (from deleted conversations)
-- UNCOMMENT THE LINES BELOW TO EXECUTE:

DELETE FROM "Lead" l
WHERE l.source = 'whatsapp_auto'
  AND NOT EXISTS (
    SELECT 1 
    FROM "WhatsAppConversation" wc 
    WHERE (wc."customerPhone" = l.phone OR wc."customerPhone" = l."whatsappNumber")
      AND wc.status = 'active'
  );

-- 3.3 DELETE JUNK LEADS (no meaningful data)
-- UNCOMMENT THE LINES BELOW TO EXECUTE:

DELETE FROM "Lead"
WHERE 
    (name IS NULL OR name = phone OR name = '' OR name = 'Unknown' OR name = 'Customer Baru' OR name = 'Customer')
    AND ("interestedIn" IS NULL OR "interestedIn" = '')
    AND ("budgetRange" IS NULL OR "budgetRange" = '')
    AND status = 'NEW';

-- =====================================================================
-- STEP 4: VERIFICATION (After deletion)
-- =====================================================================

-- 4.1 Count remaining leads
SELECT COUNT(*) as remaining_leads FROM "Lead";

-- 4.2 Verify no staff leads remain
SELECT COUNT(*) as staff_leads_remaining
FROM "Lead" l
INNER JOIN "User" u ON (
    REPLACE(REPLACE(REPLACE(u.phone, '+', ''), '-', ''), ' ', '') = REPLACE(REPLACE(REPLACE(l.phone, '+', ''), '-', ''), ' ', '')
)
WHERE u."roleLevel" >= 30;

-- 4.3 Show sample of remaining leads
SELECT 
    name,
    phone,
    "interestedIn",
    "budgetRange",
    status,
    "createdAt"
FROM "Lead"
ORDER BY "createdAt" DESC
LIMIT 10;

-- =====================================================================
-- ROLLBACK PROCEDURE (If something goes wrong)
-- =====================================================================

-- To restore from backup:
-- DELETE FROM "Lead";
-- INSERT INTO "Lead" SELECT * FROM "Lead_Backup_20260129";
