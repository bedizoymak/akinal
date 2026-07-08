<?php
declare(strict_types=1);

/**
 * Migration apply: copy "Hakediş" rows from ak_customer_financial_entries into
 * ak_government_progress_payments.
 *
 * POST only. Idempotent — rows already present (matched by
 * source_customer_financial_entry_id) are skipped.
 *
 * This script creates ak_government_progress_payments if it does not exist.
 * Creating the table here is intentional — migration scripts are the correct
 * place for schema bootstrap, unlike normal API endpoints.
 *
 * Does NOT delete original rows and does NOT modify ak_customer_financial_entries.
 * Run verify, then cleanup when you are ready to remove source rows.
 *
 * Protected by require_admin(). Safe to run multiple times.
 */

require_once __DIR__ . '/../helpers.php';

require_admin();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    header('Allow: POST');
    json_error('Yalnızca POST destekleniyor.', 405);
}

try {
    if (!mgra_table_exists('ak_customer_financial_entries')) {
        json_error('ak_customer_financial_entries tablosu bulunamadı.', 500);
    }

    // Create destination table if not present (allowed in migration context)
    mgra_ensure_destination_table();

    $pdo      = db();
    $inserted = 0;
    $skipped  = 0;
    $errors   = [];

    $candidates = mgra_find_candidates();

    $pdo->beginTransaction();
    try {
        foreach ($candidates as $row) {
            $sourceId = (string) $row['id'];

            $check = $pdo->prepare(
                'SELECT id FROM ak_government_progress_payments WHERE source_customer_financial_entry_id = :sid LIMIT 1'
            );
            $check->execute(['sid' => $sourceId]);
            if ($check->fetchColumn()) {
                $skipped++;
                continue;
            }

            try {
                $stage    = mgra_detect_stage((string) ($row['title'] ?? ''));
                $stagePct = mgra_stage_pct($stage);
                $planned  = (float) ($row['amount_try']      ?? 0);
                $paid     = (float) ($row['paid_amount_try'] ?? 0);

                if ($paid <= 0) {
                    $status = 'planned';
                } elseif ($planned > 0 && $paid >= $planned) {
                    $status = 'paid';
                } else {
                    $status = 'partial';
                }

                $pdo->prepare(
                    'INSERT INTO ak_government_progress_payments
                        (id, project_id, customer_id, source_customer_financial_entry_id,
                         title, stage, stage_percentage, planned_amount_try, paid_amount_try,
                         due_date, paid_date, status, notes)
                     VALUES
                        (:id, :project_id, :customer_id, :source_cfe_id,
                         :title, :stage, :stage_pct, :planned, :paid,
                         :due_date, :paid_date, :status, :notes)'
                )->execute([
                    'id'           => uuid_v4(),
                    'project_id'   => $row['project_id'] ?: null,
                    'customer_id'  => $row['customer_id'] ?: null,
                    'source_cfe_id' => $sourceId,
                    'title'        => (string) ($row['title'] ?? ''),
                    'stage'        => $stage,
                    'stage_pct'    => $stagePct,
                    'planned'      => $planned,
                    'paid'         => $paid,
                    'due_date'     => $row['entry_date'] ?: null,
                    'paid_date'    => ($paid > 0 ? ($row['entry_date'] ?: null) : null),
                    'status'       => $status,
                    'notes'        => $row['notes'] ?: null,
                ]);
                $inserted++;
            } catch (Throwable $ex) {
                $errors[] = ['source_id' => $sourceId, 'error' => $ex->getMessage()];
            }
        }
        $pdo->commit();
    } catch (Throwable $ex) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $ex;
    }

    json_success([
        'inserted' => $inserted,
        'skipped'  => $skipped,
        'errors'   => $errors,
        'message'  => "{$inserted} kayıt eklendi, {$skipped} zaten geçirilmişti.",
        'next_step' => 'Doğrulama için government-progress-payments-verify.php\'ye GET gönderin.',
    ]);
} catch (Throwable $e) {
    error_log('[migrations/gpp-apply] ' . get_class($e) . ': ' . $e->getMessage());
    json_error('Geçiş uygulanamadı: ' . $e->getMessage(), 500);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mgra_table_exists(string $table): bool
{
    $stmt = db()->prepare(
        'SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :t LIMIT 1'
    );
    $stmt->execute(['t' => $table]);
    return (bool) $stmt->fetchColumn();
}

function mgra_ensure_destination_table(): void
{
    db()->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS ak_government_progress_payments (
  id                                  CHAR(36)      NOT NULL PRIMARY KEY,
  project_id                          CHAR(36)      NULL,
  customer_id                         CHAR(36)      NULL,
  source_customer_financial_entry_id  CHAR(36)      NULL,
  title                               VARCHAR(255)  NOT NULL,
  stage                               VARCHAR(50)   NOT NULL DEFAULT 'Belirtilmemiş',
  stage_percentage                    DECIMAL(5,2)  NOT NULL DEFAULT 0,
  planned_amount_try                  DECIMAL(15,2) NOT NULL DEFAULT 0,
  paid_amount_try                     DECIMAL(15,2) NOT NULL DEFAULT 0,
  due_date                            DATE          NULL,
  paid_date                           DATE          NULL,
  status                              VARCHAR(20)   NOT NULL DEFAULT 'planned',
  notes                               TEXT          NULL,
  created_at                          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_gpp_project_id  (project_id),
  KEY idx_gpp_customer_id (customer_id),
  KEY idx_gpp_stage       (stage),
  KEY idx_gpp_status      (status),
  KEY idx_gpp_due_date    (due_date),
  KEY idx_gpp_source_cfe  (source_customer_financial_entry_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL);
}

function mgra_find_candidates(): array
{
    $stmt = db()->query(
        "SELECT cfe.id, cfe.customer_id, cfe.project_id, cfe.title, cfe.notes,
                cfe.entry_date, cfe.amount_try, cfe.paid_amount_try
           FROM ak_customer_financial_entries cfe
          WHERE cfe.title LIKE '%Hakediş%'
          ORDER BY cfe.entry_date ASC, cfe.created_at ASC
          LIMIT 1000"
    );
    return $stmt ? ($stmt->fetchAll() ?: []) : [];
}

function mgra_detect_stage(string $title): string
{
    if (stripos($title, 'Su Basmanı') !== false)  return 'Su Basmanı';
    if (stripos($title, 'Kaba İnşaat') !== false) return 'Kaba İnşaat';
    if (stripos($title, 'Kaba')        !== false) return 'Kaba İnşaat';
    if (stripos($title, 'İnce İnşaat') !== false) return 'İnce İnşaat';
    if (stripos($title, 'İnce')        !== false) return 'İnce İnşaat';
    if (stripos($title, 'İskan')       !== false) return 'İskan';
    return 'Belirtilmemiş';
}

function mgra_stage_pct(string $stage): float
{
    return match ($stage) {
        'Su Basmanı'  => 30.0,
        'Kaba İnşaat' => 30.0,
        'İnce İnşaat' => 30.0,
        'İskan'       => 10.0,
        default       => 0.0,
    };
}
