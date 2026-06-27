<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/finance-entry-helpers.php';

require_admin();
require_method('GET');

// Gidenler — global outgoing view: employee + supplier + expense-card entries

try {
    $projectId   = trim((string) ($_GET['project_id']   ?? ''));
    $sourceType  = trim((string) ($_GET['source_type']  ?? ''));
    $currency    = trim((string) ($_GET['currency']     ?? ''));
    $accountType = trim((string) ($_GET['account_type'] ?? ''));
    $status      = trim((string) ($_GET['status']       ?? ''));
    $dateFrom    = trim((string) ($_GET['date_from']    ?? ''));
    $dateTo      = trim((string) ($_GET['date_to']      ?? ''));
    $q           = trim((string) ($_GET['q']            ?? ''));

    $rows = fetch_gidenler_rows($projectId, $sourceType, $currency, $accountType, $status, $dateFrom, $dateTo, $q);
    $summary = gidenler_summary($rows);

    $projects = db()->query('SELECT id, title FROM ak_projects ORDER BY title ASC')->fetchAll() ?: [];

    json_success([
        'entries'  => $rows,
        'summary'  => $summary,
        'projects' => $projects,
    ]);
} catch (Throwable $e) {
    json_error('Gidenler listesi yüklenemedi.', 500);
}

