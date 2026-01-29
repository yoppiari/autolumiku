-- ============================================
-- CLEANUP DUMMY DATA FROM PRIMA MOBIL DATABASE
-- Run this when database is accessible
-- ============================================

-- STEP 1: Backup before cleanup
-- Uncomment to create backup
-- CREATE TABLE vehicle_backup AS SELECT * FROM Vehicle;
-- CREATE TABLE vehicle_photo_backup AS SELECT * FROM VehiclePhoto;

-- STEP 2: Identify dummy data (run first to see what will be deleted)
SELECT
  'Vehicles to Delete' as category,
  COUNT(*) as count,
  'Unrealistic: price > 5M OR year > 2026 OR test names' as reason
FROM Vehicle
WHERE
  price > 5000000000 -- 5M+ is unrealistic
  OR year > 2026 -- Future vehicles
  OR LOWER(make) LIKE '%test%'
  OR LOWER(model) LIKE '%test%'
  OR LOWER(make) LIKE '%dummy%'
  OR LOWER(model) LIKE '%dummy%';

-- STEP 3: Delete dummy vehicles (this will cascade to VehiclePhoto)
DELETE FROM Vehicle
WHERE
  price > 5000000000 -- Unrealistic price (5 billion+)
  OR year > 2026 -- Future vehicles
  OR LOWER(make) LIKE '%test%'
  OR LOWER(model) LIKE '%test%'
  OR LOWER(make) LIKE '%dummy%'
  OR LOWER(model) LIKE '%dummy%'
  OR displayId IS NULL -- Invalid: no display ID
  OR make = '' -- Invalid: empty make
  OR model = ''; -- Invalid: empty model

-- STEP 4: Verify cleanup
SELECT
  'Remaining Vehicles' as category,
  COUNT(*) as count,
  'Should be real data only' as note
FROM Vehicle;

-- STEP 5: Check specific makes (should be real brands)
SELECT make, COUNT(*) as count
FROM Vehicle
GROUP BY make
ORDER BY count DESC
LIMIT 10;

-- ============================================
-- EXPECTED RESULT:
-- - Real brands: Honda, Toyota, Suzuki, Daihatsu, etc.
-- - Realistic prices: 50M - 500M range
-- - Valid years: 2010 - 2026
-- ============================================
