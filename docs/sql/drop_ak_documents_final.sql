-- ============================================================================
-- DROP ak_documents — FINAL PACKAGE
-- ============================================================================
-- Business decision: 2026-06-24
-- Reason: ak_documents is redundant. Attachment storage is handled by
--         document_url fields on ak_payments, ak_expenses, ak_financial_entries.
--
-- Prerequisites before running this script:
--   1. Code changes have been deployed (install-schema.php CREATE TABLE removed).
--   2. All three verification SELECTs below return expected values.
--   3. Owner has explicitly confirmed: "Execute the drop."
--
-- DO NOT execute DROP TABLE automatically. Run it manually after Step 3.
-- ============================================================================

-- Step 1: Confirm the table still exists.
SHOW TABLES LIKE 'ak_documents';
-- Expected: 1 row ('ak_documents'). If 0 rows, table is already gone.

-- Step 2: Confirm the table is empty.
SELECT COUNT(*) AS row_count FROM ak_documents;
-- Expected: row_count = 0.
-- Verified live: 2026-06-24 15:55:44 UTC — row_count = 0.

-- Step 3: Confirm no enforced foreign key points at ak_documents.
SELECT
    TABLE_NAME,
    COLUMN_NAME,
    CONSTRAINT_NAME,
    REFERENCED_TABLE_NAME
FROM
    INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE
    REFERENCED_TABLE_SCHEMA = DATABASE()
    AND REFERENCED_TABLE_NAME = 'ak_documents';
-- Expected: 0 rows (no FK constraints reference this table).
-- Note: ak_financial_entries.document_id is a soft/advisory UUID column with
--       no enforced FK constraint. Dropping ak_documents is safe.

-- Step 4: Only run this after Steps 1-3 pass and owner has approved.
-- DROP TABLE ak_documents;
