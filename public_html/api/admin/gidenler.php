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
    // db() connects with PDO::ATTR_EMULATE_PREPARES = false (see db.php), so MySQL's native
    // prepared-statement protocol is used — it does NOT support the same named placeholder
    // appearing more than once across a query (binding it once throws
    // "SQLSTATE[HY093]: Invalid parameter number"), nor does it tolerate a bound placeholder
    // that doesn't appear in the final SQL text (same exception). Reusing one shared
    // :project_id/:currency/etc. token across all three UNION ALL branches — as this function
    // previously did — therefore made every filtered Gidenler query (project, currency,
    // account_type, status, date range) throw as soon as more than one source table was
    // included, surfacing to the admin as an empty "Kayıt bulunamadı" result instead of the
    // matching rows. Each sub-query below gets its own uniquely-suffixed placeholders, and only
    // the params for sub-queries actually selected by $sourceType are bound.
    $buildWhere = function (string $suffix) use ($currency, $accountType, $status, $dateFrom, $dateTo, $projectId): array {
        $where  = [];
        $params = [];
        if ($currency !== '')    { $where[] = "t.currency = :currency{$suffix}";         $params["currency{$suffix}"]     = $currency; }
        if ($accountType !== '') { $where[] = "t.account_type = :account_type{$suffix}"; $params["account_type{$suffix}"] = $accountType; }
        if ($status !== '')      { $where[] = "t.status = :status{$suffix}";             $params["status{$suffix}"]       = $status; }
        if ($dateFrom !== '')    { $where[] = "t.entry_date >= :date_from{$suffix}";      $params["date_from{$suffix}"]    = $dateFrom; }
        if ($dateTo !== '')      { $where[] = "t.entry_date <= :date_to{$suffix}";        $params["date_to{$suffix}"]      = $dateTo; }
        if ($projectId !== '')   { $where[] = "t.project_id = :project_id{$suffix}";      $params["project_id{$suffix}"]   = $projectId; }
        return ['sql' => $where ? 'AND ' . implode(' AND ', $where) : '', 'params' => $params];
    };

    $sources = [
        'employee' => function () use ($buildWhere): array {
            $w = $buildWhere('_emp');
            return ['sql' => "
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
                WHERE 1=1 {$w['sql']}
            ", 'params' => $w['params']];
        },
        'supplier' => function () use ($buildWhere): array {
            $w = $buildWhere('_sup');
            return ['sql' => "
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
                WHERE 1=1 {$w['sql']}
            ", 'params' => $w['params']];
        },
        'expense_card' => function () use ($buildWhere): array {
            $w = $buildWhere('_exp');
            return ['sql' => "
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
                WHERE 1=1 {$w['sql']}
            ", 'params' => $w['params']];
        },
    ];

    $includedSql    = [];
    $includedParams = [];
    foreach ($sources as $type => $build) {
        if ($sourceType !== '' && $sourceType !== $type) continue;
        $built = $build();
        $includedSql[]    = $built['sql'];
        $includedParams   = array_merge($includedParams, $built['params']);
    }

    if (empty($includedSql)) {
        return [];
    }

    $unionSql = implode(' UNION ALL ', $includedSql);
    $finalSql = "SELECT * FROM ({$unionSql}) AS combined ORDER BY entry_date DESC, created_at DESC LIMIT 1000";

    $stmt = db()->prepare($finalSql);
    foreach ($includedParams as $key => $value) {
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
    $planned   = 0.0;
    $paid      = 0.0;
    $remaining = 0.0;
    $overpaid  = 0.0;
    $byType    = ['employee' => 0.0, 'supplier' => 0.0, 'expense_card' => 0.0];
    $overdue   = 0;
    foreach ($entries as $row) {
        $rowPlanned = (float) $row['amount_try'];
        $rowPaid    = (float) $row['paid_amount_try'];
        $planned   += $rowPlanned;
        $paid      += $rowPaid;
        // Same per-row clamped rule as gelenler_summary() — SUM(planned) - SUM(paid) would let
        // one overpaid record cancel out another's real outstanding payable in the consolidated
        // total (QA-B/C BUG-08's rule applied consistently to the payable side too).
        $remaining += max(0.0, $rowPlanned - $rowPaid);
        $overpaid  += max(0.0, $rowPaid - $rowPlanned);
        $t = (string) ($row['source_type'] ?? '');
        if (isset($byType[$t])) $byType[$t] += $rowPaid;
        if ($row['is_overdue']) $overdue++;
    }
    return [
        'total_planned'          => round($planned, 2),
        'total_paid'             => round($paid, 2),
        'total_remaining'        => round($remaining, 2),
        'total_overpaid'         => round($overpaid, 2),
        'by_source_type_paid'    => array_map(fn($v) => round($v, 2), $byType),
        'overdue_count'          => $overdue,
        'row_count'              => count($entries),
    ];
}
