-- Phase 3B: additive canonical cashflow foundation.
-- MySQL 5.7+/8.0 compatible approach for shared hosting.
-- This migration adds nullable compatibility fields and does not backfill finance data.

DELIMITER $$

DROP PROCEDURE IF EXISTS ak_add_column_if_missing$$
CREATE PROCEDURE ak_add_column_if_missing(
  IN p_table_name VARCHAR(64),
  IN p_column_name VARCHAR(64),
  IN p_column_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = p_table_name
      AND column_name = p_column_name
  ) THEN
    SET @ak_ddl = CONCAT(
      'ALTER TABLE `', REPLACE(p_table_name, '`', '``'),
      '` ADD COLUMN `', REPLACE(p_column_name, '`', '``'),
      '` ', p_column_definition
    );
    PREPARE ak_stmt FROM @ak_ddl;
    EXECUTE ak_stmt;
    DEALLOCATE PREPARE ak_stmt;
  END IF;
END$$

DROP PROCEDURE IF EXISTS ak_add_index_if_missing$$
CREATE PROCEDURE ak_add_index_if_missing(
  IN p_table_name VARCHAR(64),
  IN p_index_name VARCHAR(64),
  IN p_index_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = p_table_name
      AND index_name = p_index_name
  ) THEN
    SET @ak_ddl = CONCAT(
      'ALTER TABLE `', REPLACE(p_table_name, '`', '``'),
      '` ADD ', p_index_definition
    );
    PREPARE ak_stmt FROM @ak_ddl;
    EXECUTE ak_stmt;
    DEALLOCATE PREPARE ak_stmt;
  END IF;
END$$

DELIMITER ;

CALL ak_add_column_if_missing('ak_financial_entries', 'business_transaction_id', 'CHAR(36) NULL');
CALL ak_add_column_if_missing('ak_financial_entries', 'event_type', 'VARCHAR(50) NULL');
CALL ak_add_column_if_missing('ak_financial_entries', 'source_type', 'VARCHAR(50) NULL');
CALL ak_add_column_if_missing('ak_financial_entries', 'source_id', 'CHAR(36) NULL');
CALL ak_add_column_if_missing('ak_financial_entries', 'source_version', 'VARCHAR(30) NULL');
CALL ak_add_column_if_missing('ak_financial_entries', 'payment_plan_id', 'CHAR(36) NULL');
CALL ak_add_column_if_missing('ak_financial_entries', 'parent_entry_id', 'CHAR(36) NULL');
CALL ak_add_column_if_missing('ak_financial_entries', 'counterparty_type', 'VARCHAR(30) NULL');
CALL ak_add_column_if_missing('ak_financial_entries', 'counterparty_id', 'CHAR(36) NULL');
CALL ak_add_column_if_missing('ak_financial_entries', 'account_type', 'VARCHAR(20) NULL');
CALL ak_add_column_if_missing('ak_financial_entries', 'allocation_scope', 'VARCHAR(30) NULL');
CALL ak_add_column_if_missing('ak_financial_entries', 'allocation_note', 'TEXT NULL');
CALL ak_add_column_if_missing('ak_financial_entries', 'transaction_date', 'DATE NULL');
CALL ak_add_column_if_missing('ak_financial_entries', 'due_date', 'DATE NULL');
CALL ak_add_column_if_missing('ak_financial_entries', 'exchange_rate', 'DECIMAL(18,8) NULL');
CALL ak_add_column_if_missing('ak_financial_entries', 'base_amount', 'DECIMAL(18,2) NULL');
CALL ak_add_column_if_missing('ak_financial_entries', 'category_code', 'VARCHAR(80) NULL');
CALL ak_add_column_if_missing('ak_financial_entries', 'subcategory_code', 'VARCHAR(80) NULL');
CALL ak_add_column_if_missing('ak_financial_entries', 'document_id', 'CHAR(36) NULL');
CALL ak_add_column_if_missing('ak_financial_entries', 'migration_confidence', 'VARCHAR(30) NULL');
CALL ak_add_column_if_missing('ak_financial_entries', 'reconciliation_status', 'VARCHAR(30) NULL');
CALL ak_add_column_if_missing('ak_financial_entries', 'archived_at', 'DATETIME NULL');
CALL ak_add_column_if_missing('ak_financial_entries', 'archived_by', 'CHAR(36) NULL');
CALL ak_add_column_if_missing('ak_financial_entries', 'canceled_at', 'DATETIME NULL');
CALL ak_add_column_if_missing('ak_financial_entries', 'canceled_by', 'CHAR(36) NULL');
CALL ak_add_column_if_missing('ak_financial_entries', 'cancellation_reason', 'TEXT NULL');
CALL ak_add_column_if_missing('ak_financial_entries', 'reversal_entry_id', 'CHAR(36) NULL');

