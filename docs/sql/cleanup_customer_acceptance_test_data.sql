-- Cleanup customer acceptance-test data for Akinal Insaat.
-- Manual SQL editor guidance only. Review SELECT results before running DELETE statements.
--
-- Target customer:
--   customer_id: 0916392e-42cc-4f2a-a9cc-ce6b0dddf95c
--   customer name: Mustafa Bediz
--
-- Scope:
--   Remove the target customer and rows directly related to that customer_id.
--   Do not drop tables.
--   Do not alter schema.
--   Do not touch ak_projects or public site project data.

SET @target_customer_id := '0916392e-42cc-4f2a-a9cc-ce6b0dddf95c';

-- 1. SELECT counts before cleanup.
SELECT 'ak_customers' AS table_name, COUNT(*) AS row_count
FROM ak_customers
WHERE id = @target_customer_id
UNION ALL
SELECT 'ak_notifications', COUNT(*)
FROM ak_notifications
WHERE related_customer_id = @target_customer_id
UNION ALL
SELECT 'ak_financial_entries', COUNT(*)
FROM ak_financial_entries
WHERE customer_id = @target_customer_id
UNION ALL
SELECT 'ak_payments', COUNT(*)
FROM ak_payments
WHERE customer_id = @target_customer_id
UNION ALL
SELECT 'ak_payment_plans', COUNT(*)
FROM ak_payment_plans
WHERE customer_id = @target_customer_id
UNION ALL
SELECT 'ak_expenses', COUNT(*)
FROM ak_expenses
WHERE customer_id = @target_customer_id
UNION ALL
SELECT 'ak_customer_notes', COUNT(*)
FROM ak_customer_notes
WHERE customer_id = @target_customer_id
UNION ALL
SELECT 'ak_customer_projects', COUNT(*)
FROM ak_customer_projects
WHERE customer_id = @target_customer_id
UNION ALL
SELECT 'ak_documents', COUNT(*)
FROM ak_documents
WHERE customer_id = @target_customer_id
UNION ALL
SELECT 'ak_projects_total_do_not_delete', COUNT(*)
FROM ak_projects;

-- 2. SELECT related rows before cleanup.
SELECT *
FROM ak_customers
WHERE id = @target_customer_id;

SELECT *
FROM ak_financial_entries
WHERE customer_id = @target_customer_id
ORDER BY entry_date, created_at, id;

SELECT *
FROM ak_financial_entries
WHERE customer_id = @target_customer_id
  AND title IN ('ilk taksit ödeme', 'ön ödeme elden alınan', '2. taksit', 'usd tahsil elden alınan')
ORDER BY entry_date, created_at, id;

SELECT *
FROM ak_payment_plans
WHERE customer_id = @target_customer_id
ORDER BY due_date, created_at, id;

SELECT *
FROM ak_payments
WHERE customer_id = @target_customer_id
ORDER BY payment_date, created_at, id;

SELECT *
FROM ak_expenses
WHERE customer_id = @target_customer_id
ORDER BY expense_date, created_at, id;

SELECT *
FROM ak_notifications
WHERE related_customer_id = @target_customer_id
ORDER BY created_at, id;

SELECT *
FROM ak_customer_notes
WHERE customer_id = @target_customer_id
ORDER BY created_at, id;

SELECT *
FROM ak_customer_projects
WHERE customer_id = @target_customer_id
ORDER BY created_at, id;

SELECT *
FROM ak_documents
WHERE customer_id = @target_customer_id
ORDER BY created_at, id;

-- 3-4. DELETE child/dependent rows first, then the customer.
-- Recommended manual safety workflow:
--   A. Run START TRANSACTION.
--   B. Run the DELETE statements.
--   C. Run the after-cleanup SELECT checks.
--   D. If results are correct, run COMMIT.
--   E. If results are wrong, run ROLLBACK.

START TRANSACTION;

DELETE FROM ak_notifications
WHERE related_customer_id = @target_customer_id;

DELETE FROM ak_financial_entries
WHERE customer_id = @target_customer_id;

DELETE FROM ak_payments
WHERE customer_id = @target_customer_id;

DELETE FROM ak_payment_plans
WHERE customer_id = @target_customer_id;

DELETE FROM ak_expenses
WHERE customer_id = @target_customer_id;

DELETE FROM ak_customer_notes
WHERE customer_id = @target_customer_id;

DELETE FROM ak_customer_projects
WHERE customer_id = @target_customer_id;

DELETE FROM ak_documents
WHERE customer_id = @target_customer_id;

DELETE FROM ak_customers
WHERE id = @target_customer_id;

-- 5. SELECT counts after cleanup.
SELECT 'ak_customers' AS table_name, COUNT(*) AS remaining_target_rows
FROM ak_customers
WHERE id = @target_customer_id
UNION ALL
SELECT 'ak_notifications', COUNT(*)
FROM ak_notifications
WHERE related_customer_id = @target_customer_id
UNION ALL
SELECT 'ak_financial_entries', COUNT(*)
FROM ak_financial_entries
WHERE customer_id = @target_customer_id
UNION ALL
SELECT 'ak_payments', COUNT(*)
FROM ak_payments
WHERE customer_id = @target_customer_id
UNION ALL
SELECT 'ak_payment_plans', COUNT(*)
FROM ak_payment_plans
WHERE customer_id = @target_customer_id
UNION ALL
SELECT 'ak_expenses', COUNT(*)
FROM ak_expenses
WHERE customer_id = @target_customer_id
UNION ALL
SELECT 'ak_customer_notes', COUNT(*)
FROM ak_customer_notes
WHERE customer_id = @target_customer_id
UNION ALL
SELECT 'ak_customer_projects', COUNT(*)
FROM ak_customer_projects
WHERE customer_id = @target_customer_id
UNION ALL
SELECT 'ak_documents', COUNT(*)
FROM ak_documents
WHERE customer_id = @target_customer_id;

-- Final verification query requested by cleanup task.
SELECT 'ak_customers' AS table_name, COUNT(*) AS row_count
FROM ak_customers
UNION ALL
SELECT 'ak_customer_projects', COUNT(*)
FROM ak_customer_projects
UNION ALL
SELECT 'ak_financial_entries', COUNT(*)
FROM ak_financial_entries
UNION ALL
SELECT 'ak_payment_plans', COUNT(*)
FROM ak_payment_plans
UNION ALL
SELECT 'ak_payments', COUNT(*)
FROM ak_payments
UNION ALL
SELECT 'ak_expenses', COUNT(*)
FROM ak_expenses
UNION ALL
SELECT 'ak_notifications', COUNT(*)
FROM ak_notifications
UNION ALL
SELECT 'ak_projects', COUNT(*)
FROM ak_projects;

-- Expected:
--   All target-related remaining_target_rows above are 0.
--   Test customer is removed.
--   Related customer finance rows are removed.
--   ak_projects remains 3.
--
-- If verification is correct:
-- COMMIT;
--
-- If verification is not correct:
-- ROLLBACK;
