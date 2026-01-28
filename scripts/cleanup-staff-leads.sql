-- ========================================
-- CLEANUP SCRIPT - HAPUS LEADS DARI STAFF/ADMIN
-- ⚠️ JALANKAN analyze-staff-leads.sql DULU SEBELUM PAKAI INI!
-- ========================================

-- STEP 1: DRY RUN - Lihat apa yang akan dihapus
-- (Hanya leads yang AMAN dihapus: tidak ada conversation, tidak aktif 30 hari)
SELECT 
  l.id,
  l.name,
  l.phone,
  l.source,
  l.status,
  l."createdAt",
  l."lastContactAt",
  u."firstName" || ' ' || u."lastName" AS staff_name,
  u.role,
  CASE 
    WHEN EXISTS (SELECT 1 FROM "WhatsAppConversation" wc WHERE wc."leadId" = l.id) 
    THEN '⚠️ HAS CONVERSATION - SKIP'
    WHEN l."lastContactAt" > NOW() - INTERVAL '30 days' 
    THEN '⚠️ RECENT ACTIVITY - SKIP'
    WHEN l.status IN ('WON', 'QUALIFIED') 
    THEN '⚠️ IMPORTANT STATUS - SKIP'
    ELSE '✅ SAFE TO DELETE'
  END AS delete_status
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
ORDER BY 
  CASE 
    WHEN EXISTS (SELECT 1 FROM "WhatsAppConversation" wc WHERE wc."leadId" = l.id) THEN 1
    WHEN l."lastContactAt" > NOW() - INTERVAL '30 days' THEN 2
    WHEN l.status IN ('WON', 'QUALIFIED') THEN 3
    ELSE 4
  END,
  l."createdAt" DESC;

-- ========================================

-- STEP 2: SUMMARY - Berapa yang akan dihapus vs di-skip
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM "WhatsAppConversation" wc WHERE wc."leadId" = l.id) 
    THEN 'SKIP: Has Conversation'
    WHEN l."lastContactAt" > NOW() - INTERVAL '30 days' 
    THEN 'SKIP: Recent Activity'
    WHEN l.status IN ('WON', 'QUALIFIED') 
    THEN 'SKIP: Important Status'
    ELSE 'DELETE: Safe to Remove'
  END AS action,
  COUNT(*) AS count
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
GROUP BY action
ORDER BY action;

-- ========================================

-- STEP 3: DELETE - HANYA HAPUS YANG AMAN
-- ⚠️ UNCOMMENT DAN JALANKAN SETELAH REVIEW STEP 1 & 2

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
    (u."roleLevel" >= 30 OR u.role IN ('STAFF', 'SALES', 'ADMIN', 'OWNER', 'SUPER_ADMIN'))
    -- SAFETY CHECKS: Hanya hapus yang benar-benar aman
    AND NOT EXISTS (
      SELECT 1 FROM "WhatsAppConversation" wc WHERE wc."leadId" = l.id
    )
    AND (l."lastContactAt" IS NULL OR l."lastContactAt" < NOW() - INTERVAL '30 days')
    AND l.status NOT IN ('WON', 'QUALIFIED')
);
*/

-- ========================================
-- ALTERNATIVE: DELETE DENGAN BACKUP
-- ========================================

-- STEP 3B: Backup dulu sebelum delete (RECOMMENDED!)
/*
-- 1. Buat tabel backup
CREATE TABLE "Lead_Backup_Staff" AS
SELECT l.*, u."firstName" || ' ' || u."lastName" AS staff_name, u.role AS staff_role
FROM "Lead" l
INNER JOIN "User" u ON (
  REGEXP_REPLACE(l.phone, '[^0-9]', '', 'g') = REGEXP_REPLACE(u.phone, '[^0-9]', '', 'g')
  OR 
  REGEXP_REPLACE(l.phone, '[^0-9]', '', 'g') = '62' || SUBSTRING(REGEXP_REPLACE(u.phone, '[^0-9]', '', 'g') FROM 2)
  OR
  '0' || SUBSTRING(REGEXP_REPLACE(l.phone, '[^0-9]', '', 'g') FROM 3) = REGEXP_REPLACE(u.phone, '[^0-9]', '', 'g')
)
WHERE 
  (u."roleLevel" >= 30 OR u.role IN ('STAFF', 'SALES', 'ADMIN', 'OWNER', 'SUPER_ADMIN'))
  AND NOT EXISTS (SELECT 1 FROM "WhatsAppConversation" wc WHERE wc."leadId" = l.id)
  AND (l."lastContactAt" IS NULL OR l."lastContactAt" < NOW() - INTERVAL '30 days')
  AND l.status NOT IN ('WON', 'QUALIFIED');

-- 2. Verify backup
SELECT COUNT(*) AS backed_up_count FROM "Lead_Backup_Staff";

-- 3. Delete dari tabel utama
DELETE FROM "Lead"
WHERE id IN (SELECT id FROM "Lead_Backup_Staff");

-- 4. Jika ada masalah, restore dari backup:
-- INSERT INTO "Lead" SELECT * FROM "Lead_Backup_Staff";
*/

-- ========================================
-- INSTRUKSI PENGGUNAAN
-- ========================================

/*
LANGKAH-LANGKAH AMAN:

1. Jalankan analyze-staff-leads.sql untuk ANALISIS lengkap
2. Jalankan STEP 1 di file ini untuk DRY RUN
3. Jalankan STEP 2 untuk lihat SUMMARY
4. Review hasilnya dengan teliti:
   - Pastikan tidak ada data penting yang akan terhapus
   - Cek apakah ada conversation aktif
   - Cek apakah ada status WON/QUALIFIED
5. Jika yakin, pilih salah satu:
   - STEP 3: Delete langsung (TIDAK RECOMMENDED)
   - STEP 3B: Backup dulu, baru delete (RECOMMENDED!)

KRITERIA YANG AKAN DIHAPUS:
✅ Phone number milik staff/admin
✅ TIDAK ada WhatsAppConversation terkait
✅ TIDAK ada aktivitas 30 hari terakhir
✅ Status BUKAN WON atau QUALIFIED

KRITERIA YANG DI-SKIP (TIDAK DIHAPUS):
⚠️ Ada conversation aktif
⚠️ Ada aktivitas dalam 30 hari terakhir
⚠️ Status WON atau QUALIFIED
*/