CALL ak_add_column_if_missing('ak_payment_plans', 'business_transaction_id', 'CHAR(36) NULL');
CALL ak_add_column_if_missing('ak_payment_plans', 'counterparty_type', 'VARCHAR(30) NULL');
CALL ak_add_column_if_missing('ak_payment_plans', 'counterparty_id', 'CHAR(36) NULL');
CALL ak_add_column_if_missing('ak_payment_plans', 'direction', 'VARCHAR(20) NULL');
CALL ak_add_column_if_missing('ak_payment_plans', 'currency', 'VARCHAR(10) NULL');
CALL ak_add_column_if_missing('ak_payment_plans', 'allocation_scope', 'VARCHAR(30) NULL');
CALL ak_add_column_if_missing('ak_payment_plans', 'allocation_note', 'TEXT NULL');
CALL ak_add_column_if_missing('ak_payment_plans', 'category_code', 'VARCHAR(80) NULL');
CALL ak_add_column_if_missing('ak_payment_plans', 'subcategory_code', 'VARCHAR(80) NULL');
CALL ak_add_column_if_missing('ak_payment_plans', 'migration_confidence', 'VARCHAR(30) NULL');
CALL ak_add_column_if_missing('ak_payment_plans', 'reconciliation_status', 'VARCHAR(30) NULL');
CALL ak_add_column_if_missing('ak_payment_plans', 'archived_at', 'DATETIME NULL');
CALL ak_add_column_if_missing('ak_payment_plans', 'archived_by', 'CHAR(36) NULL');
CALL ak_add_column_if_missing('ak_payment_plans', 'canceled_at', 'DATETIME NULL');
CALL ak_add_column_if_missing('ak_payment_plans', 'canceled_by', 'CHAR(36) NULL');
CALL ak_add_column_if_missing('ak_payment_plans', 'cancellation_reason', 'TEXT NULL');

CREATE TABLE IF NOT EXISTS ak_payment_plan_settlements (
  id CHAR(36) NOT NULL PRIMARY KEY,
  payment_plan_id CHAR(36) NOT NULL,
  financial_entry_id CHAR(36) NOT NULL,
  allocated_amount DECIMAL(18,2) NOT NULL,
  currency VARCHAR(10) NOT NULL,
  account_type VARCHAR(20) NOT NULL,
  created_by CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reversed_at DATETIME NULL,
  reversed_by CHAR(36) NULL,
  reversal_reason TEXT NULL,
  active_pair_guard TINYINT
    GENERATED ALWAYS AS (CASE WHEN reversed_at IS NULL THEN 1 ELSE NULL END) STORED,
  KEY idx_plan_settlements_plan (payment_plan_id),
  KEY idx_plan_settlements_entry (financial_entry_id),
  KEY idx_plan_settlements_currency (currency),
  KEY idx_plan_settlements_account_type (account_type),
  UNIQUE KEY uq_plan_settlements_active_pair (
    payment_plan_id,
    financial_entry_id,
    active_pair_guard
  ),
  CONSTRAINT chk_plan_settlements_positive CHECK (allocated_amount > 0),
  CONSTRAINT fk_plan_settlements_plan
    FOREIGN KEY (payment_plan_id) REFERENCES ak_payment_plans(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_plan_settlements_entry
    FOREIGN KEY (financial_entry_id) REFERENCES ak_financial_entries(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_plan_settlements_created_by
    FOREIGN KEY (created_by) REFERENCES ak_admin_users(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_plan_settlements_reversed_by
    FOREIGN KEY (reversed_by) REFERENCES ak_admin_users(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CALL ak_add_index_if_missing(
  'ak_financial_entries',
  'idx_financial_entries_source',
  'INDEX `idx_financial_entries_source` (`source_type`, `source_id`)'
);
CALL ak_add_index_if_missing(
  'ak_financial_entries',
  'idx_financial_entries_business_transaction',
  'INDEX `idx_financial_entries_business_transaction` (`business_transaction_id`)'
);
CALL ak_add_index_if_missing(
  'ak_financial_entries',
  'idx_financial_entries_event_type',
  'INDEX `idx_financial_entries_event_type` (`event_type`)'
);
CALL ak_add_index_if_missing(
  'ak_financial_entries',
  'idx_financial_entries_payment_plan',
  'INDEX `idx_financial_entries_payment_plan` (`payment_plan_id`)'
);
CALL ak_add_index_if_missing(
  'ak_financial_entries',
  'idx_financial_entries_counterparty',
  'INDEX `idx_financial_entries_counterparty` (`counterparty_type`, `counterparty_id`)'
);
CALL ak_add_index_if_missing(
  'ak_financial_entries',
  'idx_financial_entries_project_transaction',
  'INDEX `idx_financial_entries_project_transaction` (`project_id`, `transaction_date`)'
);
CALL ak_add_index_if_missing(
  'ak_financial_entries',
  'idx_financial_entries_account_type',
  'INDEX `idx_financial_entries_account_type` (`account_type`)'
);
CALL ak_add_index_if_missing(
  'ak_financial_entries',
  'idx_financial_entries_reconciliation',
  'INDEX `idx_financial_entries_reconciliation` (`reconciliation_status`)'
);
CALL ak_add_index_if_missing(
  'ak_payment_plans',
  'idx_payment_plans_counterparty',
  'INDEX `idx_payment_plans_counterparty` (`counterparty_type`, `counterparty_id`)'
);
CALL ak_add_index_if_missing(
  'ak_payment_plans',
  'idx_payment_plans_business_transaction',
  'INDEX `idx_payment_plans_business_transaction` (`business_transaction_id`)'
);
CALL ak_add_index_if_missing(
  'ak_payment_plans',
  'idx_payment_plans_reconciliation',
  'INDEX `idx_payment_plans_reconciliation` (`reconciliation_status`)'
);

DROP PROCEDURE IF EXISTS ak_add_index_if_missing;
DROP PROCEDURE IF EXISTS ak_add_column_if_missing;
