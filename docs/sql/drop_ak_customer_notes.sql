-- Drop ak_customer_notes table
-- Prerequisites:
--   1. Deploy the code changes that remove all runtime dependency on this table.
--   2. Run the SELECT COUNT(*) check below.
--   3. Only proceed with DROP if row_count = 0 (or after you have migrated any
--      notes you want to keep into ak_customers.notes manually).
--
-- Runtime dependency removed in: PHASE 4/21 — customers.php, apiTypes.ts, apiClient.ts, AdminCustomerDetail.tsx

-- Step 1: Verify the table is empty before dropping.
SELECT COUNT(*) AS row_count FROM ak_customer_notes;

-- Step 2: Only run this if row_count = 0 (or you have confirmed all data is migrated).
-- DROP TABLE ak_customer_notes;
