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
    $project = db()->prepare('SELECT id, title, contract_total_try FROM ak_projects WHERE id = :id LIMIT 1');
    $project->execute(['id' => $projectId]);
    $projectRow = $project->fetch();
    if (!$projectRow) json_error('Proje bulunamadı.', 404);
    $projectRow['contract_total_try'] = $projectRow['contract_total_try'] !== null
        ? (float) $projectRow['contract_total_try']
        : null;

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

function ps_table_exists(string $table): bool
{
    $stmt = db()->prepare(
        'SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :t LIMIT 1'
    );
    $stmt->execute(['t' => $table]);
    return (bool) $stmt->fetchColumn();
}

function fetch_project_statement_rows(string $projectId): array
{
    $gppExists = ps_table_exists('ak_government_progress_payments');

    $gppBlock = $gppExists ? "
        UNION ALL

        SELECT
          gpp.id,
          'government'                                          AS source_type,
          'Devlet Hakedişi'                                     AS source_label,
          gpp.customer_id                                       AS owner_id,
          COALESCE(c_gpp.company_name, c_gpp.full_name, 'Devlet') AS owner_name,
          gpp.project_id,
          p_gpp.title                                           AS project_name,
          COALESCE(gpp.due_date, DATE(gpp.created_at))         AS entry_date,
          gpp.title,
          gpp.notes,
          'income'                                              AS direction,
          1                                                     AS sign,
          gpp.planned_amount_try                               AS amount,
          gpp.paid_amount_try                                  AS paid_amount,
          'TRY'                                                 AS currency,
          1.0                                                   AS exchange_rate_to_try,
          NULL                                                  AS exchange_rate_source,
          NULL                                                  AS exchange_rate_snapshot_at,
          0                                                     AS is_exchange_rate_manual,
          gpp.planned_amount_try                               AS amount_try,
          gpp.paid_amount_try                                  AS paid_amount_try,
          NULL                                                  AS account_type,
          NULL                                                  AS payment_method,
          CASE gpp.status
              WHEN 'paid'      THEN 'Gerçekleşti'
              WHEN 'partial'   THEN 'Kısmi Ödendi'
              WHEN 'cancelled' THEN 'İptal'
              ELSE 'Planlanan'
          END                                                   AS status,
          CASE
              WHEN gpp.status NOT IN ('paid', 'cancelled')
                   AND gpp.due_date IS NOT NULL
                   AND gpp.due_date < CURDATE()
              THEN 1 ELSE 0
          END                                                   AS is_overdue,
          gpp.created_at,
          gpp.updated_at
        FROM ak_government_progress_payments gpp
        LEFT JOIN ak_customers c_gpp ON c_gpp.id = gpp.customer_id
        LEFT JOIN ak_projects  p_gpp ON p_gpp.id = gpp.project_id
        WHERE gpp.project_id = :pid5" : '';

    $params = [
        'pid'  => $projectId,
        'pid2' => $projectId,
        'pid3' => $projectId,
        'pid4' => $projectId,
    ];
    if ($gppExists) {
        $params['pid5'] = $projectId;
    }

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
          AND cfe.title NOT LIKE '%Hakediş%'

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

        {$gppBlock}

        ORDER BY entry_date DESC, created_at DESC
    ";

    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll() ?: [];

    $psIndexType = preferred_inflation_index_type();

    return array_map(function (array $row) use ($psIndexType): array {
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

        // Add inflation adjustment for planned customer receivable rows only
        $inflationFields = inflation_null_fields();
        $plannedStatuses = ['Planlanan', 'Gecikmiş', 'Kısmi Ödendi'];
        if ($row['source_type'] === 'customer'
            && $row['direction'] === 'income'
            && in_array($row['status'], $plannedStatuses, true)
            && $amountTry > 0
            && !empty($row['created_at'])
            && !empty($row['entry_date'])
        ) {
            $adj = calculate_inflation_adjustment($amountTry, (string) $row['created_at'], (string) $row['entry_date'], $psIndexType);
            // Fall back to TUFE if preferred type lacks data for these periods
            if ($adj === null && $psIndexType !== 'TUFE') {
                $adj = calculate_inflation_adjustment($amountTry, (string) $row['created_at'], (string) $row['entry_date'], 'TUFE');
            }
            if ($adj !== null) {
                $inflationFields = $adj;
            }
        }
        $row = array_merge($row, $inflationFields);

        return $row;
    }, $rows);
}

function compute_statement_summary(array $rows): array
{
    $totalIncomePlanned              = 0.0;
    $totalIncomePaid                 = 0.0;
    $totalExpensePlanned             = 0.0;
    $totalExpensePaid                = 0.0;
    $customerIncomePlanned           = 0.0;
    $customerIncomePaid              = 0.0;
    $governmentIncomePlanned         = 0.0;
    $governmentIncomePaid            = 0.0;
    $customerIncomeInflationAdjusted = 0.0;
    $hasInflationData                = false;

    foreach ($rows as $row) {
        if ($row['direction'] === 'income') {
            $planned = (float) $row['amount_try'];
            $paid    = (float) $row['paid_amount_try'];
            $totalIncomePlanned += $planned;
            $totalIncomePaid    += $paid;
            if ($row['source_type'] === 'government') {
                $governmentIncomePlanned += $planned;
                $governmentIncomePaid    += $paid;
            } else {
                $customerIncomePlanned += $planned;
                $customerIncomePaid    += $paid;
                if ($row['source_type'] === 'customer') {
                    $adj = $row['inflation_adjusted_amount_try'] ?? null;
                    if ($adj !== null) {
                        $customerIncomeInflationAdjusted += (float) $adj;
                        $hasInflationData = true;
                    } else {
                        // Paid entries contribute their paid amount to the inflation-adjusted total
                        $customerIncomeInflationAdjusted += $paid;
                    }
                }
            }
        } else {
            $totalExpensePlanned += (float) $row['amount_try'];
            $totalExpensePaid    += (float) $row['paid_amount_try'];
        }
    }

    return [
        'total_income_planned'                   => round($totalIncomePlanned, 2),
        'total_income_paid'                      => round($totalIncomePaid, 2),
        'total_income_remaining'                 => round($totalIncomePlanned - $totalIncomePaid, 2),
        'customer_income_planned'                => round($customerIncomePlanned, 2),
        'customer_income_paid'                   => round($customerIncomePaid, 2),
        'government_income_planned'              => round($governmentIncomePlanned, 2),
        'government_income_paid'                 => round($governmentIncomePaid, 2),
        'customer_income_inflation_adjusted'     => $hasInflationData ? round($customerIncomeInflationAdjusted, 2) : null,
        'total_expense_planned'                  => round($totalExpensePlanned, 2),
        'total_expense_paid'                     => round($totalExpensePaid, 2),
        'total_expense_remaining'                => round($totalExpensePlanned - $totalExpensePaid, 2),
        'realized_profit'                        => round($totalIncomePaid - $totalExpensePaid, 2),
        'planned_profit'                         => round($totalIncomePlanned - $totalExpensePlanned, 2),
        'row_count'                              => count($rows),
    ];
}
