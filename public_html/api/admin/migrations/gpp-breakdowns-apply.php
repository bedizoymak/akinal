<?php
declare(strict_types=1);

require_once __DIR__ . '/../helpers.php';

require_admin();
require_method('POST');

// Migration: create ak_government_progress_payment_breakdowns + backfill existing GPP rows
// that have no breakdown rows yet with the 4 standard stages.
//
// Idempotent: only touches parents with zero existing breakdowns (NOT EXISTS guard below), so
// re-running after a first successful run is a no-op for every already-seeded parent.
//
// SAFETY INVARIANT — payment state must never be overwritten by this seed tool: a parent's
// paid_amount_try may already be > 0 (paid before breakdowns existed, or paid through the old
// flat flow). The app later recomputes a parent's paid_amount_try from
// SUM(breakdown.paid_amount_try) whenever any single breakdown is edited
// (gpp_sync_parent_from_breakdowns() in government-progress-payments.php) — seeding all 4
// breakdowns at paid_amount_try=0 would silently wipe that pre-existing paid amount on the next
// edit. Instead, the already-paid amount is distributed across the 4 stages in order (waterfall,
// each capped at its own planned amount), matching the app's sequential-stage collection rule,
// so SUM(breakdown.paid_amount_try) always equals the pre-existing paid_amount_try and no
// payment history is lost.

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
        SELECT gpp.id, gpp.planned_amount_try, gpp.paid_amount_try
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
          (:id, :gpp_id, :stage, :pct, :planned, :paid, :status, :sort)
    ');

    $seeded = 0;
    $parentsWithPreservedPaid = 0;
    db()->beginTransaction();
    foreach ($parents as $parent) {
        $planned = (float) $parent['planned_amount_try'];
        // Amount already paid before this parent had breakdowns — must be preserved, not reset to 0.
        $remainingPaid = round((float) $parent['paid_amount_try'], 2);
        if ($remainingPaid > 0) $parentsWithPreservedPaid++;

        foreach ($defaultStages as [$stage, $pct, $sort]) {
            $stagePlanned = round($planned * $pct / 100, 2);

            // Waterfall allocation: fill each stage up to its own planned amount before moving
            // to the next, until the pre-existing paid amount is exhausted. This mirrors the
            // app's sequential-stage collection rule and guarantees
            // SUM(paid_amount_try) === original parent.paid_amount_try.
            $stagePaid = min($remainingPaid, $stagePlanned);
            $remainingPaid = round($remainingPaid - $stagePaid, 2);

            if ($stagePaid <= 0)                                     $status = 'planned';
            elseif ($stagePlanned > 0 && $stagePaid >= $stagePlanned) $status = 'paid';
            else                                                      $status = 'partial';

            $insertStmt->execute([
                'id'     => uuid_v4(),
                'gpp_id' => $parent['id'],
                'stage'  => $stage,
                'pct'    => $pct,
                'planned'=> $stagePlanned,
                'paid'   => $stagePaid,
                'status' => $status,
                'sort'   => $sort,
            ]);
            $seeded++;
        }
        // Any leftover (paid_amount_try > planned_amount_try, an over-payment) is intentionally
        // left unassigned to a stage rather than inflating a stage above its own planned amount.
        // The parent's own paid_amount_try column is never modified by this script.
    }
    db()->commit();

    json_success([
        'table_created' => true,
        'parents_seeded' => count($parents),
        'parents_with_preserved_paid_amount' => $parentsWithPreservedPaid,
        'breakdowns_inserted' => $seeded,
    ], 200);

} catch (Throwable $e) {
    if (db()->inTransaction()) db()->rollBack();
    error_log('[gpp-breakdowns-apply.php] ' . get_class($e) . ': ' . $e->getMessage());
    json_error('Migration başarısız: ' . $e->getMessage(), 500);
}
