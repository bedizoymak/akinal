-- Drop ak_documents table
-- Prerequisites:
--   1. Deploy the code changes that remove all runtime dependency on this table.
--   2. Run the SELECT COUNT(*) check below.
--   3. Only proceed with DROP if row_count = 0 (or after you have confirmed all
--      rows are either empty demo data or have been manually reviewed and discarded).
--
-- Runtime dependency removed in: PHASE 5/21 — customers.php, apiTypes.ts, AdminCustomerDetail.tsx
-- Note: install-schema.php still contains the CREATE TABLE definition. Remove it separately
--       after the table has been confirmed dropped in production.

-- Step 1: Verify the table is empty before dropping.
SELECT COUNT(*) AS row_count FROM ak_documents;

-- Step 2: Only run this if row_count = 0 (or you have confirmed all data can be discarded).
-- DROP TABLE ak_documents;
