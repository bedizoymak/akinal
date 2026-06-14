-- Phase 3B read-only schema validation.
-- Expected result: every *_status column should report OK.

SELECT
  'ak_financial_entries_columns' AS validation_area,
  COUNT(*) AS actual_count,
  27 AS expected_count,
  CASE WHEN COUNT(*) = 27 THEN 'OK' ELSE 'MISSING' END AS validation_status
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'ak_financial_entries'
  AND column_name IN (
    'business_transaction_id',
    'event_type',
    'source_type',
    'source_id',
    'source_version',
    'payment_plan_id',
    'parent_entry_id',
    'counterparty_type',
    'counterparty_id',
    'account_type',
    'allocation_scope',
    'allocation_note',
    'transaction_date',
    'due_date',
    'exchange_rate',
    'base_amount',
    'category_code',
    'subcategory_code',
    'document_id',
    'migration_confidence',
    'reconciliation_status',
    'archived_at',
    'archived_by',
    'canceled_at',
    'canceled_by',
    'cancellation_reason',
    'reversal_entry_id'
  )
UNION ALL
SELECT
  'ak_payment_plans_columns',
  COUNT(*),
  16,
  CASE WHEN COUNT(*) = 16 THEN 'OK' ELSE 'MISSING' END
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'ak_payment_plans'
  AND column_name IN (
    'business_transaction_id',
    'counterparty_type',
    'counterparty_id',
    'direction',
    'currency',
    'allocation_scope',
    'allocation_note',
    'category_code',
    'subcategory_code',
    'migration_confidence',
    'reconciliation_status',
    'archived_at',
    'archived_by',
    'canceled_at',
    'canceled_by',
    'cancellation_reason'
  )
UNION ALL
SELECT
  'settlement_table',
  COUNT(*),
  1,
  CASE WHEN COUNT(*) = 1 THEN 'OK' ELSE 'MISSING' END
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name = 'ak_payment_plan_settlements'
UNION ALL
SELECT
  'settlement_columns',
  COUNT(*),
  12,
  CASE WHEN COUNT(*) = 12 THEN 'OK' ELSE 'MISSING' END
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'ak_payment_plan_settlements'
  AND column_name IN (
    'id',
    'payment_plan_id',
    'financial_entry_id',
    'allocated_amount',
    'currency',
    'account_type',
    'created_by',
    'created_at',
    'reversed_at',
    'reversed_by',
    'reversal_reason',
    'active_pair_guard'
  )
ORDER BY validation_area;

SELECT
  table_name,
  index_name,
  GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ', ') AS indexed_columns,
  CASE WHEN non_unique = 0 THEN 'UNIQUE' ELSE 'NON_UNIQUE' END AS index_type
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND (
       (table_name = 'ak_financial_entries' AND index_name IN (
         'idx_financial_entries_source',
         'idx_financial_entries_business_transaction',
         'idx_financial_entries_event_type',
         'idx_financial_entries_payment_plan',
         'idx_financial_entries_counterparty',
         'idx_financial_entries_project_transaction',
         'idx_financial_entries_account_type',
         'idx_financial_entries_reconciliation'
       ))
    OR (table_name = 'ak_payment_plans' AND index_name IN (
         'idx_payment_plans_counterparty',
         'idx_payment_plans_business_transaction',
         'idx_payment_plans_reconciliation'
       ))
    OR (table_name = 'ak_payment_plan_settlements' AND index_name IN (
         'idx_plan_settlements_plan',
         'idx_plan_settlements_entry',
         'idx_plan_settlements_currency',
         'idx_plan_settlements_account_type',
         'uq_plan_settlements_active_pair'
       ))
  )
GROUP BY table_name, index_name, non_unique
ORDER BY table_name, index_name;

SELECT
  constraint_name,
  referenced_table_name,
  delete_rule,
  update_rule,
  CASE
    WHEN delete_rule = 'RESTRICT' AND update_rule = 'RESTRICT' THEN 'OK'
    ELSE 'REVIEW'
  END AS validation_status
FROM information_schema.referential_constraints
WHERE constraint_schema = DATABASE()
  AND table_name = 'ak_payment_plan_settlements'
ORDER BY constraint_name;

SELECT
  constraint_name,
  constraint_type,
  CASE WHEN constraint_type = 'CHECK' THEN 'OK' ELSE 'MISSING' END AS validation_status
FROM information_schema.table_constraints
WHERE constraint_schema = DATABASE()
  AND table_name = 'ak_payment_plan_settlements'
  AND constraint_name = 'chk_plan_settlements_positive';

SELECT
  COUNT(*) AS settlement_row_count,
  CASE WHEN COUNT(*) = 0 THEN 'EMPTY_FOUNDATION' ELSE 'CONTAINS_DATA' END AS settlement_state
FROM ak_payment_plan_settlements;
