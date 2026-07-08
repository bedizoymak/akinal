<?php
declare(strict_types=1);

/**
 * Migration cleanup: delete "Hakediş" rows from ak_customer_financial_entries
 * after verifying that all of them exist in ak_government_progress_payments.
 *
 * POST only. Runs verify internally and refuses to delete if verification fails.
 *
 * IRREVERSIBLE — only run when you are certain migration is complete.
 *
 * Protected by require_admin().
 */

require_once __DIR__ . '/../helpers.php';

require_admin();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    header('Allow: POST');
    json_error('Yalnızca POST destekleniyor.', 405);
}

try {
    if (!mgrc_table_exists('ak_customer_financial_entries')) {
        json_error('ak_customer_financial_entries tablosu bulunamadı.', 500);
    }

    if (!mgrc_table_exists('ak_government_progress_payments')) {
        json_error('ak_government_progress_payments tablosu bulunamadı. Önce apply çalıştırın.', 500);
    }

    // Internal verify before any delete
    $sourceIds = mgrc_source_ids();
    $destIds   = mgrc_dest_ids();
    $missingIds = array_values(array_diff($sourceIds, $destIds));

    if (count($missingIds) > 0) {
        json_error(
            'Doğrulama başarısız: ' . count($missingIds) . ' kaynak satır hedef tabloda bulunamadı. '
            . 'Cleanup iptal edildi. Önce apply ve verify çalıştırın.',
            409
        );
    }

    if (count($sourceIds) === 0) {
        json_success([
            'deleted' => 0,
            'message' => 'Silinecek Hakediş kaydı bulunamadı. Kaynak tablo zaten temiz.',
        ]);
    }

    // All source rows are confirmed migrated — safe to delete
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $placeholders = implode(', ', array_fill(0, count($sourceIds), '?'));
        $stmt = $pdo->prepare(
            "DELETE FROM ak_customer_financial_entries WHERE id IN ({$placeholders})"
        );
        $stmt->execute($sourceIds);
        $deleted = $stmt->rowCount();
        $pdo->commit();
    } catch (Throwable $ex) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $ex;
    }

    json_success([
        'deleted' => $deleted,
        'message' => "{$deleted} Hakediş kaydı ak_customer_financial_entries tablosundan silindi.",
    ]);
} catch (Throwable $e) {
    error_log('[migrations/gpp-cleanup] ' . get_class($e) . ': ' . $e->getMessage());
    json_error('Temizleme başarısız: ' . $e->getMessage(), 500);
}

function mgrc_table_exists(string $table): bool
{
    $stmt = db()->prepare(
        'SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :t LIMIT 1'
    );
    $stmt->execute(['t' => $table]);
    return (bool) $stmt->fetchColumn();
}

function mgrc_source_ids(): array
{
    $stmt = db()->query(
        "SELECT id FROM ak_customer_financial_entries WHERE title LIKE '%Hakediş%' ORDER BY id LIMIT 1000"
    );
    return $stmt ? ($stmt->fetchAll(\PDO::FETCH_COLUMN) ?: []) : [];
}

function mgrc_dest_ids(): array
{
    $stmt = db()->query(
        "SELECT source_customer_financial_entry_id
           FROM ak_government_progress_payments
          WHERE source_customer_financial_entry_id IS NOT NULL
          ORDER BY source_customer_financial_entry_id"
    );
    return $stmt ? ($stmt->fetchAll(\PDO::FETCH_COLUMN) ?: []) : [];
}
