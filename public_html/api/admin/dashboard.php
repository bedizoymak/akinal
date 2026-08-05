<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

require_admin();
require_method('GET');

// Dashboard — rewritten to use only new card-based financial entry tables.
// Legacy tables (ak_payments, ak_expenses, ak_financial_entries, ak_payment_plans)
// are no longer read here.

try {
    $pdo = db();

    $projectStats = dash_one("
        SELECT
          COUNT(*) AS total_projects,
          COALESCE(SUM(CASE WHEN project_status <> 'Tamamlandı' THEN 1 ELSE 0 END), 0) AS active_projects,
          COALESCE(SUM(CASE WHEN is_published = 1 THEN 1 ELSE 0 END), 0) AS published_projects,
          COALESCE(SUM(CASE WHEN is_published = 0 THEN 1 ELSE 0 END), 0) AS draft_projects
        FROM ak_projects
    ");
    $contactStats = dash_one("
        SELECT
          COUNT(*) AS total_contact_requests,
          COALESCE(SUM(CASE WHEN status = 'Yeni' THEN 1 ELSE 0 END), 0) AS new_contact_requests
        FROM ak_contact_requests
    ");
    $notificationStats = dash_one("SELECT COUNT(*) AS unread_notifications FROM ak_notifications WHERE is_read = 0");
    $customerStats     = dash_one('SELECT COUNT(*) AS total_customers FROM ak_customers');

    $finSummary    = compute_finance_summary($pdo);
    $overduePlans  = fetch_customer_entries_overdue($pdo);
    $upcomingPlans = fetch_customer_entries_upcoming($pdo);

    $activeProjects = $pdo->query("
        SELECT id, title, project_status, location, is_published, slug, sort_order
        FROM ak_projects
        WHERE project_status <> 'Tamamlandı'
        ORDER BY sort_order ASC, created_at DESC
        LIMIT 6
    ")->fetchAll() ?: [];

    $recentMovements   = fetch_recent_movements($pdo);
    $monthlyFinancials = fetch_monthly_financials($pdo);

    $allCards  = build_all_cards($pdo);
    $topCards  = slice_cards($allCards, 6);

    $commandCenter = build_cashflow_command_center($allCards, $finSummary);
    $actionCenter  = build_cashflow_action_center($allCards, $overduePlans);

    json_success([
        'summary' => [
            'total_projects'         => (int) ($projectStats['total_projects'] ?? 0),
            'active_projects'        => (int) ($projectStats['active_projects'] ?? 0),
            'published_projects'     => (int) ($projectStats['published_projects'] ?? 0),
            'draft_projects'         => (int) ($projectStats['draft_projects'] ?? 0),
            'total_contact_requests' => (int) ($contactStats['total_contact_requests'] ?? 0),
            'new_contact_requests'   => (int) ($contactStats['new_contact_requests'] ?? 0),
            'unread_notifications'   => (int) ($notificationStats['unread_notifications'] ?? 0),
            'total_customers'        => (int) ($customerStats['total_customers'] ?? 0),
            'total_payments'         => $finSummary['total_income_paid'],
            'total_expenses'         => $finSummary['total_expense_paid'],
            'basic_net_balance'      => $finSummary['realized_profit'],
            'planned_income'         => $finSummary['total_income_planned'],
            'month_income'           => $finSummary['month_income_paid'],
            'month_expenses'         => $finSummary['month_expense_paid'],
            'month_net'              => round($finSummary['month_income_paid'] - $finSummary['month_expense_paid'], 2),
            'overdue_collections'    => $finSummary['overdue_receivable'],
            'expected_payments'      => $finSummary['upcoming_receivable'],
            'overdue_plan_count'     => $finSummary['overdue_count'],
            'upcoming_plan_count'    => $finSummary['upcoming_count'],
            'financial_entry_count'  => $finSummary['total_entry_count'],
            'planned_profit'         => $finSummary['planned_profit'],
            'realized_profit'        => $finSummary['realized_profit'],
        ],
        'active_projects_list'          => $activeProjects,
        'overdue_plans'                 => array_slice($overduePlans, 0, 8),
        'upcoming_plans'                => array_slice($upcomingPlans, 0, 8),
        'recent_movements'              => $recentMovements,
        'monthly_financials'            => $monthlyFinancials,
        'unified_financial_cards'       => $topCards,
        'cashflow_command_center'       => $commandCenter,
        'net_cash_forecast'             => build_net_cash_forecast($finSummary),
        'cashflow_action_center'        => $actionCenter,
        'management_decision_dashboard' => build_management_decision_dashboard($allCards, $finSummary, $commandCenter, $actionCenter),
        'financial_drilldowns'          => build_financial_drilldowns($pdo),
        'expense_category_intelligence' => build_expense_category_intelligence($pdo),
    ]);
} catch (Throwable $e) {
    json_error('Dashboard verileri alınamadı.', 500);
}

function dash_one(string $sql): array
{
    $row = db()->query($sql)->fetch();
    return is_array($row) ? $row : [];
}

function dash_float(mixed $v): float
{
    return round((float) $v, 2);
}

function compute_finance_summary(PDO $pdo): array
{
    $thisMonth = (new DateTimeImmutable('first day of this month'))->format('Y-m-01');

    // "upcoming" = every currently OPEN customer receivable (any unpaid/partially-paid balance,
    // planned or overdue alike) — feeds the dashboard's "Beklenen Tahsilat" card. Summed as the
    // outstanding balance (amount_try - paid_amount_try), not the full planned amount, so
    // partially-paid rows aren't double-counted. Customer entries only (no GPP). Status here is
    // the same canonical fe_auto_status() value stored on each row (see finance-entry-helpers.php):
    // 'Gerçekleşti'/'Fazla Ödendi' (fully settled) are excluded — everything else has an open balance.
    // Temporary migration safety filter: exclude Hakediş entries until cleanup migration is confirmed.
    // These rows have already been copied into ak_government_progress_payments (summed separately
    // below as $gppRow) but the source rows are not deleted until the cleanup migration runs — see
    // migrations/government-progress-payments-cleanup.php. Without this filter, every migrated
    // Hakediş row is counted twice (once here, once via $gppRow), inflating "Genel Bakış" income and
    // net totals versus Gelenler/Net Durum, which already apply this same exclusion (gelenler.php).
    $custStmt = $pdo->prepare("
        SELECT
          COALESCE(SUM(amount_try), 0)     AS planned,
          COALESCE(SUM(paid_amount_try), 0) AS paid,
          COALESCE(SUM(CASE WHEN entry_date >= :m THEN paid_amount_try ELSE 0 END), 0) AS month_paid,
          COALESCE(SUM(CASE WHEN is_overdue = 1 THEN GREATEST(amount_try - paid_amount_try, 0) ELSE 0 END), 0) AS overdue_remaining,
          COALESCE(SUM(CASE WHEN status IN ('Planlanan', 'Gecikmiş', 'Kısmi Ödendi') THEN GREATEST(amount_try - paid_amount_try, 0) ELSE 0 END), 0) AS upcoming,
          SUM(CASE WHEN is_overdue = 1 THEN 1 ELSE 0 END) AS overdue_count,
          SUM(CASE WHEN status IN ('Planlanan', 'Gecikmiş', 'Kısmi Ödendi') THEN 1 ELSE 0 END) AS upcoming_count
        FROM ak_customer_financial_entries
        WHERE title NOT LIKE '%Hakediş%'
    ");
    $custStmt->execute([':m' => $thisMonth]);
    $custRow = $custStmt->fetch() ?: [];

    // Realized government-progress stage collections — same canonical source
    // gelenler.php sums into its "Gelenler"/"Net Durum" totals. Table is only
    // present once the GPP feature has been installed, so guard its absence.
    $gppRow = ['planned' => 0, 'paid' => 0, 'month_paid' => 0];
    $gppExists = $pdo->prepare(
        'SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :t LIMIT 1'
    );
    $gppExists->execute(['t' => 'ak_government_progress_payments']);
    if ($gppExists->fetchColumn()) {
        $gppStmt = $pdo->prepare("
            SELECT
              COALESCE(SUM(planned_amount_try), 0) AS planned,
              COALESCE(SUM(paid_amount_try), 0)    AS paid,
              COALESCE(SUM(CASE WHEN COALESCE(due_date, DATE(created_at)) >= :m THEN paid_amount_try ELSE 0 END), 0) AS month_paid
            FROM ak_government_progress_payments
        ");
        $gppStmt->execute([':m' => $thisMonth]);
        $gppRow = $gppStmt->fetch() ?: $gppRow;
    }

    $expStmt = $pdo->prepare("
        SELECT
          COALESCE(SUM(amount_try), 0)     AS planned,
          COALESCE(SUM(paid_amount_try), 0) AS paid,
          COALESCE(SUM(CASE WHEN entry_date >= :m THEN paid_amount_try ELSE 0 END), 0) AS month_paid
        FROM (
          SELECT amount_try, paid_amount_try, entry_date FROM ak_employee_financial_entries
          UNION ALL
          SELECT amount_try, paid_amount_try, entry_date FROM ak_supplier_financial_entries
          UNION ALL
          SELECT amount_try, paid_amount_try, entry_date FROM ak_expense_card_financial_entries
        ) exp
    ");
    $expStmt->execute([':m' => $thisMonth]);
    $expRow = $expStmt->fetch() ?: [];

    $cntRow = $pdo->query("
        SELECT SUM(cnt) AS cnt FROM (
          SELECT COUNT(*) AS cnt FROM ak_customer_financial_entries
          UNION ALL SELECT COUNT(*) FROM ak_employee_financial_entries
          UNION ALL SELECT COUNT(*) FROM ak_supplier_financial_entries
          UNION ALL SELECT COUNT(*) FROM ak_expense_card_financial_entries
        ) t
    ")->fetch() ?: [];

    $incomePlanned  = ($custRow['planned'] ?? 0) + ($gppRow['planned'] ?? 0);
    $incomePaid     = ($custRow['paid'] ?? 0) + ($gppRow['paid'] ?? 0);
    $incomeMonthPaid = ($custRow['month_paid'] ?? 0) + ($gppRow['month_paid'] ?? 0);

    return [
        'total_income_planned'  => dash_float($incomePlanned),
        'total_income_paid'     => dash_float($incomePaid),
        'total_expense_planned' => dash_float($expRow['planned'] ?? 0),
        'total_expense_paid'    => dash_float($expRow['paid'] ?? 0),
        'realized_profit'       => dash_float($incomePaid - ($expRow['paid'] ?? 0)),
        'planned_profit'        => dash_float($incomePlanned - ($expRow['planned'] ?? 0)),
        'month_income_paid'     => dash_float($incomeMonthPaid),
        'month_expense_paid'    => dash_float($expRow['month_paid'] ?? 0),
        'overdue_receivable'    => dash_float($custRow['overdue_remaining'] ?? 0),
        'upcoming_receivable'   => dash_float($custRow['upcoming'] ?? 0),
        'overdue_count'         => (int) ($custRow['overdue_count'] ?? 0),
        'upcoming_count'        => (int) ($custRow['upcoming_count'] ?? 0),
        'total_entry_count'     => (int) ($cntRow['cnt'] ?? 0),
    ];
}

function fetch_customer_entries_overdue(PDO $pdo): array
{
    return $pdo->query("
        SELECT
          cfe.id, cfe.title, cfe.entry_date AS `date`, cfe.amount_try AS amount,
          cfe.paid_amount_try AS paid_amount, cfe.status, cfe.account_type,
          cfe.currency, cfe.customer_id, cfe.project_id,
          COALESCE(c.company_name, c.full_name) AS customer_name,
          p.title AS project_title
        FROM ak_customer_financial_entries cfe
        LEFT JOIN ak_customers c ON c.id = cfe.customer_id
        LEFT JOIN ak_projects  p ON p.id = cfe.project_id
        WHERE cfe.is_overdue = 1 AND cfe.title NOT LIKE '%Hakediş%'
        ORDER BY cfe.entry_date ASC
        LIMIT 50
    ")->fetchAll() ?: [];
}

function fetch_customer_entries_upcoming(PDO $pdo): array
{
    $today = (new DateTimeImmutable('today'))->format('Y-m-d');
    $in30  = (new DateTimeImmutable('today'))->modify('+30 days')->format('Y-m-d');
    $stmt  = $pdo->prepare("
        SELECT
          cfe.id, cfe.title, cfe.entry_date AS `date`, cfe.amount_try AS amount,
          cfe.paid_amount_try AS paid_amount, cfe.status, cfe.account_type,
          cfe.currency, cfe.customer_id, cfe.project_id,
          COALESCE(c.company_name, c.full_name) AS customer_name,
          p.title AS project_title
        FROM ak_customer_financial_entries cfe
        LEFT JOIN ak_customers c ON c.id = cfe.customer_id
        LEFT JOIN ak_projects  p ON p.id = cfe.project_id
        WHERE cfe.status IN ('Planlanan','Kısmi Ödendi')
          AND cfe.entry_date BETWEEN :today AND :in30
          AND cfe.title NOT LIKE '%Hakediş%'
        ORDER BY cfe.entry_date ASC
        LIMIT 50
    ");
    $stmt->execute([':today' => $today, ':in30' => $in30]);
    return $stmt->fetchAll() ?: [];
}

function fetch_recent_movements(PDO $pdo): array
{
    // Every row is a REALIZED movement (paid_amount_try > 0) — a planned-only
    // receivable/expense is not a "recent hareket" (P2-2). The realized
    // amount (not the planned amount) is the primary figure, and each row
    // carries its real source type, account classification, party name, and
    // original currency/amount instead of being hardcoded to
    // customer/Resmi (the dashboard previously never selected account_type
    // or the true card_type at all).
    return $pdo->query("
        SELECT id, label, party_name, realized_amount, original_amount, currency, `date`,
               direction, card_type, account_type, status, project_title
        FROM (
          SELECT cfe.id, cfe.title AS label, COALESCE(c.company_name, c.full_name) AS party_name,
            cfe.paid_amount_try AS realized_amount, cfe.paid_amount AS original_amount,
            cfe.entry_date AS `date`, 'Gelir' AS direction, 'customer' AS card_type,
            cfe.account_type, cfe.currency, cfe.status, p.title AS project_title, cfe.created_at
          FROM ak_customer_financial_entries cfe
          LEFT JOIN ak_projects p ON p.id = cfe.project_id
          LEFT JOIN ak_customers c ON c.id = cfe.customer_id
          WHERE cfe.paid_amount_try > 0 AND cfe.title NOT LIKE '%Hakediş%'
          UNION ALL
          SELECT efe.id, efe.title, e.full_name,
            efe.paid_amount_try, efe.paid_amount, efe.entry_date, 'Gider', 'employee',
            efe.account_type, efe.currency, efe.status, p.title, efe.created_at
          FROM ak_employee_financial_entries efe
          LEFT JOIN ak_projects p ON p.id = efe.project_id
          LEFT JOIN ak_employees e ON e.id = efe.employee_id
          WHERE efe.paid_amount_try > 0
          UNION ALL
          SELECT sfe.id, sfe.title, s.name,
            sfe.paid_amount_try, sfe.paid_amount, sfe.entry_date, 'Gider', 'supplier',
            sfe.account_type, sfe.currency, sfe.status, p.title, sfe.created_at
          FROM ak_supplier_financial_entries sfe
          LEFT JOIN ak_projects p ON p.id = sfe.project_id
          LEFT JOIN ak_suppliers s ON s.id = sfe.supplier_id
          WHERE sfe.paid_amount_try > 0
          UNION ALL
          SELECT ecfe.id, ecfe.title, ec.name,
            ecfe.paid_amount_try, ecfe.paid_amount, ecfe.entry_date, 'Gider', 'expense_card',
            ecfe.account_type, ecfe.currency, ecfe.status, p.title, ecfe.created_at
          FROM ak_expense_card_financial_entries ecfe
          LEFT JOIN ak_projects p ON p.id = ecfe.project_id
          LEFT JOIN ak_expense_cards ec ON ec.id = ecfe.expense_card_id
          WHERE ecfe.paid_amount_try > 0
        ) m
        ORDER BY `date` DESC, created_at DESC, card_type ASC, id ASC
        LIMIT 10
    ")->fetchAll() ?: [];
}

function fetch_monthly_financials(PDO $pdo): array
{
    $rows = $pdo->query("
        SELECT month, SUM(income) AS income, SUM(expense) AS expense
        FROM (
          SELECT DATE_FORMAT(entry_date,'%Y-%m') AS month, paid_amount_try AS income, 0 AS expense FROM ak_customer_financial_entries
          UNION ALL SELECT DATE_FORMAT(entry_date,'%Y-%m'), 0, paid_amount_try FROM ak_employee_financial_entries
          UNION ALL SELECT DATE_FORMAT(entry_date,'%Y-%m'), 0, paid_amount_try FROM ak_supplier_financial_entries
          UNION ALL SELECT DATE_FORMAT(entry_date,'%Y-%m'), 0, paid_amount_try FROM ak_expense_card_financial_entries
        ) m
        GROUP BY month
        ORDER BY month DESC
        LIMIT 12
    ")->fetchAll() ?: [];

    return array_map(fn($r) => [
        'month'   => $r['month'],
        'income'  => dash_float($r['income']),
        'expense' => dash_float($r['expense']),
        'net'     => dash_float((float)$r['income'] - (float)$r['expense']),
    ], array_reverse($rows));
}

function build_all_cards(PDO $pdo): array
{
    return [
        'customers' => build_customer_cards($pdo),
        'projects'  => build_project_cards($pdo),
        'suppliers' => build_supplier_cards($pdo),
        'personnel' => build_personnel_cards($pdo),
    ];
}

function slice_cards(array $all, int $limit): array
{
    return [
        'customers' => array_slice($all['customers'], 0, $limit),
        'projects'  => array_slice($all['projects'],  0, $limit),
        'suppliers' => array_slice($all['suppliers'], 0, $limit),
        'personnel' => array_slice($all['personnel'], 0, $limit),
    ];
}

function build_customer_cards(PDO $pdo): array
{
    $rows = $pdo->query("
        SELECT
          c.id, COALESCE(c.company_name, c.full_name) AS name,
          COALESCE(SUM(cfe.amount_try), 0)      AS total_contract_value,
          COALESCE(SUM(cfe.paid_amount_try), 0)  AS total_collected,
          COALESCE(SUM(GREATEST(cfe.amount_try - cfe.paid_amount_try, 0)), 0) AS remaining_receivable,
          COALESCE(SUM(CASE WHEN cfe.is_overdue = 1 THEN GREATEST(cfe.amount_try - cfe.paid_amount_try, 0) ELSE 0 END), 0) AS overdue_amount,
          COALESCE(SUM(CASE WHEN cfe.status = 'Planlanan' THEN cfe.amount_try ELSE 0 END), 0) AS upcoming_amount
        FROM ak_customers c
        LEFT JOIN ak_customer_financial_entries cfe ON cfe.customer_id = c.id AND cfe.title NOT LIKE '%Hakediş%'
        GROUP BY c.id, name
        ORDER BY remaining_receivable DESC, total_contract_value DESC
    ")->fetchAll() ?: [];

    return array_map(function ($r) {
        $contract  = (float) $r['total_contract_value'];
        $collected = (float) $r['total_collected'];
        $rate = $contract > 0 ? round(($collected / $contract) * 100) : 0;
        return [
            'id'                          => $r['id'],
            'name'                        => $r['name'],
            'total_contract_value'        => dash_float($r['total_contract_value']),
            'total_collected'             => dash_float($r['total_collected']),
            'remaining_receivable'        => dash_float($r['remaining_receivable']),
            'overdue_amount'              => dash_float($r['overdue_amount']),
            'upcoming_amount'             => dash_float($r['upcoming_amount']),
            'payment_performance_summary' => $contract > 0 ? "%{$rate} tahsil edildi" : 'Plan yok',
        ];
    }, $rows);
}

function build_project_cards(PDO $pdo): array
{
    $rows = $pdo->query("
        SELECT
          p.id, p.title AS name,
          COALESCE(SUM(CASE WHEN src = 'income'  THEN amount_try ELSE 0 END), 0)       AS total_income_planned,
          COALESCE(SUM(CASE WHEN src = 'income'  THEN paid_amount_try ELSE 0 END), 0)  AS total_revenue,
          COALESCE(SUM(CASE WHEN src = 'expense' THEN amount_try ELSE 0 END), 0)       AS total_expense_planned,
          COALESCE(SUM(CASE WHEN src = 'expense' THEN paid_amount_try ELSE 0 END), 0)  AS total_expenses,
          COALESCE(SUM(CASE WHEN src = 'income'  AND paid_amount_try < amount_try THEN amount_try - paid_amount_try ELSE 0 END), 0) AS outstanding_receivables,
          COALESCE(SUM(CASE WHEN src = 'expense' AND paid_amount_try < amount_try THEN amount_try - paid_amount_try ELSE 0 END), 0) AS outstanding_payables
        FROM ak_projects p
        LEFT JOIN (
          SELECT project_id, 'income'  AS src, amount_try, paid_amount_try FROM ak_customer_financial_entries WHERE title NOT LIKE '%Hakediş%'
          UNION ALL
          SELECT project_id, 'expense', amount_try, paid_amount_try FROM ak_employee_financial_entries
          UNION ALL
          SELECT project_id, 'expense', amount_try, paid_amount_try FROM ak_supplier_financial_entries
          UNION ALL
          SELECT project_id, 'expense', amount_try, paid_amount_try FROM ak_expense_card_financial_entries
        ) e ON e.project_id = p.id
        GROUP BY p.id, p.title
        ORDER BY total_revenue DESC, total_income_planned DESC
    ")->fetchAll() ?: [];

    return array_map(function ($r) {
        $rev = (float) $r['total_revenue'];
        $exp = (float) $r['total_expenses'];
        $net = $rev - $exp;
        return [
            'id'                    => $r['id'],
            'name'                  => $r['name'],
            'total_income_planned'  => dash_float($r['total_income_planned']),
            'total_revenue'         => dash_float($rev),
            'total_expense_planned' => dash_float($r['total_expense_planned']),
            'total_expenses'        => dash_float($exp),
            'net_profit'            => dash_float($net),
            'negative_net_profit'   => dash_float(max(0.0, -$net)),
            'current_cash_position' => dash_float($net),
            'negative_cashflow'     => dash_float(max(0.0, -$net)),
            'outstanding_payables'    => dash_float($r['outstanding_payables']),
            'outstanding_receivables' => dash_float($r['outstanding_receivables']),
        ];
    }, $rows);
}

function build_supplier_cards(PDO $pdo): array
{
    $rows = $pdo->query("
        SELECT
          s.id, s.name,
          COALESCE(SUM(sfe.amount_try), 0)     AS total_purchases,
          COALESCE(SUM(sfe.paid_amount_try), 0) AS total_paid,
          COALESCE(SUM(GREATEST(sfe.amount_try - sfe.paid_amount_try, 0)), 0) AS remaining_payable,
          COALESCE(SUM(CASE WHEN sfe.is_overdue = 1 THEN GREATEST(sfe.amount_try - sfe.paid_amount_try, 0) ELSE 0 END), 0) AS overdue_payable
        FROM ak_suppliers s
        LEFT JOIN ak_supplier_financial_entries sfe ON sfe.supplier_id = s.id
        GROUP BY s.id, s.name
        ORDER BY remaining_payable DESC, total_purchases DESC
    ")->fetchAll() ?: [];

    return array_map(fn($r) => [
        'id'                => $r['id'],
        'name'              => $r['name'],
        'total_purchases'   => dash_float($r['total_purchases']),
        'total_paid'        => dash_float($r['total_paid']),
        'remaining_payable' => dash_float($r['remaining_payable']),
        'overdue_payable'   => dash_float($r['overdue_payable']),
    ], $rows);
}

function build_personnel_cards(PDO $pdo): array
{
    $rows = $pdo->query("
        SELECT
          e.id, e.full_name AS name,
          COALESCE(SUM(efe.paid_amount_try), 0)  AS salary_paid,
          COALESCE(SUM(GREATEST(efe.amount_try - efe.paid_amount_try, 0)), 0) AS remaining_payable,
          COALESCE(SUM(CASE WHEN efe.is_overdue = 1 THEN GREATEST(efe.amount_try - efe.paid_amount_try, 0) ELSE 0 END), 0) AS overdue_payable
        FROM ak_employees e
        LEFT JOIN ak_employee_financial_entries efe ON efe.employee_id = e.id
        GROUP BY e.id, e.full_name
        ORDER BY salary_paid DESC
    ")->fetchAll() ?: [];

    return array_map(fn($r) => [
        'id'                   => $r['id'],
        'name'                 => $r['name'],
        'total_personnel_cost' => dash_float($r['salary_paid']),
        'salary_paid'          => dash_float($r['salary_paid']),
        'remaining_payable'    => dash_float($r['remaining_payable']),
        'overdue_payable'      => dash_float($r['overdue_payable']),
    ], $rows);
}

function build_cashflow_command_center(array $cards, array $fin): array
{
    $customers = $cards['customers'] ?? [];
    $suppliers = $cards['suppliers'] ?? [];
    $personnel = $cards['personnel'] ?? [];

    $currentReceivables = array_sum(array_column($customers, 'remaining_receivable'));
    $currentPayables    = array_sum(array_column($suppliers, 'remaining_payable'))
                        + array_sum(array_column($personnel, 'remaining_payable'));

    return [
        'current_receivables'     => dash_float($currentReceivables),
        'current_payables'        => dash_float($currentPayables),
        'net_cash_position'       => $fin['realized_profit'],
        'overdue_collections'     => $fin['overdue_receivable'],
        'upcoming_collections'    => $fin['upcoming_receivable'],
        'upcoming_payments'       => dash_float(array_sum(array_column($personnel, 'remaining_payable'))),
        'personnel_cost_total'    => dash_float(array_sum(array_column($personnel, 'total_personnel_cost'))),
        'most_risky_customers'    => dash_action_items(dash_top($customers, 'overdue_amount', 5), 'overdue_amount', 'Gecikmiş alacak'),
        'most_expensive_projects' => dash_action_items(dash_top($cards['projects'] ?? [], 'total_expenses', 5), 'total_expenses', 'Yüksek gider'),
        'highest_supplier_debt'   => dash_action_items(dash_top($suppliers, 'remaining_payable', 5), 'remaining_payable', 'Tedarikçi borcu'),
    ];
}

function build_net_cash_forecast(array $fin): array
{
    return [
        'available_cash'                     => $fin['realized_profit'],
        'current_payables'                   => 0.0,
        'overdue_collections'                => $fin['overdue_receivable'],
        'overdue_payables'                   => 0.0,
        'official_cash_position'             => 0.0,
        'unofficial_cash_position'           => 0.0,
        'combined_operational_cash_position' => $fin['realized_profit'],
        'windows'                            => [],
    ];
}

function build_cashflow_action_center(array $cards, array $overduePlans): array
{
    $customers = $cards['customers'] ?? [];
    $suppliers = $cards['suppliers'] ?? [];
    $projects  = $cards['projects']  ?? [];

    $overdueCustomers = array_values(array_filter($customers, fn($c) => (float)$c['overdue_amount'] > 0));
    $supplierPayables = array_values(array_filter($suppliers, fn($s) => (float)$s['remaining_payable'] > 0));
    $negativeCashflow = array_values(array_filter($projects, fn($p) => (float)$p['net_profit'] < 0));

    return [
        'critical_collections' => [
            'highest_overdue_customers'    => dash_action_items(dash_top($overdueCustomers, 'overdue_amount', 6), 'overdue_amount', 'Gecikmiş alacak'),
            'highest_outstanding_balances' => dash_action_items(dash_top($customers, 'remaining_receivable', 6), 'remaining_receivable', 'Kalan alacak'),
        ],
        'critical_payments' => [
            'highest_payable_balances' => dash_action_items(dash_top($supplierPayables, 'remaining_payable', 6), 'remaining_payable', 'Tedarikçi borcu'),
        ],
        'project_risk_list' => [
            'negative_cashflow_projects' => dash_action_items(dash_top($negativeCashflow, 'negative_net_profit', 6), 'negative_net_profit', 'Zararlı proje'),
        ],
        'daily_action_queue' => [
            'customers_to_contact_today' => dash_action_items(array_slice($overdueCustomers ?: $customers, 0, 6), 'overdue_amount', 'Tahsilat takibi'),
            'payment_priority_queue'     => [],
        ],
    ];
}

function build_management_decision_dashboard(array $cards, array $fin, array $cmd, array $action): array
{
    $customers = $cards['customers'] ?? [];
    $projects  = $cards['projects']  ?? [];
    $suppliers = $cards['suppliers'] ?? [];
    $personnel = $cards['personnel'] ?? [];

    $profitable = array_values(array_filter($projects, fn($p) => (float)$p['net_profit'] > 0));
    $lossMaking = array_values(array_filter($projects, fn($p) => (float)$p['net_profit'] < 0));

    return [
        'top_risky_customers'         => dash_action_items(dash_top($customers, 'overdue_amount', 6), 'overdue_amount', 'Tahsilat riski'),
        'top_overdue_collections'     => $action['critical_collections']['highest_overdue_customers'] ?? [],
        'top_supplier_liabilities'    => dash_action_items(dash_top($suppliers, 'remaining_payable', 6), 'remaining_payable', 'Tedarikçi borcu'),
        'top_personnel_cost_centers'  => dash_action_items(dash_top($personnel, 'total_personnel_cost', 6), 'total_personnel_cost', 'Personel maliyeti'),
        'top_profitable_projects'     => dash_action_items(dash_top($profitable, 'net_profit', 6), 'net_profit', 'Kârlı proje'),
        'top_loss_making_projects'    => dash_action_items(dash_top($lossMaking, 'negative_net_profit', 6), 'negative_net_profit', 'Zararlı proje'),
        'cash_shortage_warnings'      => build_cash_warnings($fin),
        'collection_priority_queue'   => $action['daily_action_queue']['customers_to_contact_today'] ?? [],
        'payment_priority_queue'      => [],
    ];
}

function build_cash_warnings(array $fin): array
{
    $warnings = [];
    if ($fin['overdue_receivable'] > 0) {
        $warnings[] = [
            'id' => 'overdue-receivable', 'name' => 'Gecikmiş alacak',
            'label' => 'Nakit akış uyarısı', 'amount' => $fin['overdue_receivable'],
            'score' => 70, 'reason' => 'Vadesi geçmiş müşteri alacakları nakit akışını baskılıyor', 'due_date' => '',
        ];
    }
    if ($fin['realized_profit'] < 0) {
        $warnings[] = [
            'id' => 'negative-realized-profit', 'name' => 'Negatif kâr',
            'label' => 'Nakit akış uyarısı', 'amount' => abs($fin['realized_profit']),
            'score' => 90, 'reason' => 'Toplam giderler toplam tahsilatları aşıyor', 'due_date' => '',
        ];
    }
    return $warnings;
}

function build_financial_drilldowns(PDO $pdo): array
{
    return [
        'customer' => [
            'collections' => fetch_dd($pdo, "
                SELECT cfe.id, COALESCE(c.company_name, c.full_name, 'Müşteri') AS owner_name,
                  cfe.title AS label, cfe.paid_amount_try AS amount, cfe.entry_date AS row_date, 'Tahsilat' AS row_type
                FROM ak_customer_financial_entries cfe
                LEFT JOIN ak_customers c ON c.id = cfe.customer_id
                WHERE cfe.paid_amount_try > 0 AND cfe.title NOT LIKE '%Hakediş%' ORDER BY cfe.entry_date DESC LIMIT 8
            "),
            'pending_payments' => fetch_dd($pdo, "
                SELECT cfe.id, COALESCE(c.company_name, c.full_name, 'Müşteri') AS owner_name,
                  cfe.title AS label, GREATEST(cfe.amount_try - cfe.paid_amount_try, 0) AS amount,
                  cfe.entry_date AS row_date, 'Bekleyen' AS row_type
                FROM ak_customer_financial_entries cfe
                LEFT JOIN ak_customers c ON c.id = cfe.customer_id
                WHERE cfe.status IN ('Planlanan','Kısmi Ödendi') AND cfe.amount_try > cfe.paid_amount_try
                  AND cfe.title NOT LIKE '%Hakediş%'
                ORDER BY cfe.entry_date ASC LIMIT 8
            "),
            'overdue_payments' => fetch_dd($pdo, "
                SELECT cfe.id, COALESCE(c.company_name, c.full_name, 'Müşteri') AS owner_name,
                  cfe.title AS label, GREATEST(cfe.amount_try - cfe.paid_amount_try, 0) AS amount,
                  cfe.entry_date AS row_date, 'Gecikmiş' AS row_type
                FROM ak_customer_financial_entries cfe
                LEFT JOIN ak_customers c ON c.id = cfe.customer_id
                WHERE cfe.is_overdue = 1 AND cfe.title NOT LIKE '%Hakediş%' ORDER BY cfe.entry_date ASC LIMIT 8
            "),
        ],
        'project' => [
            'revenue_rows' => fetch_dd($pdo, "
                SELECT cfe.id, p.title AS owner_name, cfe.title AS label, cfe.paid_amount_try AS amount,
                  cfe.entry_date AS row_date, 'Gelir' AS row_type
                FROM ak_customer_financial_entries cfe
                LEFT JOIN ak_projects p ON p.id = cfe.project_id
                WHERE cfe.paid_amount_try > 0 AND cfe.title NOT LIKE '%Hakediş%' ORDER BY cfe.entry_date DESC LIMIT 8
            "),
            'expense_rows' => fetch_dd($pdo, "
                SELECT t.id, p.title AS owner_name, t.title AS label, t.paid_amount_try AS amount,
                  t.entry_date AS row_date, 'Gider' AS row_type
                FROM (
                  SELECT id, project_id, title, paid_amount_try, entry_date FROM ak_employee_financial_entries WHERE paid_amount_try > 0
                  UNION ALL SELECT id, project_id, title, paid_amount_try, entry_date FROM ak_supplier_financial_entries WHERE paid_amount_try > 0
                  UNION ALL SELECT id, project_id, title, paid_amount_try, entry_date FROM ak_expense_card_financial_entries WHERE paid_amount_try > 0
                ) t
                LEFT JOIN ak_projects p ON p.id = t.project_id
                ORDER BY t.entry_date DESC LIMIT 8
            "),
            'profit_components' => [],
        ],
        'supplier' => [
            'payments' => fetch_dd($pdo, "
                SELECT sfe.id, s.name AS owner_name, sfe.title AS label, sfe.paid_amount_try AS amount,
                  sfe.entry_date AS row_date, 'Ödeme' AS row_type
                FROM ak_supplier_financial_entries sfe
                LEFT JOIN ak_suppliers s ON s.id = sfe.supplier_id
                WHERE sfe.paid_amount_try > 0 ORDER BY sfe.entry_date DESC LIMIT 8
            "),
            'remaining_payable_rows' => fetch_dd($pdo, "
                SELECT sfe.id, s.name AS owner_name, sfe.title AS label,
                  GREATEST(sfe.amount_try - sfe.paid_amount_try, 0) AS amount,
                  sfe.entry_date AS row_date, 'Kalan Borç' AS row_type
                FROM ak_supplier_financial_entries sfe
                LEFT JOIN ak_suppliers s ON s.id = sfe.supplier_id
                WHERE sfe.amount_try > sfe.paid_amount_try ORDER BY sfe.entry_date ASC LIMIT 8
            "),
        ],
        'personnel' => [
            'total_cost_rows' => fetch_dd($pdo, "
                SELECT efe.id, e.full_name AS owner_name, efe.title AS label, efe.paid_amount_try AS amount,
                  efe.entry_date AS row_date, 'Personel Maliyeti' AS row_type
                FROM ak_employee_financial_entries efe
                LEFT JOIN ak_employees e ON e.id = efe.employee_id
                WHERE efe.paid_amount_try > 0 ORDER BY efe.entry_date DESC LIMIT 8
            "),
        ],
    ];
}

function fetch_dd(PDO $pdo, string $sql): array
{
    $rows = $pdo->query($sql)->fetchAll() ?: [];
    return array_map(fn($r) => [
        'id'         => (string) ($r['id'] ?? ''),
        'owner_name' => (string) ($r['owner_name'] ?? ''),
        'label'      => (string) ($r['label'] ?? ''),
        'amount'     => dash_float($r['amount'] ?? 0),
        'row_date'   => (string) ($r['row_date'] ?? ''),
        'row_type'   => (string) ($r['row_type'] ?? ''),
    ], $rows);
}

function build_expense_category_intelligence(PDO $pdo): array
{
    $ecRows = $pdo->query("
        SELECT
          COALESCE(ec.name, 'Diğer / Kategorisiz') AS category,
          COALESCE(SUM(t.paid_amount_try), 0) AS realized_cost,
          COALESCE(SUM(t.amount_try), 0)      AS planned_cost,
          COUNT(*) AS row_count
        FROM ak_expense_card_financial_entries t
        LEFT JOIN ak_expense_cards ec ON ec.id = t.expense_card_id
        GROUP BY category
    ")->fetchAll() ?: [];

    $empRow = $pdo->query("SELECT COALESCE(SUM(paid_amount_try),0) AS rc, COALESCE(SUM(amount_try),0) AS pc, COUNT(*) AS cnt FROM ak_employee_financial_entries")->fetch() ?: [];
    $supRow = $pdo->query("SELECT COALESCE(SUM(paid_amount_try),0) AS rc, COALESCE(SUM(amount_try),0) AS pc, COUNT(*) AS cnt FROM ak_supplier_financial_entries")->fetch() ?: [];

    if ((float)($empRow['rc'] ?? 0) > 0 || (float)($empRow['pc'] ?? 0) > 0) {
        $ecRows[] = ['category' => 'Personel', 'realized_cost' => $empRow['rc'], 'planned_cost' => $empRow['pc'], 'row_count' => $empRow['cnt']];
    }
    if ((float)($supRow['rc'] ?? 0) > 0 || (float)($supRow['pc'] ?? 0) > 0) {
        $ecRows[] = ['category' => 'Tedarikçi', 'realized_cost' => $supRow['rc'], 'planned_cost' => $supRow['pc'], 'row_count' => $supRow['cnt']];
    }

    usort($ecRows, fn($a, $b) => (float)$b['realized_cost'] <=> (float)$a['realized_cost']);

    $categories = array_map(fn($r) => [
        'category'       => $r['category'],
        'realized_cost'  => dash_float($r['realized_cost']),
        'planned_cost'   => dash_float($r['planned_cost']),
        'total_exposure' => dash_float((float)$r['realized_cost'] + (float)$r['planned_cost']),
        'cash_pressure'  => dash_float(max(0.0, (float)$r['planned_cost'] - (float)$r['realized_cost'])),
        'row_count'      => (int) $r['row_count'],
    ], $ecRows);

    return [
        'categories'              => $categories,
        'top_spending_categories' => array_slice($categories, 0, 8),
        'summary' => [
            'realized_cost_total'  => dash_float(array_sum(array_column($categories, 'realized_cost'))),
            'planned_cost_total'   => dash_float(array_sum(array_column($categories, 'planned_cost'))),
            'cash_pressure_total'  => dash_float(array_sum(array_column($categories, 'cash_pressure'))),
            'uncategorized_count'  => (int) array_sum(array_column(
                array_filter($categories, fn($c) => $c['category'] === 'Diğer / Kategorisiz'),
                'row_count'
            )),
            'category_count'       => count($categories),
        ],
    ];
}

function dash_top(array $items, string $sortField, int $limit): array
{
    usort($items, fn($a, $b) => (float)($b[$sortField] ?? 0) <=> (float)($a[$sortField] ?? 0));
    return array_slice($items, 0, $limit);
}

function dash_action_items(array $items, string $amountField, string $label): array
{
    return array_map(fn($item) => [
        'id'       => (string) ($item['id'] ?? ''),
        'name'     => (string) ($item['name'] ?? ''),
        'label'    => $label,
        'amount'   => dash_float($item[$amountField] ?? 0),
        'score'    => min(100, (int) round(dash_float($item[$amountField] ?? 0) / 5000)),
        'reason'   => '',
        'due_date' => '',
    ], $items);
}
