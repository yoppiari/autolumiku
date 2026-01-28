-- ========================================
-- CLEANUP SCRIPT: EMPTY / JUNK LEADS
-- Removes leads that have no meaningful data
-- ========================================

-- STEP 1: ANALYSIS - See what will be deleted
SELECT 
  id, 
  name, 
  phone, 
  "interestedIn" as vehicle, 
  "budgetRange" as budget,
  status, 
  source,
  "createdAt"
FROM "Lead"
WHERE 
  -- Condition for "Empty/Junk" Lead:
  (name IS NULL OR name = phone OR name = '' OR name = 'Unknown' OR name = 'Customer Baru') -- No real name
  AND ("interestedIn" IS NULL OR "interestedIn" = '') -- No vehicle interest
  AND ("budgetRange" IS NULL OR "budgetRange" = '') -- No budget
  AND status = 'NEW'; -- Only delete 'NEW' leads, don't touch active ones

-- STEP 2: DELETE
-- Uncomment to run
/*
DELETE FROM "Lead"
WHERE 
  (name IS NULL OR name = phone OR name = '' OR name = 'Unknown' OR name = 'Customer Baru')
  AND ("interestedIn" IS NULL OR "interestedIn" = '')
  AND ("budgetRange" IS NULL OR "budgetRange" = '')
  AND status = 'NEW';
*/
