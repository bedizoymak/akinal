<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/canonical-read-flags.php';

require_admin();
require_method('GET');

try {
    $pdo = db();

    $projectStats = fetch_one($pdo, "
        SELECT
          COUNT(*) AS total_projects,
          COALESCE(SUM(CASE WHEN project_status <> 'Tamamlandı' THEN 1 ELSE 0 END), 0) AS active_projects,
          COALESCE(SUM(CASE WHEN is_published = 1 THEN 1 ELSE 0 END), 0) AS published_projects,
          COALESCE(SUM(CASE WHEN is_published = 0 THEN 1 ELSE 0 END), 0) AS draft_projects
        FROM ak_projects
    ");

    $contactStats = fetch_one($pdo, "
        SELECT
          COUNT(*) AS total_contact_requests,
          COALESCE(SUM(CASE WHEN status = 'Yeni' THEN 1 ELSE 0 END), 0) AS new_contact_requests
        FROM ak_contact_requests
    ");

    $notificationStats = fetch_one($pdo, "
        SELECT COUNT(*) AS unread_notifications
        FROM ak_notifications
        WHERE is_read = 0
    ");

    $customerStats = fetch_one($pdo, 'SELECT COUNT(*) AS total_customers FROM ak_customers');
    $legacyFinancials = canonical_read_legacy_dashboard_summary($pdo);
    $canonicalFinancials = canonical_read_dashboard_summary($pdo);
    $selectedFinancials = [
        'summary' => canonical_read_select(
            'dashboard.summary',
            $legacyFinancials['summary'],
            $canonicalFinancials['summary'],
            CANONICAL_READ_REQUIRED_DASHBOARD_SUMMARY
        ),
        'overdue_plans' => canonical_read_select('dashboard.overdue_plans', $legacyFinancials['overdue_plans'], $canonicalFinancials['overdue_plans']),
        'upcoming_plans' => canonical_read_select('dashboard.upcoming_plans', $legacyFinancials['upcoming_plans'], $canonicalFinancials['upcoming_plans']),
    ];

    $activeProjects = $pdo->query("
        SELECT id, title, project_status, location, is_published, slug, sort_order
        FROM ak_projects
        WHERE project_status <> 'Tamamlandı'
        ORDER BY sort_order ASC, created_at DESC
        LIMIT 6
    ")->fetchAll();

    $customerPlans = $pdo->query("
        SELECT
          pp.id,
          pp.title,
          pp.amount,
          pp.paid_amount,
          pp.due_date,
          pp.status,
          pp.customer_id,
          pp.project_id,
          pp.account_type,
          COALESCE(c.company_name, c.full_name) AS customer_name,
          pr.title AS project_title
        FROM ak_payment_plans pp
        LEFT JOIN ak_customers c ON c.id = pp.customer_id
        LEFT JOIN ak_projects pr ON pr.id = pp.project_id
        WHERE pp.customer_id IS NOT NULL
        ORDER BY pp.customer_id ASC, pp.account_type ASC, pp.due_date ASC
    ")->fetchAll();

    $customerPayments = $pdo->query("
        SELECT customer_id, payment_plan_id, amount, account_type
        FROM ak_payments
        WHERE customer_id IS NOT NULL
    ")->fetchAll();
    $legacyCustomerPlanBuckets = canonical_read_legacy_customer_plan_buckets($customerPlans ?: [], $customerPayments ?: []);
    $canonicalCustomerPlanBuckets = canonical_read_customer_plan_buckets($customerPlans ?: [], $customerPayments ?: []);
    $customerPlanBuckets = [
        'overdue' => canonical_read_select('dashboard.customer_plan_buckets.overdue', $legacyCustomerPlanBuckets['overdue'], $canonicalCustomerPlanBuckets['overdue']),
        'upcoming' => canonical_read_select('dashboard.customer_plan_buckets.upcoming', $legacyCustomerPlanBuckets['upcoming'], $canonicalCustomerPlanBuckets['upcoming']),
    ];
    [$overduePlans, $upcomingPlans] = [$customerPlanBuckets['overdue'], $customerPlanBuckets['upcoming']];

    $recentMovements = $pdo->query("
        SELECT
          movement.id,
          movement.label,
          movement.amount,
          movement.date,
          movement.direction,
          movement.card_type,
          movement.currency,
          movement.`group`,
          movement.status,
          movement.project_title
        FROM (
          SELECT
            fe.id,
            fe.title AS label,
            fe.amount,
            fe.entry_date AS date,
            fe.direction,
            fe.card_type,
            fe.currency_tag AS currency,
            fe.group_tag AS `group`,
            fe.status,
            pr.title AS project_title,
            fe.created_at
          FROM ak_financial_entries fe
          LEFT JOIN ak_projects pr ON pr.id = fe.project_id
          WHERE fe.status <> 'İptal'
          UNION ALL
          SELECT
            CONCAT('payment-', p.id) AS id,
            COALESCE(p.description, 'Tahsilat') AS label,
            p.amount,
            p.payment_date AS date,
            'Gelir' AS direction,
            'customer' AS card_type,
            'TRY' AS currency,
            CASE WHEN p.account_type = 'gayri_resmi' THEN 'Gayri Resmi' ELSE 'Resmi' END AS `group`,
            'Gerçekleşti' AS status,
            pr.title AS project_title,
            p.created_at
          FROM ak_payments p
          LEFT JOIN ak_projects pr ON pr.id = p.project_id
          UNION ALL
          SELECT
            CONCAT('expense-', e.id) AS id,
            e.title AS label,
            e.amount,
            e.expense_date AS date,
            'Gider' AS direction,
            'expense' AS card_type,
            'TRY' AS currency,
            'Resmi' AS `group`,
            'Gerçekleşti' AS status,
            pr.title AS project_title,
            e.created_at
          FROM ak_expenses e
          LEFT JOIN ak_projects pr ON pr.id = e.project_id
        ) movement
        ORDER BY movement.date DESC, movement.created_at DESC
        LIMIT 8
    ")->fetchAll();

    $monthlyFinancials = canonical_read_select(
        'dashboard.monthly_financials',
        canonical_read_legacy_monthly_financials($pdo),
        canonical_read_monthly_financials($pdo)
    );

    $financialSummary = $selectedFinancials['summary'];

    $unifiedFinancialCards = fetch_unified_financial_cards($pdo);

    json_success([
        'summary' => [
            'total_projects' => (int) ($projectStats['total_projects'] ?? 0),
            'active_projects' => (int) ($projectStats['active_projects'] ?? 0),
            'published_projects' => (int) ($projectStats['published_projects'] ?? 0),
            'draft_projects' => (int) ($projectStats['draft_projects'] ?? 0),
            'total_contact_requests' => (int) ($contactStats['total_contact_requests'] ?? 0),
            'new_contact_requests' => (int) ($contactStats['new_contact_requests'] ?? 0),
            'unread_notifications' => (int) ($notificationStats['unread_notifications'] ?? 0),
            'total_customers' => (int) ($customerStats['total_customers'] ?? 0),
            'total_payments' => $financialSummary['total_payments'],
            'total_expenses' => $financialSummary['total_expenses'],
            'basic_net_balance' => $financialSummary['basic_net_balance'],
            'planned_income' => $financialSummary['planned_income'],
            'month_income' => $financialSummary['month_income'],
            'month_expenses' => $financialSummary['month_expenses'],
            'month_net' => $financialSummary['month_net'],
            'overdue_collections' => $financialSummary['overdue_collections'],
            'expected_payments' => $financialSummary['expected_payments'],
            'overdue_plan_count' => $financialSummary['overdue_plan_count'],
            'upcoming_plan_count' => $financialSummary['upcoming_plan_count'],
            'financial_entry_count' => $financialSummary['financial_entry_count'],
        ],
        'active_projects_list' => $activeProjects ?: [],
        'overdue_plans' => array_slice($overduePlans ?: [], 0, 8),
        'upcoming_plans' => array_slice($upcomingPlans ?: [], 0, 8),
        'recent_movements' => $recentMovements ?: [],
        'monthly_financials' => $monthlyFinancials ?: [],
        'unified_financial_cards' => $unifiedFinancialCards,
        'cashflow_command_center' => fetch_cashflow_command_center($pdo, $financialSummary, $unifiedFinancialCards),
        'cashflow_action_center' => fetch_cashflow_action_center($pdo, $unifiedFinancialCards),
        'financial_drilldowns' => fetch_financial_drilldowns($pdo),
    ]);
} catch (Throwable $exception) {
    json_error('Dashboard verileri alınamadı.', 500);
}

function fetch_one(PDO $pdo, string $sql): array
{
    $statement = $pdo->query($sql);
    $row = $statement->fetch();
    return is_array($row) ? $row : [];
}

function fetch_unified_financial_cards(PDO $pdo): array
{
    return [
        'customers' => fetch_customer_financial_cards($pdo),
        'projects' => fetch_project_financial_cards($pdo),
        'suppliers' => fetch_supplier_financial_cards($pdo),
        'personnel' => fetch_personnel_financial_cards($pdo),
    ];
}

function fetch_cashflow_command_center(PDO $pdo, array $financialSummary, array $cards): array
{
    $payableState = fetch_payable_state($pdo);
    $customerCards = $cards['customers'] ?? [];
    $projectCards = $cards['projects'] ?? [];
    $supplierCards = $cards['suppliers'] ?? [];
    $personnelCards = $cards['personnel'] ?? [];

    return [
        'current_receivables' => canonical_read_money(array_sum(array_map(static fn(array $card): float => canonical_read_money($card['remaining_receivable'] ?? 0), $customerCards))),
        'current_payables' => $payableState['current_payables'],
        'net_cash_position' => canonical_read_money($financialSummary['basic_net_balance'] ?? 0),
        'overdue_collections' => canonical_read_money($financialSummary['overdue_collections'] ?? 0),
        'upcoming_collections' => canonical_read_money($financialSummary['expected_payments'] ?? 0),
        'upcoming_payments' => $payableState['upcoming_payments'],
        'personnel_cost_total' => fetch_personnel_cost_total($pdo),
        'most_risky_customers' => top_financial_cards($customerCards, ['overdue_amount', 'remaining_receivable']),
        'most_expensive_projects' => top_financial_cards($projectCards, ['total_expenses', 'outstanding_payables']),
        'highest_supplier_debt' => top_financial_cards($supplierCards, ['remaining_payable', 'overdue_payable']),
    ];
}

function fetch_cashflow_action_center(PDO $pdo, array $cards): array
{
    $customerCards = $cards['customers'] ?? [];
    $projectCards = $cards['projects'] ?? [];
    $supplierCards = $cards['suppliers'] ?? [];

    $highestOverdueCustomers = array_values(array_filter(top_financial_cards($customerCards, ['overdue_amount', 'remaining_receivable']), static fn(array $card): bool => canonical_read_money($card['overdue_amount'] ?? 0) > 0));
    $highestOutstandingBalances = array_values(array_filter(top_financial_cards($customerCards, ['remaining_receivable', 'overdue_amount']), static fn(array $card): bool => canonical_read_money($card['remaining_receivable'] ?? 0) > 0));
    $collectionRiskScores = top_financial_cards(array_map(static function (array $card): array {
        $remaining = canonical_read_money($card['remaining_receivable'] ?? 0);
        $overdue = canonical_read_money($card['overdue_amount'] ?? 0);
        $contract = max(1.0, canonical_read_money($card['total_contract_value'] ?? 0));
        $card['collection_risk_score'] = min(100, (int) round(($overdue / $contract) * 70 + ($remaining / $contract) * 30));
        $card['risk_reason'] = $overdue > 0 ? 'Vadesi geçmiş alacak var' : 'Yüksek kalan alacak';
        return $card;
    }, $customerCards), ['collection_risk_score', 'overdue_amount', 'remaining_receivable']);

    $lowestProfitability = top_financial_cards($projectCards, ['negative_net_profit', 'outstanding_payables']);
    $highestExpenseProjects = top_financial_cards($projectCards, ['total_expenses', 'outstanding_payables']);
    $negativeCashflowProjects = array_values(array_filter(top_financial_cards($projectCards, ['negative_cashflow', 'outstanding_payables']), static fn(array $card): bool => canonical_read_money($card['current_cash_position'] ?? 0) < 0));

    return [
        'critical_collections' => [
            'highest_overdue_customers' => array_map('action_center_customer_item', $highestOverdueCustomers),
            'highest_outstanding_balances' => array_map('action_center_customer_item', $highestOutstandingBalances),
            'collection_risk_scores' => array_map('action_center_customer_risk_item', $collectionRiskScores),
        ],
        'critical_payments' => [
            'upcoming_supplier_payments' => fetch_upcoming_action_payments($pdo, 'supplier'),
            'upcoming_personnel_payments' => fetch_upcoming_action_payments($pdo, 'personnel'),
            'highest_payable_balances' => array_map('action_center_supplier_item', array_values(array_filter(top_financial_cards($supplierCards, ['remaining_payable', 'overdue_payable']), static fn(array $card): bool => canonical_read_money($card['remaining_payable'] ?? 0) > 0))),
        ],
        'project_risk_list' => [
            'lowest_profitability_projects' => array_map('action_center_project_item', $lowestProfitability),
            'highest_expense_projects' => array_map('action_center_project_item', $highestExpenseProjects),
            'negative_cashflow_projects' => array_map('action_center_project_item', $negativeCashflowProjects),
        ],
        'daily_action_queue' => [
            'customers_to_contact_today' => array_map('action_center_customer_item', array_slice($highestOverdueCustomers ?: $highestOutstandingBalances, 0, 6)),
            'suppliers_requiring_payment_review' => fetch_upcoming_action_payments($pdo, 'supplier'),
            'projects_requiring_financial_review' => array_map('action_center_project_item', array_slice($negativeCashflowProjects ?: $lowestProfitability, 0, 6)),
        ],
    ];
}

function fetch_upcoming_action_payments(PDO $pdo, string $ownerType): array
{
    $today = (new DateTimeImmutable('today'))->format('Y-m-d');
    $in30 = (new DateTimeImmutable('today'))->modify('+30 days')->format('Y-m-d');
    if ($ownerType === 'personnel') {
        return fetch_action_rows($pdo, "
            SELECT pp.id, emp.full_name AS name, pp.title AS label, GREATEST(pp.amount - pp.paid_amount, 0) AS amount, pp.due_date, 'Personel ödeme kontrolü' AS reason
            FROM ak_payment_plans pp
            LEFT JOIN ak_employees emp ON emp.id = pp.employee_id
            WHERE pp.employee_id IS NOT NULL
              AND pp.status <> 'İptal'
              AND pp.due_date BETWEEN '{$today}' AND '{$in30}'
              AND GREATEST(pp.amount - pp.paid_amount, 0) > 0
            ORDER BY pp.due_date ASC, amount DESC
            LIMIT 6
        ");
    }

    return fetch_action_rows($pdo, "
        SELECT pp.id, ec.name, pp.title AS label, GREATEST(pp.amount - pp.paid_amount, 0) AS amount, pp.due_date, 'Tedarikçi ödeme kontrolü' AS reason
        FROM ak_payment_plans pp
        LEFT JOIN ak_expense_cards ec ON ec.id = pp.expense_card_id
        WHERE pp.expense_card_id IS NOT NULL
          AND pp.status <> 'İptal'
          AND pp.due_date BETWEEN '{$today}' AND '{$in30}'
          AND GREATEST(pp.amount - pp.paid_amount, 0) > 0
        ORDER BY pp.due_date ASC, amount DESC
        LIMIT 6
    ");
}

function fetch_action_rows(PDO $pdo, string $sql): array
{
    return array_map(static fn(array $row): array => [
        'id' => (string) ($row['id'] ?? ''),
        'name' => (string) ($row['name'] ?? 'Bağlantısız'),
        'label' => (string) ($row['label'] ?? 'Aksiyon'),
        'amount' => canonical_read_money($row['amount'] ?? 0),
        'score' => (int) ($row['score'] ?? 0),
        'reason' => (string) ($row['reason'] ?? ''),
        'due_date' => (string) ($row['due_date'] ?? ''),
    ], canonical_read_all($pdo, $sql));
}

function action_center_customer_item(array $card): array
{
    return [
        'id' => (string) ($card['id'] ?? ''),
        'name' => (string) ($card['name'] ?? 'Müşteri'),
        'label' => (string) ($card['payment_performance_summary'] ?? 'Tahsilat aksiyonu'),
        'amount' => canonical_read_money(($card['overdue_amount'] ?? 0) ?: ($card['remaining_receivable'] ?? 0)),
        'score' => (int) ($card['collection_risk_score'] ?? 0),
        'reason' => (string) ($card['risk_reason'] ?? 'Tahsilat takibi gerekli'),
        'due_date' => '',
    ];
}

function action_center_customer_risk_item(array $card): array
{
    $item = action_center_customer_item($card);
    $item['amount'] = canonical_read_money($card['remaining_receivable'] ?? 0);
    return $item;
}

function action_center_supplier_item(array $card): array
{
    return [
        'id' => (string) ($card['id'] ?? ''),
        'name' => (string) ($card['name'] ?? 'Tedarikçi'),
        'label' => 'Kalan tedarikçi borcu',
        'amount' => canonical_read_money($card['remaining_payable'] ?? 0),
        'score' => 0,
        'reason' => canonical_read_money($card['overdue_payable'] ?? 0) > 0 ? 'Vadesi geçmiş borç var' : 'Yüksek kalan borç',
        'due_date' => (string) ($card['last_payment_date'] ?? ''),
    ];
}

function action_center_project_item(array $card): array
{
    return [
        'id' => (string) ($card['id'] ?? ''),
        'name' => (string) ($card['name'] ?? 'Proje'),
        'label' => 'Proje finans kontrolü',
        'amount' => canonical_read_money(($card['net_profit'] ?? 0) ?: ($card['total_expenses'] ?? 0)),
        'score' => 0,
        'reason' => canonical_read_money($card['current_cash_position'] ?? 0) < 0 ? 'Negatif nakit akışı' : 'Kârlılık/gider kontrolü',
        'due_date' => '',
    ];
}

function fetch_financial_drilldowns(PDO $pdo): array
{
    return [
        'customer' => [
            'collections' => fetch_drilldown_rows($pdo, "
                SELECT p.id, COALESCE(c.company_name, c.full_name, 'Müşteri') AS owner_name, COALESCE(p.description, 'Tahsilat') AS label, p.amount, p.payment_date AS row_date, 'Tahsilat' AS row_type
                FROM ak_payments p
                LEFT JOIN ak_customers c ON c.id = p.customer_id
                WHERE p.customer_id IS NOT NULL
                ORDER BY p.payment_date DESC, p.created_at DESC
                LIMIT 8
            "),
            'pending_payments' => fetch_drilldown_rows($pdo, "
                SELECT pp.id, COALESCE(c.company_name, c.full_name, 'Müşteri') AS owner_name, pp.title AS label, GREATEST(pp.amount - pp.paid_amount, 0) AS amount, pp.due_date AS row_date, 'Bekleyen' AS row_type
                FROM ak_payment_plans pp
                LEFT JOIN ak_customers c ON c.id = pp.customer_id
                WHERE pp.customer_id IS NOT NULL
                  AND pp.status <> 'İptal'
                  AND GREATEST(pp.amount - pp.paid_amount, 0) > 0
                ORDER BY pp.due_date ASC
                LIMIT 8
            "),
            'overdue_payments' => fetch_drilldown_rows($pdo, "
                SELECT pp.id, COALESCE(c.company_name, c.full_name, 'Müşteri') AS owner_name, pp.title AS label, GREATEST(pp.amount - pp.paid_amount, 0) AS amount, pp.due_date AS row_date, 'Vadesi Geçti' AS row_type
                FROM ak_payment_plans pp
                LEFT JOIN ak_customers c ON c.id = pp.customer_id
                WHERE pp.customer_id IS NOT NULL
                  AND pp.status <> 'İptal'
                  AND pp.due_date < CURDATE()
                  AND GREATEST(pp.amount - pp.paid_amount, 0) > 0
                ORDER BY pp.due_date ASC
                LIMIT 8
            "),
        ],
        'project' => [
            'revenue_rows' => fetch_drilldown_rows($pdo, "
                SELECT p.id, pr.title AS owner_name, COALESCE(p.description, 'Tahsilat') AS label, p.amount, p.payment_date AS row_date, 'Gelir' AS row_type
                FROM ak_payments p
                LEFT JOIN ak_projects pr ON pr.id = p.project_id
                WHERE p.project_id IS NOT NULL
                ORDER BY p.payment_date DESC, p.created_at DESC
                LIMIT 8
            "),
            'expense_rows' => fetch_drilldown_rows($pdo, "
                SELECT e.id, pr.title AS owner_name, e.title AS label, e.amount, e.expense_date AS row_date, 'Gider' AS row_type
                FROM ak_expenses e
                LEFT JOIN ak_projects pr ON pr.id = e.project_id
                WHERE e.project_id IS NOT NULL
                ORDER BY e.expense_date DESC, e.created_at DESC
                LIMIT 8
            "),
            'profit_components' => fetch_drilldown_rows($pdo, "
                SELECT pr.id, pr.title AS owner_name, 'Net kâr bileşeni' AS label,
                  COALESCE(pay.total_revenue, 0) - COALESCE(exp.total_expenses, 0) AS amount,
                  CURDATE() AS row_date,
                  'Kâr' AS row_type
                FROM ak_projects pr
                LEFT JOIN (SELECT project_id, SUM(amount) AS total_revenue FROM ak_payments WHERE project_id IS NOT NULL GROUP BY project_id) pay ON pay.project_id = pr.id
                LEFT JOIN (SELECT project_id, SUM(amount) AS total_expenses FROM ak_expenses WHERE project_id IS NOT NULL GROUP BY project_id) exp ON exp.project_id = pr.id
                ORDER BY ABS(COALESCE(pay.total_revenue, 0) - COALESCE(exp.total_expenses, 0)) DESC
                LIMIT 8
            "),
        ],
        'supplier' => [
            'purchases' => fetch_drilldown_rows($pdo, "
                SELECT fe.id, ec.name AS owner_name, fe.title AS label, fe.amount, fe.entry_date AS row_date, 'Alım' AS row_type
                FROM ak_financial_entries fe
                LEFT JOIN ak_expense_cards ec ON ec.id = fe.expense_card_id
                WHERE fe.expense_card_id IS NOT NULL
                  AND fe.direction = 'Gider'
                  AND fe.status <> 'İptal'
                ORDER BY fe.entry_date DESC, fe.created_at DESC
                LIMIT 8
            "),
            'payments' => fetch_drilldown_rows($pdo, "
                SELECT fe.id, ec.name AS owner_name, fe.title AS label, fe.amount, fe.entry_date AS row_date, 'Ödeme' AS row_type
                FROM ak_financial_entries fe
                LEFT JOIN ak_expense_cards ec ON ec.id = fe.expense_card_id
                WHERE fe.expense_card_id IS NOT NULL
                  AND fe.direction = 'Gider'
                  AND fe.status = 'Gerçekleşti'
                ORDER BY fe.entry_date DESC, fe.created_at DESC
                LIMIT 8
            "),
            'remaining_payable_rows' => fetch_drilldown_rows($pdo, "
                SELECT pp.id, ec.name AS owner_name, pp.title AS label, GREATEST(pp.amount - pp.paid_amount, 0) AS amount, pp.due_date AS row_date, 'Kalan Borç' AS row_type
                FROM ak_payment_plans pp
                LEFT JOIN ak_expense_cards ec ON ec.id = pp.expense_card_id
                WHERE pp.expense_card_id IS NOT NULL
                  AND pp.status <> 'İptal'
                  AND GREATEST(pp.amount - pp.paid_amount, 0) > 0
                ORDER BY pp.due_date ASC
                LIMIT 8
            "),
        ],
        'personnel' => [
            'salary' => fetch_personnel_drilldown_rows($pdo, 'Maaş'),
            'advances' => fetch_personnel_drilldown_rows($pdo, 'Avans'),
            'reimbursements' => fetch_personnel_drilldown_rows($pdo, 'Masraf İadesi'),
            'total_cost_rows' => fetch_drilldown_rows($pdo, "
                SELECT fe.id, emp.full_name AS owner_name, fe.title AS label, fe.amount, fe.entry_date AS row_date, 'Personel Maliyeti' AS row_type
                FROM ak_financial_entries fe
                LEFT JOIN ak_employees emp ON emp.id = fe.employee_id
                WHERE fe.employee_id IS NOT NULL
                  AND fe.direction = 'Gider'
                  AND fe.status <> 'İptal'
                ORDER BY fe.entry_date DESC, fe.created_at DESC
                LIMIT 8
            "),
        ],
    ];
}

function fetch_personnel_drilldown_rows(PDO $pdo, string $kind): array
{
    $rows = fetch_drilldown_rows($pdo, "
        SELECT fe.id, emp.full_name AS owner_name, fe.title AS label, fe.amount, fe.entry_date AS row_date, 'Personel' AS row_type
        FROM ak_financial_entries fe
        LEFT JOIN ak_employees emp ON emp.id = fe.employee_id
        WHERE fe.employee_id IS NOT NULL
          AND fe.direction = 'Gider'
          AND fe.status <> 'İptal'
        ORDER BY fe.entry_date DESC, fe.created_at DESC
        LIMIT 50
    ");

    return array_slice(array_values(array_filter($rows, static function (array $row) use ($kind): bool {
        $label = mb_strtolower((string) ($row['label'] ?? ''), 'UTF-8');
        if ($kind === 'Avans') {
            return str_contains($label, 'avans');
        }
        if ($kind === 'Masraf İadesi') {
            return str_contains($label, 'masraf') || str_contains($label, 'iade');
        }
        return !str_contains($label, 'avans') && !str_contains($label, 'masraf') && !str_contains($label, 'iade');
    })), 0, 8);
}

function fetch_drilldown_rows(PDO $pdo, string $sql): array
{
    return array_map(static fn(array $row): array => [
        'id' => (string) ($row['id'] ?? ''),
        'owner_name' => (string) ($row['owner_name'] ?? 'Bağlantısız'),
        'label' => (string) ($row['label'] ?? 'Kayıt'),
        'amount' => canonical_read_money($row['amount'] ?? 0),
        'row_date' => (string) ($row['row_date'] ?? ''),
        'row_type' => (string) ($row['row_type'] ?? ''),
    ], canonical_read_all($pdo, $sql));
}

function fetch_personnel_cost_total(PDO $pdo): float
{
    $row = fetch_one($pdo, "
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM ak_financial_entries
        WHERE employee_id IS NOT NULL
          AND direction = 'Gider'
          AND status <> 'İptal'
    ");

    return canonical_read_money($row['total'] ?? 0);
}

function fetch_payable_state(PDO $pdo): array
{
    $today = (new DateTimeImmutable('today'))->format('Y-m-d');
    $in30 = (new DateTimeImmutable('today'))->modify('+30 days')->format('Y-m-d');
    $state = ['current_payables' => 0.0, 'upcoming_payments' => 0.0];

    foreach (canonical_read_all($pdo, "
        SELECT amount, paid_amount, due_date, status
        FROM ak_payment_plans
        WHERE customer_id IS NULL
          AND status <> 'İptal'
    ") as $plan) {
        $remaining = max(0.0, canonical_read_money($plan['amount'] ?? 0) - canonical_read_money($plan['paid_amount'] ?? 0));
        $state['current_payables'] = canonical_read_money($state['current_payables'] + $remaining);
        $dueDate = (string) ($plan['due_date'] ?? '');
        if ($dueDate >= $today && $dueDate <= $in30) {
            $state['upcoming_payments'] = canonical_read_money($state['upcoming_payments'] + $remaining);
        }
    }

    return $state;
}

function fetch_customer_financial_cards(PDO $pdo): array
{
    $plans = canonical_read_all($pdo, "
        SELECT id, title, amount, paid_amount, due_date, status, customer_id, project_id, account_type
        FROM ak_payment_plans
        WHERE customer_id IS NOT NULL
        ORDER BY customer_id ASC, account_type ASC, due_date ASC
    ");
    $payments = canonical_read_all($pdo, "
        SELECT customer_id, payment_plan_id, amount, account_type, payment_date
        FROM ak_payments
        WHERE customer_id IS NOT NULL
    ");
    $buckets = canonical_read_customer_plan_buckets($plans, $payments);
    $stateById = [];
    foreach ($buckets['states'] ?? [] as $state) {
        $stateById[(string) ($state['id'] ?? '')] = $state;
    }

    $cards = [];
    foreach (canonical_read_all($pdo, "
        SELECT id, COALESCE(company_name, full_name, 'Müşteri') AS name
        FROM ak_customers
        ORDER BY created_at DESC
    ") as $customer) {
        $id = (string) $customer['id'];
        $cards[$id] = [
            'id' => $id,
            'name' => (string) $customer['name'],
            'total_contract_value' => 0.0,
            'total_collected' => 0.0,
            'remaining_receivable' => 0.0,
            'overdue_amount' => 0.0,
            'upcoming_amount' => 0.0,
            'payment_performance_summary' => 'Tahsilat bekleniyor',
        ];
    }

    foreach ($stateById as $plan) {
        $customerId = (string) ($plan['customer_id'] ?? '');
        if ($customerId === '' || !isset($cards[$customerId])) {
            continue;
        }
        $amount = canonical_read_money($plan['amount'] ?? 0);
        $remaining = canonical_read_money($plan['remaining_amount'] ?? 0);
        $paid = canonical_read_money($plan['paid_amount'] ?? 0);
        $cards[$customerId]['total_contract_value'] = canonical_read_money($cards[$customerId]['total_contract_value'] + $amount);
        $cards[$customerId]['total_collected'] = canonical_read_money($cards[$customerId]['total_collected'] + $paid);
        $cards[$customerId]['remaining_receivable'] = canonical_read_money($cards[$customerId]['remaining_receivable'] + $remaining);
    }

    foreach ($buckets['overdue'] ?? [] as $plan) {
        $customerId = (string) ($plan['customer_id'] ?? '');
        if (isset($cards[$customerId])) {
            $cards[$customerId]['overdue_amount'] = canonical_read_money($cards[$customerId]['overdue_amount'] + canonical_read_money($plan['remaining_amount'] ?? 0));
        }
    }
    foreach ($buckets['upcoming'] ?? [] as $plan) {
        $customerId = (string) ($plan['customer_id'] ?? '');
        if (isset($cards[$customerId])) {
            $cards[$customerId]['upcoming_amount'] = canonical_read_money($cards[$customerId]['upcoming_amount'] + canonical_read_money($plan['remaining_amount'] ?? 0));
        }
    }

    return top_financial_cards(array_map(static function (array $card): array {
        $contract = canonical_read_money($card['total_contract_value'] ?? 0);
        $collected = canonical_read_money($card['total_collected'] ?? 0);
        $rate = $contract > 0 ? round(($collected / $contract) * 100) : 0;
        $card['payment_performance_summary'] = $contract > 0 ? "%{$rate} tahsil edildi" : 'Plan yok';
        return $card;
    }, array_values($cards)), ['overdue_amount', 'remaining_receivable', 'total_contract_value']);
}

function fetch_project_financial_cards(PDO $pdo): array
{
    $cards = [];
    foreach (canonical_read_all($pdo, "
        SELECT id, title AS name
        FROM ak_projects
        ORDER BY sort_order ASC, created_at DESC
    ") as $project) {
        $id = (string) $project['id'];
        $cards[$id] = [
            'id' => $id,
            'name' => (string) $project['name'],
            'total_revenue' => 0.0,
            'total_expenses' => 0.0,
            'net_profit' => 0.0,
            'outstanding_receivables' => 0.0,
            'outstanding_payables' => 0.0,
            'current_cash_position' => 0.0,
        ];
    }

    foreach (canonical_read_all($pdo, "
        SELECT project_id, amount, payment_date
        FROM ak_payments
        WHERE project_id IS NOT NULL
    ") as $payment) {
        $id = (string) ($payment['project_id'] ?? '');
        if (isset($cards[$id])) {
            $cards[$id]['total_revenue'] = canonical_read_money($cards[$id]['total_revenue'] + canonical_read_money($payment['amount'] ?? 0));
        }
    }
    foreach (canonical_read_all($pdo, "
        SELECT project_id, amount, expense_date
        FROM ak_expenses
        WHERE project_id IS NOT NULL
    ") as $expense) {
        $id = (string) ($expense['project_id'] ?? '');
        if (isset($cards[$id])) {
            $cards[$id]['total_expenses'] = canonical_read_money($cards[$id]['total_expenses'] + canonical_read_money($expense['amount'] ?? 0));
        }
    }

    $plans = canonical_read_all($pdo, "
        SELECT id, title, amount, paid_amount, due_date, status, customer_id, project_id, account_type
        FROM ak_payment_plans
        WHERE project_id IS NOT NULL
        ORDER BY customer_id ASC, account_type ASC, due_date ASC
    ");
    $payments = canonical_read_all($pdo, "
        SELECT customer_id, payment_plan_id, amount, account_type
        FROM ak_payments
        WHERE customer_id IS NOT NULL
    ");
    foreach (canonical_read_customer_plan_buckets($plans, $payments)['states'] ?? [] as $plan) {
        $id = (string) ($plan['project_id'] ?? '');
        if (isset($cards[$id])) {
            $cards[$id]['outstanding_receivables'] = canonical_read_money($cards[$id]['outstanding_receivables'] + canonical_read_money($plan['remaining_amount'] ?? 0));
        }
    }

    foreach (canonical_read_all($pdo, "
        SELECT project_id, amount, paid_amount, status
        FROM ak_payment_plans
        WHERE project_id IS NOT NULL
          AND customer_id IS NULL
          AND status <> 'İptal'
    ") as $plan) {
        $id = (string) ($plan['project_id'] ?? '');
        if (isset($cards[$id])) {
            $cards[$id]['outstanding_payables'] = canonical_read_money($cards[$id]['outstanding_payables'] + max(0.0, canonical_read_money($plan['amount'] ?? 0) - canonical_read_money($plan['paid_amount'] ?? 0)));
        }
    }

    foreach ($cards as &$card) {
        $card['net_profit'] = canonical_read_money($card['total_revenue'] - $card['total_expenses']);
        $card['current_cash_position'] = canonical_read_money($card['total_revenue'] - $card['total_expenses']);
        $card['negative_net_profit'] = canonical_read_money(max(0.0, -1 * $card['net_profit']));
        $card['negative_cashflow'] = canonical_read_money(max(0.0, -1 * $card['current_cash_position']));
    }
    unset($card);

    return top_financial_cards(array_values($cards), ['outstanding_receivables', 'total_revenue', 'total_expenses']);
}

function fetch_supplier_financial_cards(PDO $pdo): array
{
    $cards = [];
    foreach (canonical_read_all($pdo, "
        SELECT id, name
        FROM ak_expense_cards
        ORDER BY name ASC
    ") as $supplier) {
        $id = (string) $supplier['id'];
        $cards[$id] = [
            'id' => $id,
            'name' => (string) $supplier['name'],
            'total_purchases' => 0.0,
            'total_paid' => 0.0,
            'remaining_payable' => 0.0,
            'overdue_payable' => 0.0,
            'last_payment_date' => null,
        ];
    }

    foreach (canonical_read_all($pdo, "
        SELECT expense_card_id, amount, direction, status, entry_date
        FROM ak_financial_entries
        WHERE expense_card_id IS NOT NULL
          AND status <> 'İptal'
    ") as $entry) {
        $id = (string) ($entry['expense_card_id'] ?? '');
        if (!isset($cards[$id])) {
            continue;
        }
        $amount = canonical_read_money($entry['amount'] ?? 0);
        if (($entry['direction'] ?? null) === 'Gider') {
            $cards[$id]['total_paid'] = canonical_read_money($cards[$id]['total_paid'] + $amount);
            $cards[$id]['total_purchases'] = canonical_read_money($cards[$id]['total_purchases'] + $amount);
            $cards[$id]['last_payment_date'] = max_date($cards[$id]['last_payment_date'], (string) ($entry['entry_date'] ?? ''));
        }
    }

    $today = (new DateTimeImmutable('today'))->format('Y-m-d');
    foreach (canonical_read_all($pdo, "
        SELECT expense_card_id, amount, paid_amount, due_date, status
        FROM ak_payment_plans
        WHERE expense_card_id IS NOT NULL
          AND status <> 'İptal'
    ") as $plan) {
        $id = (string) ($plan['expense_card_id'] ?? '');
        if (!isset($cards[$id])) {
            continue;
        }
        $remaining = max(0.0, canonical_read_money($plan['amount'] ?? 0) - canonical_read_money($plan['paid_amount'] ?? 0));
        $cards[$id]['total_purchases'] = canonical_read_money($cards[$id]['total_purchases'] + canonical_read_money($plan['amount'] ?? 0));
        $cards[$id]['remaining_payable'] = canonical_read_money($cards[$id]['remaining_payable'] + $remaining);
        if ((string) ($plan['due_date'] ?? '') < $today) {
            $cards[$id]['overdue_payable'] = canonical_read_money($cards[$id]['overdue_payable'] + $remaining);
        }
    }

    return top_financial_cards(array_values($cards), ['overdue_payable', 'remaining_payable', 'total_purchases']);
}

function fetch_personnel_financial_cards(PDO $pdo): array
{
    $cards = [];
    foreach (canonical_read_all($pdo, "
        SELECT id, full_name AS name
        FROM ak_employees
        ORDER BY full_name ASC
    ") as $employee) {
        $id = (string) $employee['id'];
        $cards[$id] = [
            'id' => $id,
            'name' => (string) $employee['name'],
            'salary_paid' => 0.0,
            'advances_paid' => 0.0,
            'expense_reimbursements' => 0.0,
            'total_personnel_cost' => 0.0,
        ];
    }

    foreach (canonical_read_all($pdo, "
        SELECT employee_id, title, amount, direction, status
        FROM ak_financial_entries
        WHERE employee_id IS NOT NULL
          AND status <> 'İptal'
    ") as $entry) {
        $id = (string) ($entry['employee_id'] ?? '');
        if (!isset($cards[$id]) || ($entry['direction'] ?? null) !== 'Gider') {
            continue;
        }
        $amount = canonical_read_money($entry['amount'] ?? 0);
        $title = mb_strtolower((string) ($entry['title'] ?? ''), 'UTF-8');
        if (str_contains($title, 'avans')) {
            $cards[$id]['advances_paid'] = canonical_read_money($cards[$id]['advances_paid'] + $amount);
        } elseif (str_contains($title, 'masraf') || str_contains($title, 'iade')) {
            $cards[$id]['expense_reimbursements'] = canonical_read_money($cards[$id]['expense_reimbursements'] + $amount);
        } else {
            $cards[$id]['salary_paid'] = canonical_read_money($cards[$id]['salary_paid'] + $amount);
        }
        $cards[$id]['total_personnel_cost'] = canonical_read_money($cards[$id]['total_personnel_cost'] + $amount);
    }

    return top_financial_cards(array_values($cards), ['total_personnel_cost', 'salary_paid', 'advances_paid']);
}

function top_financial_cards(array $cards, array $sortFields): array
{
    usort($cards, static function (array $left, array $right) use ($sortFields): int {
        foreach ($sortFields as $field) {
            $compare = canonical_read_money($right[$field] ?? 0) <=> canonical_read_money($left[$field] ?? 0);
            if ($compare !== 0) {
                return $compare;
            }
        }
        return strcmp((string) ($left['name'] ?? ''), (string) ($right['name'] ?? ''));
    });

    return array_slice($cards, 0, 6);
}

function max_date(?string $left, string $right): ?string
{
    if ($right === '') {
        return $left;
    }
    if ($left === null || $right > $left) {
        return $right;
    }
    return $left;
}