function fetch_gidenler_rows(
    string $projectId,
    string $sourceType,
    string $currency,
    string $accountType,
    string $status,
    string $dateFrom,
    string $dateTo,
    string $q
): array {
    // Build per-table WHERE conditions
    $sharedWhere = [];
    $sharedParams = [];

    if ($currency !== '')    { $sharedWhere[] = 't.currency = :currency';          $sharedParams['currency']     = $currency; }
    if ($accountType !== '') { $sharedWhere[] = 't.account_type = :account_type'; $sharedParams['account_type'] = $accountType; }
    if ($status !== '')      { $sharedWhere[] = 't.status = :status';              $sharedParams['status']       = $status; }
    if ($dateFrom !== '')    { $sharedWhere[] = 't.entry_date >= :date_from';      $sharedParams['date_from']    = $dateFrom; }
    if ($dateTo !== '')      { $sharedWhere[] = 't.entry_date <= :date_to';        $sharedParams['date_to']      = $dateTo; }
    if ($projectId !== '')   { $sharedWhere[] = 't.project_id = :project_id';      $sharedParams['project_id']   = $projectId; }

    $sharedWhereSql = $sharedWhere ? 'AND ' . implode(' AND ', $sharedWhere) : '';

    // Employee sub-query
    $employeeSql = "
        SELECT
          t.id, t.employee_id AS owner_id, e.full_name AS owner_name,
          t.project_id, p.title AS project_title,
          t.entry_date, t.title, t.notes,
          'employee' AS source_type, 'Personel' AS source_label,
          t.amount, t.paid_amount, t.currency,
          t.exchange_rate_to_try, t.exchange_rate_source,
          t.exchange_rate_snapshot_at, t.is_exchange_rate_manual,
          t.amount_try, t.paid_amount_try,
          t.account_type, t.payment_method, t.status, t.is_overdue,
          t.created_at, t.updated_at
        FROM ak_employee_financial_entries t
        LEFT JOIN ak_employees e ON e.id = t.employee_id
        LEFT JOIN ak_projects  p ON p.id = t.project_id
        WHERE 1=1 {$sharedWhereSql}
    ";

    // Supplier sub-query
    $supplierSql = "
        SELECT
          t.id, t.supplier_id AS owner_id, s.name AS owner_name,
          t.project_id, p.title AS project_title,
          t.entry_date, t.title, t.notes,
          'supplier' AS source_type, 'Tedarikçi' AS source_label,
          t.amount, t.paid_amount, t.currency,
          t.exchange_rate_to_try, t.exchange_rate_source,
          t.exchange_rate_snapshot_at, t.is_exchange_rate_manual,
          t.amount_try, t.paid_amount_try,
          t.account_type, t.payment_method, t.status, t.is_overdue,
          t.created_at, t.updated_at
        FROM ak_supplier_financial_entries t
        LEFT JOIN ak_suppliers s ON s.id = t.supplier_id
        LEFT JOIN ak_projects  p ON p.id = t.project_id
        WHERE 1=1 {$sharedWhereSql}
    ";

    // Expense card sub-query
    $expenseSql = "
        SELECT
          t.id, t.expense_card_id AS owner_id, ec.name AS owner_name,
          t.project_id, p.title AS project_title,
          t.entry_date, t.title, t.notes,
          'expense_card' AS source_type, 'Masraf Kartı' AS source_label,
          t.amount, t.paid_amount, t.currency,
          t.exchange_rate_to_try, t.exchange_rate_source,
          t.exchange_rate_snapshot_at, t.is_exchange_rate_manual,
          t.amount_try, t.paid_amount_try,
          t.account_type, t.payment_method, t.status, t.is_overdue,
          t.created_at, t.updated_at
        FROM ak_expense_card_financial_entries t
        LEFT JOIN ak_expense_cards ec ON ec.id = t.expense_card_id
        LEFT JOIN ak_projects       p ON p.id  = t.project_id
        WHERE 1=1 {$sharedWhereSql}
    ";

    $includedSources = [];
    if ($sourceType === '' || $sourceType === 'employee')     $includedSources[] = $employeeSql;
    if ($sourceType === '' || $sourceType === 'supplier')     $includedSources[] = $supplierSql;
    if ($sourceType === '' || $sourceType === 'expense_card') $includedSources[] = $expenseSql;

    if (empty($includedSources)) {
        return [];
    }

    $unionSql = implode(' UNION ALL ', $includedSources);
    $finalSql = "SELECT * FROM ({$unionSql}) AS combined ORDER BY entry_date DESC, created_at DESC LIMIT 1000";

    $stmt = db()->prepare($finalSql);
    // Bind shared params for each sub-query section
    $repeatCount = count($includedSources);
    foreach ($sharedParams as $key => $value) {
        // PDO named params can only appear once, so we need different approach
        // Re-using named params across UNION ALL is not possible. Use positional or suffix.
        // We'll just bind once — PDO emulated prepares handle repeated named params
        $stmt->bindValue(":{$key}", $value);
    }
    $stmt->execute();
    $rows = $stmt->fetchAll() ?: [];

    // Apply search filter in PHP (avoids complex repeated LIKE params in UNION)
    if ($q !== '') {
        $lower = mb_strtolower($q);
        $rows = array_filter($rows, fn($r) =>
            str_contains(mb_strtolower((string)($r['title'] ?? '')), $lower) ||
            str_contains(mb_strtolower((string)($r['owner_name'] ?? '')), $lower)
        );
        $rows = array_values($rows);
    }

    return array_map(function (array $row): array {
        $amount    = (float) $row['amount'];
        $paid      = (float) $row['paid_amount'];
        $amountTry = (float) $row['amount_try'];
        $paidTry   = (float) $row['paid_amount_try'];
        $row['remaining_amount']     = max(0.0, $amount - $paid);
        $row['remaining_amount_try'] = max(0.0, $amountTry - $paidTry);
        $row['amount']              = $amount;
        $row['paid_amount']         = $paid;
        $row['amount_try']          = $amountTry;
        $row['paid_amount_try']     = $paidTry;
        $row['exchange_rate_to_try']   = (float) $row['exchange_rate_to_try'];
        $row['is_exchange_rate_manual'] = (int) $row['is_exchange_rate_manual'];
        $row['is_overdue']             = (int) $row['is_overdue'];
        return $row;
    }, $rows);
}

function gidenler_summary(array $entries): array
{
    $planned = 0.0;
    $paid    = 0.0;
    $byType  = ['employee' => 0.0, 'supplier' => 0.0, 'expense_card' => 0.0];
    $overdue = 0;
    foreach ($entries as $row) {
        $planned += (float) $row['amount_try'];
        $paid    += (float) $row['paid_amount_try'];
        $t = (string) ($row['source_type'] ?? '');
        if (isset($byType[$t])) $byType[$t] += (float) $row['paid_amount_try'];
        if ($row['is_overdue']) $overdue++;
    }
    return [
        'total_planned'          => round($planned, 2),
        'total_paid'             => round($paid, 2),
        'total_remaining'        => round($planned - $paid, 2),
        'by_source_type_paid'    => array_map(fn($v) => round($v, 2), $byType),
        'overdue_count'          => $overdue,
        'row_count'              => count($entries),
    ];
}
