-- ========================================
-- ANALISIS LEADS DARI STAFF/ADMIN
-- Jalankan query ini untuk CROSS-CHECK sebelum hapus data
-- ========================================

-- 1. LIHAT SEMUA LEADS YANG DIBUAT OLEH STAFF
-- (Berdasarkan matching phone number dengan User table)
SELECT 
  l.id AS lead_id,
  l.name AS lead_name,
  l.phone AS lead_phone,
  l.source,
  l.status,
  l."createdAt" AS lead_created,
  l."lastContactAt",
  u.id AS user_id,
  u."firstName" || ' ' || u."lastName" AS staff_name,
  u.phone AS staff_phone,
  u.role AS staff_role,
  u."roleLevel",
  -- Hitung jumlah aktivitas/interaksi
  (SELECT COUNT(*) FROM "WhatsAppConversation" wc WHERE wc."leadId" = l.id) AS conversation_count,
  (SELECT COUNT(*) FROM "WhatsAppMessage" wm 
   JOIN "WhatsAppConversation" wc ON wm."conversationId" = wc.id 
   WHERE wc."leadId" = l.id) AS message_count
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

-- ========================================

-- 2. SUMMARY: BERAPA BANYAK LEADS STAFF & STATUS MEREKA
SELECT 
  u."firstName" || ' ' || u."lastName" AS staff_name,
  u.role,
  COUNT(l.id) AS total_leads,
  COUNT(CASE WHEN l.status = 'NEW' THEN 1 END) AS new_leads,
  COUNT(CASE WHEN l.status = 'CONTACTED' THEN 1 END) AS contacted_leads,
  COUNT(CASE WHEN l.status = 'QUALIFIED' THEN 1 END) AS qualified_leads,
  COUNT(CASE WHEN l.status = 'WON' THEN 1 END) AS won_leads,
  COUNT(CASE WHEN l.status = 'LOST' THEN 1 END) AS lost_leads,
  MIN(l."createdAt") AS oldest_lead,
  MAX(l."createdAt") AS newest_lead
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
GROUP BY u.id, u."firstName", u."lastName", u.role
ORDER BY total_leads DESC;

-- ========================================

-- 3. CEK LEADS YANG PUNYA CONVERSATION AKTIF
-- (Ini yang MUNGKIN masih terpakai - hati-hati hapus!)
SELECT 
  l.id AS lead_id,
  l.name AS lead_name,
  l.phone,
  l.status,
  u."firstName" || ' ' || u."lastName" AS staff_name,
  u.role,
  wc.id AS conversation_id,
  wc."lastMessageAt",
  wc."conversationState",
  (SELECT COUNT(*) FROM "WhatsAppMessage" WHERE "conversationId" = wc.id) AS total_messages,
  (SELECT MAX("createdAt") FROM "WhatsAppMessage" WHERE "conversationId" = wc.id) AS last_message_time
FROM "Lead" l
INNER JOIN "User" u ON (
  REGEXP_REPLACE(l.phone, '[^0-9]', '', 'g') = REGEXP_REPLACE(u.phone, '[^0-9]', '', 'g')
  OR 
  REGEXP_REPLACE(l.phone, '[^0-9]', '', 'g') = '62' || SUBSTRING(REGEXP_REPLACE(u.phone, '[^0-9]', '', 'g') FROM 2)
  OR
  '0' || SUBSTRING(REGEXP_REPLACE(l.phone, '[^0-9]', '', 'g') FROM 3) = REGEXP_REPLACE(u.phone, '[^0-9]', '', 'g')
)
LEFT JOIN "WhatsAppConversation" wc ON wc."leadId" = l.id
WHERE 
  (u."roleLevel" >= 30 OR u.role IN ('STAFF', 'SALES', 'ADMIN', 'OWNER', 'SUPER_ADMIN'))
  AND wc.id IS NOT NULL  -- Hanya yang punya conversation
ORDER BY wc."lastMessageAt" DESC NULLS LAST;

-- ========================================

-- 4. CEK LEADS YANG MASIH AKTIF (CONTACTED DALAM 7 HARI TERAKHIR)
-- (Ini yang PASTI masih terpakai - JANGAN HAPUS!)
SELECT 
  l.id AS lead_id,
  l.name AS lead_name,
  l.phone,
  l.status,
  l."lastContactAt",
  u."firstName" || ' ' || u."lastName" AS staff_name,
  u.role,
  AGE(NOW(), l."lastContactAt") AS time_since_last_contact
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
  AND l."lastContactAt" > NOW() - INTERVAL '7 days'
ORDER BY l."lastContactAt" DESC;

-- ========================================

-- 5. REKOMENDASI: LEADS YANG AMAN UNTUK DIHAPUS
-- (Tidak ada conversation, tidak ada aktivitas 30 hari terakhir)
SELECT 
  l.id AS lead_id,
  l.name AS lead_name,
  l.phone,
  l.status,
  l."createdAt",
  l."lastContactAt",
  u."firstName" || ' ' || u."lastName" AS staff_name,
  u.role,
  '✅ AMAN DIHAPUS' AS recommendation
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
  AND NOT EXISTS (
    SELECT 1 FROM "WhatsAppConversation" wc WHERE wc."leadId" = l.id
  )
  AND (l."lastContactAt" IS NULL OR l."lastContactAt" < NOW() - INTERVAL '30 days')
ORDER BY l."createdAt" DESC;

-- ========================================
-- KESIMPULAN & REKOMENDASI
-- ========================================

/*
CARA PAKAI:
1. Jalankan query 1-4 untuk ANALISIS
2. Lihat query 5 untuk rekomendasi leads yang AMAN dihapus
3. Jika yakin, jalankan DELETE statement di cleanup-staff-leads.sql

KRITERIA AMAN DIHAPUS:
✅ Tidak ada WhatsAppConversation terkait
✅ Tidak ada aktivitas 30 hari terakhir
✅ Status bukan WON atau QUALIFIED

KRITERIA JANGAN DIHAPUS:
⚠️ Ada conversation aktif
⚠️ Ada aktivitas dalam 7 hari terakhir
⚠️ Status WON atau QUALIFIED (mungkin ada deal)
*/
