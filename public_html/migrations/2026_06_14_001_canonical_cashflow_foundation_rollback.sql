-- Phase 3B rollback review script.
-- This rollback removes only objects introduced by the Phase 3B migration.
-- Run on staging first and only before any canonical application write path is enabled.

DELIMITER $$

DROP PROCEDURE IF EXISTS ak_phase3b_assert_no_settlements$$
CREATE PROCEDURE ak_phase3b_assert_no_settlements()
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name = 'ak_payment_plan_settlements'
  ) THEN
    SET @ak_settlement_count = 0;
    SET @ak_count_sql = 'SELECT COUNT(*) INTO @ak_settlement_count FROM ak_payment_plan_settlements';
    PREPARE ak_count_stmt FROM @ak_count_sql;
    EXECUTE ak_count_stmt;
    DEALLOCATE PREPARE ak_count_stmt;

    IF @ak_settlement_count > 0 THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Rollback refused: ak_payment_plan_settlements contains rows.';
    END IF;
  END IF;
END$$

DROP PROCEDURE IF EXISTS ak_drop_index_if_exists$$
CREATE PROCEDURE ak_drop_index_if_exists(
  IN p_table_name VARCHAR(64),
  IN p_index_name VARCHAR(64)
)
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = p_table_name
      AND index_name = p_index_name
  ) THEN
    SET @ak_ddl = CONCAT(
      'ALTER TABLE `', REPLACE(p_table_name, '`', '``'),
      '` DROP INDEX `', REPLACE(p_index_name, '`', '``'), '`'
    );
    PREPARE ak_stmt FROM @ak_ddl;
    EXECUTE ak_stmt;
    DEALLOCATE PREPARE ak_stmt;
  END IF;
END$$

DROP PROCEDURE IF EXISTS ak_drop_column_if_exists$$
CREATE PROCEDURE ak_drop_column_if_exists(
  IN p_table_name VARCHAR(64),
  IN p_column_name VARCHAR(64)
)
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = p_table_name
      AND column_name = p_column_name
  ) THEN
    SET @ak_ddl = CONCAT(
      'ALTER TABLE `', REPLACE(p_table_name, '`', '``'),
      '` DROP COLUMN `', REPLACE(p_column_name, '`', '``'), '`'
    );
    PREPARE ak_stmt FROM @ak_ddl;
    EXECUTE ak_stmt;
    DEALLOCATE PREPARE ak_stmt;
  END IF;
END$$

DELIMITER ;

CALL ak_phase3b_assert_no_settlements();

DROP TABLE IF EXISTS ak_payment_plan_settlements;

CALL ak_drop_index_if_exists('ak_financial_entries', 'idx_financial_entries_source');
CALL ak_drop_index_if_exists('ak_financial_entries', 'idx_financial_entries_business_transaction');
CALL ak_drop_index_if_exists('ak_financial_entries', 'idx_financial_entries_event_type');
CALL ak_drop_index_if_exists('ak_financial_entries', 'idx_financial_entries_payment_plan');
CALL ak_drop_index_if_exists('ak_financial_entries', 'idx_financial_entries_counterparty');
CALL ak_drop_index_if_exists('ak_financial_entries', 'idx_financial_entries_project_transaction');
CALL ak_drop_index_if_exists('ak_financial_entries', 'idx_financial_entries_account_type');
CALL ak_drop_index_if_exists('ak_financial_entries', 'idx_financial_entries_reconciliation');
CALL ak_drop_index_if_exists('ak_payment_plans', 'idx_payment_plans_counterparty');
CALL ak_drop_index_if_exists('ak_payment_plans', 'idx_payment_plans_business_transaction');
CALL ak_drop_index_if_exists('ak_payment_plans', 'idx_payment_plans_reconciliation');

CALL ak_drop_column_if_exists('ak_financial_entries', 'reversal_entry_id');
CALL ak_drop_column_if_exists('ak_financial_entries', 'cancellation_reason');
CALL ak_drop_column_if_exists('ak_financial_entries', 'canceled_by');
CALL ak_drop_column_if_exists('ak_financial_entries', 'canceled_at');
CALL ak_drop_column_if_exists('ak_financial_entries', 'archived_by');
CALL ak_drop_column_if_exists('ak_financial_entries', 'archived_at');
CALL ak_drop_column_if_exists('ak_financial_entries', 'reconciliation_status');
CALL ak_drop_column_if_exists('ak_financial_entries', 'migration_confidence');
CALL ak_drop_column_if_exists('ak_financial_entries', 'document_id');
CALL ak_drop_column_if_exists('ak_financial_entries', 'subcategory_code');
CALL ak_drop_column_if_exists('ak_financial_entries', 'category_code');
CALL ak_drop_column_if_exists('ak_financial_entries', 'base_amount');
CALL ak_drop_column_if_exists('ak_financial_entries', 'exchange_rate');
CALL ak_drop_column_if_exists('ak_financial_entries', 'due_date');
CALL ak_drop_column_if_exists('ak_financial_entries', 'transaction_date');
CALL ak_drop_column_if_exists('ak_financial_entries', 'allocation_note');
CALL ak_drop_column_if_exists('ak_financial_entries', 'allocation_scope');
CALL ak_drop_column_if_exists('ak_financial_entries', 'account_type');
CALL ak_drop_column_if_exists('ak_financial_entries', 'counterparty_id');
CALL ak_drop_column_if_exists('ak_financial_entries', 'counterparty_type');
CALL ak_drop_column_if_exists('ak_financial_entries', 'parent_entry_id');
CALL ak_drop_column_if_exists('ak_financial_entries', 'payment_plan_id');
CALL ak_drop_column_if_exists('ak_financial_entries', 'source_version');
CALL ak_drop_column_if_exists('ak_financial_entries', 'source_id');
CALL ak_drop_column_if_exists('ak_financial_entries', 'source_type');
CALL ak_drop_column_if_exists('ak_financial_entries', 'event_type');
CALL ak_drop_column_if_exists('ak_financial_entries', 'business_transaction_id');

CALL ak_drop_column_if_exists('ak_payment_plans', 'cancellation_reason');
CALL ak_drop_column_if_exists('ak_payment_plans', 'canceled_by');
CALL ak_drop_column_if_exists('ak_payment_plans', 'canceled_at');
CALL ak_drop_column_if_exists('ak_payment_plans', 'archived_by');
CALL ak_drop_column_if_exists('ak_payment_plans', 'archived_at');
CALL ak_drop_column_if_exists('ak_payment_plans', 'reconciliation_status');
CALL ak_drop_column_if_exists('ak_payment_plans', 'migration_confidence');
CALL ak_drop_column_if_exists('ak_payment_plans', 'subcategory_code');
CALL ak_drop_column_if_exists('ak_payment_plans', 'category_code');
CALL ak_drop_column_if_exists('ak_payment_plans', 'allocation_note');
CALL ak_drop_column_if_exists('ak_payment_plans', 'allocation_scope');
CALL ak_drop_column_if_exists('ak_payment_plans', 'currency');
CALL ak_drop_column_if_exists('ak_payment_plans', 'direction');
CALL ak_drop_column_if_exists('ak_payment_plans', 'counterparty_id');
CALL ak_drop_column_if_exists('ak_payment_plans', 'counterparty_type');
CALL ak_drop_column_if_exists('ak_payment_plans', 'business_transaction_id');

DROP PROCEDURE IF EXISTS ak_drop_column_if_exists;
DROP PROCEDURE IF EXISTS ak_drop_index_if_exists;
DROP PROCEDURE IF EXISTS ak_phase3b_assert_no_settlements;
