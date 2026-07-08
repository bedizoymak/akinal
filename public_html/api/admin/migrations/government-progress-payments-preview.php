<?php
declare(strict_types=1);

/**
 * Migration preview (dry-run): list ak_customer_financial_entries rows that
 * contain "Hakediş" in their title and are candidates for migration into
 * ak_government_progress_payments.
 *
 * GET only. No writes performed.
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
    if (!mgr_table_exists('ak_customer_financial_entries')) {
        json_success(['total' => 0, 'candidates' => [], 'warning' => 'ak_customer_financial_entries tablosu bulunamadı.']);
    }

    $candidates = mgr_find_candidates();

    $alreadyMigrated = 0;
    if (mgr_table_exists('ak_government_progress_payments')) {
        foreach ($candidates as &$row) {
            $check = db()->prepare(
                'SELECT id FROM ak_government_progress_payments WHERE source_customer_financial_entry_id = :sid LIMIT 1'
            );
            $check->execute(['sid' => $row['id']]);
            $row['already_migrated'] = (bool) $check->fetchColumn();
            if ($row['already_migrated']) {
                $alreadyMigrated++;
            }
            $row['detected_stage'] = mgr_detect_stage((string) ($row['title'] ?? ''));
        }
        unset($row);
    } else {
        foreach ($candidates as &$row) {
            $row['already_migrated'] = false;
            $row['detected_stage']   = mgr_detect_stage((string) ($row['title'] ?? ''));
        }
        unset($row);
    }

    json_success([
        'total'            => count($candidates),
        'already_migrated' => $alreadyMigrated,
        'pending'          => count($candidates) - $alreadyMigrated,
        'candidates'       => $candidates,
        'warning'          => 'Bu sayfa yalnızca önizleme gösteriyor. Geçişi uygulamak için government-progress-payments-apply.php\'ye POST gönderin.',
    ]);
} catch (Throwable $e) {
    error_log('[migrations/gpp-preview] ' . get_class($e) . ': ' . $e->getMessage());
    json_error('Önizleme başarısız: ' . $e->getMessage(), 500);
}

// ---------------------------------------------------------------------------
// Shared helpers (duplicated across migration scripts for independence)
// ---------------------------------------------------------------------------

function mgr_table_exists(string $table): bool
{
    $stmt = db()->prepare(
        'SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :t LIMIT 1'
    );
    $stmt->execute(['t' => $table]);
    return (bool) $stmt->fetchColumn();
}

function mgr_find_candidates(): array
{
    $stmt = db()->query(
        "SELECT cfe.id, cfe.customer_id, cfe.project_id, cfe.title, cfe.notes,
                cfe.entry_date, cfe.amount_try, cfe.paid_amount_try, cfe.status,
                COALESCE(c.company_name, c.full_name) AS customer_name,
                p.title AS project_title
           FROM ak_customer_financial_entries cfe
           LEFT JOIN ak_customers c ON c.id = cfe.customer_id
           LEFT JOIN ak_projects  p ON p.id = cfe.project_id
          WHERE cfe.title LIKE '%Hakediş%'
          ORDER BY cfe.entry_date ASC, cfe.created_at ASC
          LIMIT 1000"
    );
    return $stmt ? ($stmt->fetchAll() ?: []) : [];
}

function mgr_detect_stage(string $title): string
{
    if (stripos($title, 'Su Basmanı') !== false)  return 'Su Basmanı';
    if (stripos($title, 'Kaba İnşaat') !== false) return 'Kaba İnşaat';
    if (stripos($title, 'Kaba')        !== false) return 'Kaba İnşaat';
    if (stripos($title, 'İnce İnşaat') !== false) return 'İnce İnşaat';
    if (stripos($title, 'İnce')        !== false) return 'İnce İnşaat';
    if (stripos($title, 'İskan')       !== false) return 'İskan';
    return 'Belirtilmemiş';
}

function mgr_stage_pct(string $stage): float
{
    return match ($stage) {
        'Su Basmanı'  => 30.0,
        'Kaba İnşaat' => 30.0,
        'İnce İnşaat' => 30.0,
        'İskan'       => 10.0,
        default       => 0.0,
    };
}
