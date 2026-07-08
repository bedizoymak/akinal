<?php
declare(strict_types=1);

require_once __DIR__ . '/../helpers.php';

require_admin();
require_method('POST');

// Migration: create ak_government_progress_payment_breakdowns + backfill existing GPP rows.
// Idempotent: safe to run multiple times.

try {
    // 1. Create table if not exists (allowed in migration context)
    db()->exec('
        CREATE TABLE IF NOT EXISTS ak_government_progress_payment_breakdowns (
          id                              CHAR(36)       NOT NULL PRIMARY KEY,
          government_progress_payment_id  CHAR(36)       NOT NULL,
          stage                           VARCHAR(50)    NOT NULL,
          stage_percentage                DECIMAL(5,2)   NOT NULL DEFAULT 0,
          planned_amount_try              DECIMAL(15,2)  NOT NULL DEFAULT 0,
          paid_amount_try                 DECIMAL(15,2)  NOT NULL DEFAULT 0,
          due_date                        DATE           NULL,
          paid_date                       DATE           NULL,
          status                          VARCHAR(20)    NOT NULL DEFAULT \'planned\',
          notes                           TEXT           NULL,
          sort_order                      INT            NOT NULL DEFAULT 0,
          created_at                      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at                      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          KEY idx_gppb_payment_id (government_progress_payment_id),
          KEY idx_gppb_stage      (stage),
          KEY idx_gppb_status     (status),
          KEY idx_gppb_due_date   (due_date),
          KEY idx_gppb_sort       (sort_order),
          CONSTRAINT fk_gppb_payment FOREIGN KEY (government_progress_payment_id)
            REFERENCES ak_government_progress_payments (id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ');

    // 2. Fetch all parent GPP rows that have no breakdowns yet
    $parents = db()->query('
        SELECT gpp.id, gpp.planned_amount_try
          FROM ak_government_progress_payments gpp
         WHERE NOT EXISTS (
               SELECT 1 FROM ak_government_progress_payment_breakdowns b
                WHERE b.government_progress_payment_id = gpp.id
               LIMIT 1
         )
    ')->fetchAll();

    $defaultStages = [
        ['Su Basmanı',  30.0, 1],
        ['Kaba İnşaat', 30.0, 2],
        ['İnce İnşaat', 30.0, 3],
        ['İskan',       10.0, 4],
    ];

    $insertStmt = db()->prepare('
        INSERT INTO ak_government_progress_payment_breakdowns
          (id, government_progress_payment_id, stage, stage_percentage, planned_amount_try, paid_amount_try, status, sort_order)
        VALUES
          (:id, :gpp_id, :stage, :pct, :planned, 0, \'planned\', :sort)
    ');

    $seeded = 0;
    db()->beginTransaction();
    foreach ($parents as $parent) {
        $planned = (float) $parent['planned_amount_try'];
        foreach ($defaultStages as [$stage, $pct, $sort]) {
            $amount = round($planned * $pct / 100, 2);
            $insertStmt->execute([
                'id'     => uuid_v4(),
                'gpp_id' => $parent['id'],
                'stage'  => $stage,
                'pct'    => $pct,
                'planned'=> $amount,
                'sort'   => $sort,
            ]);
            $seeded++;
        }
    }
    db()->commit();

    json_success([
        'table_created' => true,
        'parents_seeded' => count($parents),
        'breakdowns_inserted' => $seeded,
    ], 200);

} catch (Throwable $e) {
    if (db()->inTransaction()) db()->rollBack();
    error_log('[gpp-breakdowns-apply.php] ' . get_class($e) . ': ' . $e->getMessage());
    json_error('Migration başarısız: ' . $e->getMessage(), 500);
}
