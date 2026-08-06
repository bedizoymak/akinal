<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/finance-entry-helpers.php';

require_admin();
require_method('GET');

// Gelenler — all incoming income: customer financial entries + government progress payments

try {
    $projectId   = trim((string) ($_GET['project_id']   ?? ''));
    $customerId  = trim((string) ($_GET['customer_id']  ?? ''));
    $currency    = trim((string) ($_GET['currency']     ?? ''));
    $accountType = trim((string) ($_GET['account_type'] ?? ''));
    // Independent of account_type (P3-9): government-progress rows carry no
    // Resmi/Gayri Resmi classification (see gelenler_fetch_gpp() below), so
    // they need their own filterable record type rather than being silently
    // excluded whenever any account_type filter is active.
    $recordType  = trim((string) ($_GET['record_type']  ?? ''));
    $status      = trim((string) ($_GET['status']       ?? ''));
    $dateFrom    = trim((string) ($_GET['date_from']    ?? ''));
    $dateTo      = trim((string) ($_GET['date_to']      ?? ''));
    $q           = trim((string) ($_GET['q']            ?? ''));

    // ── Customer financial entries ────────────────────────────────────────────

    $cfeWhere  = ['cfe.title NOT LIKE \'%Hakediş%\''];
    $cfeParams = [];

    if ($projectId !== '')   { $cfeWhere[] = 'cfe.project_id = :project_id';     $cfeParams['project_id']   = $projectId; }
    if ($customerId !== '')  { $cfeWhere[] = 'cfe.customer_id = :customer_id';   $cfeParams['customer_id']  = $customerId; }
    if ($currency !== '')    { $cfeWhere[] = 'cfe.currency = :currency';          $cfeParams['currency']     = $currency; }
    if ($accountType !== '') { $cfeWhere[] = 'cfe.account_type = :account_type'; $cfeParams['account_type'] = $accountType; }
    if ($status === 'Açık') {
        // "Açık" (open/uncollected) is a synthetic status, not a stored value — canonical open
        // customer receivable = any row whose fe_auto_status() (finance-entry-helpers.php) is
        // not a fully-settled status. Drives the dashboard's "Beklenen Tahsilat" card link.
        $cfeWhere[] = "cfe.status IN ('Planlanan', 'Gecikmiş', 'Kısmi Ödendi')";
    } elseif ($status === 'Gecikmiş') {
        // Also synthetic, not a literal status match: fe_auto_status() only ever assigns the
        // 'Gecikmiş' string to a fully-UNPAID overdue row — a partially paid overdue row is always
        // stored as 'Kısmi Ödendi' regardless of its due date (see finance-entry-helpers.php
        // fe_auto_status()). Filtering on the stored status string would silently drop partially
        // paid overdue receivables from this destination page even after the dashboard's "Vadesi
        // Geçen Alacak" card (dashboard.php) correctly counts them via the same live date/balance
        // rule. Recomputed here identically so the card total and this list can never diverge.
        $cfeWhere[] = 'cfe.entry_date < :gecikmis_today AND cfe.amount_try > cfe.paid_amount_try';
        $cfeParams['gecikmis_today'] = date('Y-m-d');
    } elseif ($status !== '') {
        $cfeWhere[] = 'cfe.status = :status';
        $cfeParams['status'] = $status;
    }
    if ($dateFrom !== '')    { $cfeWhere[] = 'cfe.entry_date >= :date_from';      $cfeParams['date_from']    = $dateFrom; }
    if ($dateTo !== '')      { $cfeWhere[] = 'cfe.entry_date <= :date_to';        $cfeParams['date_to']      = $dateTo; }
    if ($q !== '') {
        $cfeWhere[] = '(cfe.title LIKE :q OR COALESCE(c.company_name, c.full_name) LIKE :q2)';
        $like = '%' . $q . '%';
        $cfeParams['q']  = $like;
        $cfeParams['q2'] = $like;
    }

    $cfeWhereClause = 'WHERE ' . implode(' AND ', $cfeWhere);

    // record_type=government asks for GPP rows only; anything else (including
    // "all"/unset) includes customer entries as before.
    $cfeEntries = [];
    if ($recordType !== 'government') {
        $cfeEntries = fe_fetch_all("
            SELECT
              cfe.*,
              COALESCE(c.company_name, c.full_name) AS owner_name,
              p.title AS project_title,
              'customer' AS source_type,
              'Müşteri'  AS source_label
            FROM ak_customer_financial_entries cfe
            LEFT JOIN ak_customers c ON c.id = cfe.customer_id
            LEFT JOIN ak_projects  p ON p.id = cfe.project_id
            {$cfeWhereClause}
            ORDER BY cfe.entry_date DESC, cfe.created_at DESC
            LIMIT 1000
        ", $cfeParams);
    }

    // ── Government progress payments ──────────────────────────────────────────

    $gppEntries = [];

    // record_type=customer explicitly excludes GPP rows. record_type=government
    // always includes them regardless of any account_type (they have none).
    // Otherwise (unset/"all"), account_type still excludes GPP as before —
    // a Resmi/Gayri Resmi filter should never surface unclassified rows.
    if ($recordType !== 'customer' && gelenler_table_exists('ak_government_progress_payments')) {
        $gppAccountType = $recordType === 'government' ? '' : $accountType;
        $gppEntries = gelenler_fetch_gpp($projectId, $customerId, $gppAccountType, $status, $dateFrom, $dateTo, $q);
    }

    // ── Merge, sort by entry_date DESC then created_at DESC, limit 1000 ───────

    $entries = array_merge($cfeEntries, $gppEntries);
    usort($entries, static function (array $a, array $b): int {
        $dateCmp = strcmp((string) ($b['entry_date'] ?? ''), (string) ($a['entry_date'] ?? ''));
        if ($dateCmp !== 0) return $dateCmp;
        return strcmp((string) ($b['created_at'] ?? ''), (string) ($a['created_at'] ?? ''));
    });
    if (count($entries) > 1000) {
        $entries = array_slice($entries, 0, 1000);
    }

    $summary  = gelenler_summary($entries);
    $projects = db()->query('SELECT id, title FROM ak_projects ORDER BY title ASC')->fetchAll() ?: [];
    $customers = db()->query("SELECT id, COALESCE(company_name, full_name) AS name FROM ak_customers ORDER BY name ASC")->fetchAll() ?: [];

    json_success([
        'entries'   => $entries,
        'summary'   => $summary,
        'projects'  => $projects,
        'customers' => $customers,
    ]);
} catch (Throwable $e) {
    json_error('Gelenler listesi yüklenemedi.', 500);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function gelenler_table_exists(string $table): bool
{
    $stmt = db()->prepare(
        'SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :t LIMIT 1'
    );
    $stmt->execute(['t' => $table]);
    return (bool) $stmt->fetchColumn();
}

function gelenler_fetch_gpp(
    string $projectId,
    string $customerId,
    string $accountType,
    string $status,
    string $dateFrom,
    string $dateTo,
    string $q
): array {
    // ak_government_progress_payments has no account_type column — GPP rows carry no genuine
    // Resmi/Gayri Resmi classification. Rather than guessing one, exclude them entirely when
    // that filter is active so a "Resmi"/"Gayri Resmi" view never silently includes
    // unclassified rows.
    if ($accountType !== '') {
        return [];
    }

    $where  = [];
    $params = [];

    if ($projectId !== '')  { $where[] = 'gpp.project_id = :project_id';   $params['project_id']  = $projectId; }
    if ($customerId !== '') { $where[] = 'gpp.customer_id = :customer_id'; $params['customer_id'] = $customerId; }

    if ($dateFrom !== '') { $where[] = 'COALESCE(gpp.due_date, DATE(gpp.created_at)) >= :date_from'; $params['date_from'] = $dateFrom; }
    if ($dateTo !== '')   { $where[] = 'COALESCE(gpp.due_date, DATE(gpp.created_at)) <= :date_to';   $params['date_to']   = $dateTo; }

    // Status filter: map Turkish display status to GPP stored values
    if ($status !== '') {
        switch ($status) {
            case 'Gerçekleşti':
                $where[] = "gpp.status = 'paid'";
                break;
            case 'Kısmi Ödendi':
                $where[] = "gpp.status = 'partial'";
                break;
            case 'Gecikmiş':
                $where[] = "gpp.status NOT IN ('paid', 'cancelled') AND gpp.due_date IS NOT NULL AND gpp.due_date < CURDATE()";
                break;
            case 'Planlanan':
                $where[] = "gpp.status = 'planned' AND (gpp.due_date IS NULL OR gpp.due_date >= CURDATE())";
                break;
            case 'Fazla Ödendi':
                // No GPP equivalent — return no rows for this filter
                return [];
            default:
                // Unknown status — skip GPP to avoid returning irrelevant data
                return [];
        }
    }

    if ($q !== '') {
        $where[] = '(gpp.title LIKE :gq OR COALESCE(c.company_name, c.full_name) LIKE :gq2 OR p.title LIKE :gq3)';
        $like = '%' . $q . '%';
        $params['gq']  = $like;
        $params['gq2'] = $like;
        $params['gq3'] = $like;
    }

    $whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    $sql = "
        SELECT
          gpp.id,
          'government'                                                    AS source_type,
          'Devlet Hakedişi'                                               AS source_label,
          gpp.customer_id                                                 AS customer_id,
          COALESCE(c.company_name, c.full_name)                          AS owner_name,
          gpp.project_id,
          p.title                                                         AS project_title,
          COALESCE(gpp.due_date, DATE(gpp.created_at))                   AS entry_date,
          gpp.title,
          gpp.notes,
          NULL                                                            AS account_type,
          gpp.planned_amount_try                                         AS amount_try,
          gpp.paid_amount_try                                            AS paid_amount_try,
          GREATEST(0, gpp.planned_amount_try - gpp.paid_amount_try)      AS remaining_amount_try,
          CASE gpp.status
              WHEN 'paid'      THEN 'Gerçekleşti'
              WHEN 'partial'   THEN 'Kısmi Ödendi'
              WHEN 'cancelled' THEN 'İptal'
              ELSE 'Planlanan'
          END                                                             AS status,
          CASE
              WHEN gpp.status NOT IN ('paid', 'cancelled')
                   AND gpp.due_date IS NOT NULL
                   AND gpp.due_date < CURDATE()
              THEN 1 ELSE 0
          END                                                             AS is_overdue,
          gpp.stage,
          gpp.stage_percentage,
          gpp.due_date,
          gpp.paid_date,
          gpp.created_at,
          gpp.updated_at
        FROM ak_government_progress_payments gpp
        LEFT JOIN ak_customers c ON c.id = gpp.customer_id
        LEFT JOIN ak_projects  p ON p.id = gpp.project_id
        {$whereClause}
        ORDER BY entry_date DESC, gpp.created_at DESC
        LIMIT 1000
    ";

    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return array_map(static function (array $row): array {
        $row['is_overdue']           = (int)   $row['is_overdue'];
        $row['amount_try']           = (float) $row['amount_try'];
        $row['paid_amount_try']      = (float) $row['paid_amount_try'];
        $row['remaining_amount_try'] = (float) ($row['remaining_amount_try'] ?? 0.0);
        return $row;
    }, $stmt->fetchAll() ?: []);
}

function gelenler_summary(array $entries): array
{
    $planned    = 0.0;
    $paid       = 0.0;
    $remaining  = 0.0;
    $overpaid   = 0.0;
    $overdue    = 0;
    foreach ($entries as $row) {
        $rowPlanned = (float) $row['amount_try'];
        $rowPaid    = (float) $row['paid_amount_try'];
        $planned   += $rowPlanned;
        $paid      += $rowPaid;
        // Aggregate outstanding receivable is summed PER ROW, clamped at 0 — never
        // SUM(planned) - SUM(paid) globally. That aggregate-then-subtract form lets one
        // customer's overpayment silently cancel out another customer's real open debt in the
        // consolidated total (QA-B/C BUG-08). The overpaid portion is tracked separately so it
        // stays visible instead of just vanishing from every total.
        $remaining += max(0.0, $rowPlanned - $rowPaid);
        $overpaid  += max(0.0, $rowPaid - $rowPlanned);
        if (!empty($row['is_overdue'])) $overdue++;
    }
    return [
        'total_planned'   => round($planned, 2),
        'total_paid'      => round($paid, 2),
        'total_remaining' => round($remaining, 2),
        'total_overpaid'  => round($overpaid, 2),
        'overdue_count'   => $overdue,
        'row_count'       => count($entries),
    ];
}
