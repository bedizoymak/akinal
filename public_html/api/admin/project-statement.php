<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/finance-entry-helpers.php';

require_admin();
require_method('GET');

$projectId = trim((string) ($_GET['project_id'] ?? ''));
if ($projectId === '') {
    json_error('project_id parametresi zorunludur.', 400);
}

try {
    // Verify project exists
    $project = db()->prepare('SELECT id, title FROM ak_projects WHERE id = :id LIMIT 1');
    $project->execute(['id' => $projectId]);
    $projectRow = $project->fetch();
    if (!$projectRow) json_error('Proje bulunamadı.', 404);

    $rows = fetch_project_statement_rows($projectId);
    $summary = compute_statement_summary($rows);

    json_success([
        'project'  => $projectRow,
        'rows'     => $rows,
        'summary'  => $summary,
    ]);
} catch (Throwable $e) {
    json_error('Proje ekstresi yüklenemedi.', 500);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fetch_project_statement_rows(string $projectId): array
{
    $sql = "
        SELECT
          cfe.id,
          'customer'                              AS source_type,
          'Müşteri'                               AS source_label,
          cfe.customer_id                         AS owner_id,
          COALESCE(c.company_name, c.full_name)   AS owner_name,
          cfe.project_id,
          p.title                                 AS project_name,
          cfe.entry_date,
          cfe.title,
          cfe.notes,
          'income'                                AS direction,
          1                                       AS sign,
          cfe.amount,
          cfe.paid_amount,
          cfe.currency,
          cfe.exchange_rate_to_try,
          cfe.exchange_rate_source,
          cfe.exchange_rate_snapshot_at,
          cfe.is_exchange_rate_manual,
          cfe.amount_try,
          cfe.paid_amount_try,
          cfe.account_type,
          cfe.payment_method,
          cfe.status,
          cfe.is_overdue,
          cfe.created_at,
          cfe.updated_at
        FROM ak_customer_financial_entries cfe
        LEFT JOIN ak_customers c ON c.id = cfe.customer_id
        LEFT JOIN ak_projects  p ON p.id = cfe.project_id
        WHERE cfe.project_id = :pid

        UNION ALL

        SELECT
          efe.id,
          'employee'                              AS source_type,
          'Personel'                              AS source_label,
          efe.employee_id                         AS owner_id,
          e.full_name                             AS owner_name,
          efe.project_id,
          p.title                                 AS project_name,
          efe.entry_date,
          efe.title,
          efe.notes,
          'expense'                               AS direction,
          -1                                      AS sign,
          efe.amount,
          efe.paid_amount,
          efe.currency,
          efe.exchange_rate_to_try,
          efe.exchange_rate_source,
          efe.exchange_rate_snapshot_at,
          efe.is_exchange_rate_manual,
          efe.amount_try,
          efe.paid_amount_try,
          efe.account_type,
          efe.payment_method,
          efe.status,
          efe.is_overdue,
          efe.created_at,
          efe.updated_at
        FROM ak_employee_financial_entries efe
        LEFT JOIN ak_employees e ON e.id = efe.employee_id
        LEFT JOIN ak_projects  p ON p.id = efe.project_id
        WHERE efe.project_id = :pid2

        UNION ALL

        SELECT
          sfe.id,
          'supplier'                              AS source_type,
          'Tedarikçi'                             AS source_label,
          sfe.supplier_id                         AS owner_id,
          s.name                                  AS owner_name,
          sfe.project_id,
          p.title                                 AS project_name,
          sfe.entry_date,
          sfe.title,
          sfe.notes,
          'expense'                               AS direction,
          -1                                      AS sign,
          sfe.amount,
          sfe.paid_amount,
          sfe.currency,
          sfe.exchange_rate_to_try,
          sfe.exchange_rate_source,
          sfe.exchange_rate_snapshot_at,
          sfe.is_exchange_rate_manual,
          sfe.amount_try,
          sfe.paid_amount_try,
          sfe.account_type,
          sfe.payment_method,
          sfe.status,
          sfe.is_overdue,
          sfe.created_at,
          sfe.updated_at
        FROM ak_supplier_financial_entries sfe
        LEFT JOIN ak_suppliers s ON s.id = sfe.supplier_id
        LEFT JOIN ak_projects  p ON p.id = sfe.project_id
        WHERE sfe.project_id = :pid3

        UNION ALL

        SELECT
          ecfe.id,
          'expense_card'                          AS source_type,
          'Masraf Kartı'                          AS source_label,
          ecfe.expense_card_id                    AS owner_id,
          ec.name                                 AS owner_name,
          ecfe.project_id,
          p.title                                 AS project_name,
          ecfe.entry_date,
          ecfe.title,
          ecfe.notes,
          'expense'                               AS direction,
          -1                                      AS sign,
          ecfe.amount,
          ecfe.paid_amount,
          ecfe.currency,
          ecfe.exchange_rate_to_try,
          ecfe.exchange_rate_source,
          ecfe.exchange_rate_snapshot_at,
          ecfe.is_exchange_rate_manual,
          ecfe.amount_try,
          ecfe.paid_amount_try,
          ecfe.account_type,
          ecfe.payment_method,
          ecfe.status,
          ecfe.is_overdue,
          ecfe.created_at,
          ecfe.updated_at
        FROM ak_expense_card_financial_entries ecfe
        LEFT JOIN ak_expense_cards ec ON ec.id = ecfe.expense_card_id
        LEFT JOIN ak_projects      p  ON p.id  = ecfe.project_id
        WHERE ecfe.project_id = :pid4

        ORDER BY entry_date DESC, created_at DESC
    ";

    $stmt = db()->prepare($sql);
    $stmt->execute([
        'pid'  => $projectId,
        'pid2' => $projectId,
        'pid3' => $projectId,
        'pid4' => $projectId,
    ]);
    $rows = $stmt->fetchAll() ?: [];

    return array_map(function (array $row): array {
        $amount    = (float) $row['amount'];
        $paid      = (float) $row['paid_amount'];
        $amountTry = (float) $row['amount_try'];
        $paidTry   = (float) $row['paid_amount_try'];
        $sign      = (int) $row['sign'];

        $row['amount']              = $amount;
        $row['paid_amount']         = $paid;
        $row['remaining_amount']    = max(0.0, $amount - $paid);
        $row['amount_try']          = $amountTry;
        $row['paid_amount_try']     = $paidTry;
        $row['remaining_amount_try'] = max(0.0, $amountTry - $paidTry);
        $row['signed_amount_try']      = $sign * $amountTry;
        $row['signed_paid_amount_try'] = $sign * $paidTry;
        $row['exchange_rate_to_try']   = (float) $row['exchange_rate_to_try'];
        $row['is_exchange_rate_manual'] = (int)  $row['is_exchange_rate_manual'];
        $row['is_overdue']             = (int)   $row['is_overdue'];
        $row['sign']                   = $sign;

        return $row;
    }, $rows);
}

function compute_statement_summary(array $rows): array
{
    $totalIncomePlanned  = 0.0;
    $totalIncomePaid     = 0.0;
    $totalExpensePlanned = 0.0;
    $totalExpensePaid    = 0.0;

    foreach ($rows as $row) {
        if ($row['direction'] === 'income') {
            $totalIncomePlanned  += (float) $row['amount_try'];
            $totalIncomePaid     += (float) $row['paid_amount_try'];
        } else {
            $totalExpensePlanned += (float) $row['amount_try'];
            $totalExpensePaid    += (float) $row['paid_amount_try'];
        }
    }

    return [
        'total_income_planned'   => round($totalIncomePlanned, 2),
        'total_income_paid'      => round($totalIncomePaid, 2),
        'total_income_remaining' => round($totalIncomePlanned - $totalIncomePaid, 2),
        'total_expense_planned'  => round($totalExpensePlanned, 2),
        'total_expense_paid'     => round($totalExpensePaid, 2),
        'total_expense_remaining'=> round($totalExpensePlanned - $totalExpensePaid, 2),
        'realized_profit'        => round($totalIncomePaid - $totalExpensePaid, 2),
        'planned_profit'         => round($totalIncomePlanned - $totalExpensePlanned, 2),
        'row_count'              => count($rows),
    ];
}
