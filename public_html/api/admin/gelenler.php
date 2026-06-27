<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/finance-entry-helpers.php';

require_admin();
require_method('GET');

// Gelenler — global incoming view: customer financial entries only

try {
    $projectId   = trim((string) ($_GET['project_id']   ?? ''));
    $customerId  = trim((string) ($_GET['customer_id']  ?? ''));
    $currency    = trim((string) ($_GET['currency']     ?? ''));
    $accountType = trim((string) ($_GET['account_type'] ?? ''));
    $status      = trim((string) ($_GET['status']       ?? ''));
    $dateFrom    = trim((string) ($_GET['date_from']    ?? ''));
    $dateTo      = trim((string) ($_GET['date_to']      ?? ''));
    $q           = trim((string) ($_GET['q']            ?? ''));

    $where  = [];
    $params = [];

    if ($projectId !== '')   { $where[] = 'cfe.project_id = :project_id';     $params['project_id']   = $projectId; }
    if ($customerId !== '')  { $where[] = 'cfe.customer_id = :customer_id';   $params['customer_id']  = $customerId; }
    if ($currency !== '')    { $where[] = 'cfe.currency = :currency';          $params['currency']     = $currency; }
    if ($accountType !== '') { $where[] = 'cfe.account_type = :account_type'; $params['account_type'] = $accountType; }
    if ($status !== '')      { $where[] = 'cfe.status = :status';              $params['status']       = $status; }
    if ($dateFrom !== '')    { $where[] = 'cfe.entry_date >= :date_from';      $params['date_from']    = $dateFrom; }
    if ($dateTo !== '')      { $where[] = 'cfe.entry_date <= :date_to';        $params['date_to']      = $dateTo; }
    if ($q !== '') {
        $where[] = '(cfe.title LIKE :q OR COALESCE(c.company_name, c.full_name) LIKE :q2)';
        $like = '%' . $q . '%';
        $params['q']  = $like;
        $params['q2'] = $like;
    }

    $whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    $entries = fe_fetch_all("
        SELECT
          cfe.*,
          COALESCE(c.company_name, c.full_name) AS owner_name,
          p.title AS project_title,
          'customer' AS source_type,
          'Müşteri'  AS source_label
        FROM ak_customer_financial_entries cfe
        LEFT JOIN ak_customers c ON c.id = cfe.customer_id
        LEFT JOIN ak_projects  p ON p.id = cfe.project_id
        {$whereClause}
        ORDER BY cfe.entry_date DESC, cfe.created_at DESC
        LIMIT 1000
    ", $params);

    $summary = gelenler_summary($entries);

    $projects  = db()->query('SELECT id, title FROM ak_projects ORDER BY title ASC')->fetchAll() ?: [];
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

function gelenler_summary(array $entries): array
{
    $planned  = 0.0;
    $paid     = 0.0;
    $overdue  = 0;
    foreach ($entries as $row) {
        $planned += (float) $row['amount_try'];
        $paid    += (float) $row['paid_amount_try'];
        if ($row['is_overdue']) $overdue++;
    }
    return [
        'total_planned'   => round($planned, 2),
        'total_paid'      => round($paid, 2),
        'total_remaining' => round($planned - $paid, 2),
        'overdue_count'   => $overdue,
        'row_count'       => count($entries),
    ];
}
