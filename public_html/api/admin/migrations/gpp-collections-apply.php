<?php
declare(strict_types=1);

require_once __DIR__ . '/../helpers.php';

require_admin();
require_method('POST');

// Migration: create ak_government_progress_payment_collections.
// Idempotent: safe to run multiple times.

try {
    db()->exec('
        CREATE TABLE IF NOT EXISTS ak_government_progress_payment_collections (
          id                              CHAR(36)       NOT NULL PRIMARY KEY,
          government_progress_payment_id  CHAR(36)       NOT NULL,
          breakdown_id                    CHAR(36)       NULL,
          project_id                      CHAR(36)       NULL,
          customer_id                     CHAR(36)       NULL,
          title                           VARCHAR(255)   NOT NULL,
          collection_date                 DATE           NOT NULL,
          amount_try                      DECIMAL(15,2)  NOT NULL DEFAULT 0,
          notes                           TEXT           NULL,
          created_at                      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at                      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          KEY idx_gppc_payment_id      (government_progress_payment_id),
          KEY idx_gppc_breakdown_id    (breakdown_id),
          KEY idx_gppc_collection_date (collection_date),
          KEY idx_gppc_project_id      (project_id),
          KEY idx_gppc_customer_id     (customer_id),
          CONSTRAINT fk_gppc_payment   FOREIGN KEY (government_progress_payment_id)
            REFERENCES ak_government_progress_payments (id) ON DELETE CASCADE,
          CONSTRAINT fk_gppc_breakdown FOREIGN KEY (breakdown_id)
            REFERENCES ak_government_progress_payment_breakdowns (id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ');

    json_success(['table_created' => true]);

} catch (Throwable $e) {
    error_log('[gpp-collections-apply.php] ' . get_class($e) . ': ' . $e->getMessage());
    json_error('Migration başarısız: ' . $e->getMessage(), 500);
}
