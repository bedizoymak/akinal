<?php
declare(strict_types=1);

/**
 * Migration verify: compare candidate rows in ak_customer_financial_entries
 * against migrated rows in ak_government_progress_payments.
 *
 * GET only. Reports counts, amount totals, and lists any source IDs that are
 * missing from the destination.
 *
 * Protected by require_admin(). Safe to run multiple times.
 */

require_once __DIR__ . '/../helpers.php';

require_admin();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    header('Allow: GET');
    json_error('Yalnızca GET destekleniyor.', 405);
}

try {
    if (!mgrv_table_exists('ak_customer_financial_entries')) {
        json_error('ak_customer_financial_entries tablosu bulunamadı.', 500);
    }

    if (!mgrv_table_exists('ak_government_progress_payments')) {
        json_success([
            'verified'   => false,
            'reason'     => 'ak_government_progress_payments tablosu henüz oluşturulmamış. Önce apply çalıştırın.',
            'source_count' => 0,
            'dest_count'   => 0,
        ]);
    }

    // Source candidates
    $sourceRows = db()->query(
        "SELECT id, amount_try, paid_amount_try
           FROM ak_customer_financial_entries
          WHERE title LIKE '%Hakediş%'
          ORDER BY id"
    );
    $sourceRows = $sourceRows ? ($sourceRows->fetchAll() ?: []) : [];
    $sourceIds   = array_column($sourceRows, 'id');
    $sourceCount = count($sourceIds);
    $sourcePlanned = array_sum(array_column($sourceRows, 'amount_try'));
    $sourcePaid    = array_sum(array_column($sourceRows, 'paid_amount_try'));

    // Destination rows
    $destRows = db()->query(
        "SELECT source_customer_financial_entry_id, planned_amount_try, paid_amount_try
           FROM ak_government_progress_payments
          WHERE source_customer_financial_entry_id IS NOT NULL
          ORDER BY source_customer_financial_entry_id"
    );
    $destRows = $destRows ? ($destRows->fetchAll() ?: []) : [];
    $destIds   = array_column($destRows, 'source_customer_financial_entry_id');
    $destCount = count($destIds);
    $destPlanned = array_sum(array_column($destRows, 'planned_amount_try'));
    $destPaid    = array_sum(array_column($destRows, 'paid_amount_try'));

    $missingIds = array_values(array_diff($sourceIds, $destIds));

    $verified = $sourceCount === $destCount && count($missingIds) === 0;

    json_success([
        'verified'        => $verified,
        'source_count'    => $sourceCount,
        'dest_count'      => $destCount,
        'missing_count'   => count($missingIds),
        'missing_ids'     => $missingIds,
        'source_planned'  => round((float) $sourcePlanned, 2),
        'source_paid'     => round((float) $sourcePaid, 2),
        'dest_planned'    => round((float) $destPlanned, 2),
        'dest_paid'       => round((float) $destPaid, 2),
        'next_step'       => $verified
            ? 'Doğrulama başarılı. Kaynak satırları silmek için government-progress-payments-cleanup.php\'ye POST gönderin.'
            : 'Doğrulama başarısız. Eksik kayıtları düzeltin ve tekrar verify çalıştırın.',
    ]);
} catch (Throwable $e) {
    error_log('[migrations/gpp-verify] ' . get_class($e) . ': ' . $e->getMessage());
    json_error('Doğrulama başarısız: ' . $e->getMessage(), 500);
}

function mgrv_table_exists(string $table): bool
{
    $stmt = db()->prepare(
        'SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :t LIMIT 1'
    );
    $stmt->execute(['t' => $table]);
    return (bool) $stmt->fetchColumn();
}
