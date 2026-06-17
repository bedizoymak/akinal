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
    $allFinancialCards = fetch_unified_financial_cards($pdo, null);
    $cashflowCommandCenter = fetch_cashflow_command_center($pdo, $financialSummary, $allFinancialCards);
    $cashflowActionCenter = fetch_cashflow_action_center($pdo, $allFinancialCards);
    $netCashForecast = fetch_net_cash_forecast($pdo, $financialSummary);
    $expenseCategoryIntelligence = fetch_expense_category_intelligence($pdo);

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
        'cashflow_command_center' => $cashflowCommandCenter,
        'net_cash_forecast' => $netCashForecast,
        'cashflow_action_center' => $cashflowActionCenter,
        'management_decision_dashboard' => fetch_management_decision_dashboard($financialSummary, $allFinancialCards, $cashflowCommandCenter, $cashflowActionCenter, $netCashForecast, $expenseCategoryIntelligence),
        'financial_drilldowns' => fetch_financial_drilldowns($pdo),
        'expense_category_intelligence' => $expenseCategoryIntelligence,
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

function fetch_unified_financial_cards(PDO $pdo, ?int $limit = 6): array
{
    return [
        'customers' => fetch_customer_financial_cards($pdo, $limit),
        'projects' => fetch_project_financial_cards($pdo, $limit),
        'suppliers' => fetch_supplier_financial_cards($pdo, $limit),
        'personnel' => fetch_personnel_financial_cards($pdo, $limit),
    ];
}

function fetch_cashflow_command_center(PDO $pdo, array $financialSummary, array $cards): array
{
    $payableState = fetch_payable_state($pdo);
    $operationalCash = fetch_combined_realized_cash_position($pdo);
    $customerCards = $cards['customers'] ?? [];
    $projectCards = $cards['projects'] ?? [];
    $supplierCards = $cards['suppliers'] ?? [];
    $personnelCards = $cards['personnel'] ?? [];

    return [
        'current_receivables' => canonical_read_money(array_sum(array_map(static fn(array $card): float => canonical_read_money($card['remaining_receivable'] ?? 0), $customerCards))),
        'current_payables' => $payableState['current_payables'],
        'net_cash_position' => $operationalCash,
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
    $paymentPriorityQueue = fetch_payment_priority_actions($pdo);
    $overduePayableActions = array_values(array_filter($paymentPriorityQueue, static fn(array $item): bool => str_contains((string) ($item['reason'] ?? ''), 'Vadesi geçmiş')));

    return [
        'critical_collections' => [
            'highest_overdue_customers' => sort_and_dedupe_action_items(array_map('action_center_customer_item', $highestOverdueCustomers)),
            'highest_outstanding_balances' => sort_and_dedupe_action_items(array_map('action_center_customer_item', $highestOutstandingBalances)),
            'collection_risk_scores' => sort_and_dedupe_action_items(array_map('action_center_customer_risk_item', $collectionRiskScores)),
        ],
        'critical_payments' => [
            'upcoming_supplier_payments' => fetch_upcoming_action_payments($pdo, 'supplier'),
            'upcoming_personnel_payments' => fetch_upcoming_action_payments($pdo, 'personnel'),
            'highest_payable_balances' => sort_and_dedupe_action_items(array_map('action_center_supplier_item', array_values(array_filter(top_financial_cards($supplierCards, ['remaining_payable', 'overdue_payable']), static fn(array $card): bool => canonical_read_money($card['remaining_payable'] ?? 0) > 0)))),
            'overdue_payable_actions' => sort_and_dedupe_action_items($overduePayableActions),
        ],
        'project_risk_list' => [
            'lowest_profitability_projects' => sort_and_dedupe_action_items(array_map('action_center_project_item', $lowestProfitability)),
            'highest_expense_projects' => sort_and_dedupe_action_items(array_map(static fn(array $card): array => action_center_project_item($card, 'total_expenses'), $highestExpenseProjects)),
            'negative_cashflow_projects' => sort_and_dedupe_action_items(array_map(static fn(array $card): array => action_center_project_item($card, 'current_cash_position'), $negativeCashflowProjects)),
        ],
        'daily_action_queue' => [
            'customers_to_contact_today' => sort_and_dedupe_action_items(array_map('action_center_customer_item', array_slice($highestOverdueCustomers ?: $highestOutstandingBalances, 0, 6))),
            'suppliers_requiring_payment_review' => fetch_upcoming_action_payments($pdo, 'supplier'),
            'projects_requiring_financial_review' => sort_and_dedupe_action_items(array_map('action_center_project_item', array_slice($negativeCashflowProjects ?: $lowestProfitability, 0, 6))),
            'payment_priority_queue' => $paymentPriorityQueue,
        ],
    ];
}

function fetch_management_decision_dashboard(array $financialSummary, array $cards, array $commandCenter, array $actionCenter, array $forecast = [], array $categoryIntelligence = []): array
{
    $customerCards = $cards['customers'] ?? [];
    $projectCards = $cards['projects'] ?? [];
    $supplierCards = $cards['suppliers'] ?? [];
    $personnelCards = $cards['personnel'] ?? [];

    $topProfitable = array_values(array_filter(
        top_financial_cards($projectCards, ['net_profit', 'total_revenue'], null),
        static fn(array $card): bool => canonical_read_money($card['net_profit'] ?? 0) > 0
    ));
    $lossMaking = array_values(array_filter(
        top_financial_cards($projectCards, ['negative_net_profit', 'total_expenses'], null),
        static fn(array $card): bool => canonical_read_money($card['net_profit'] ?? 0) < 0
    ));
    $cashWarnings = build_cash_shortage_warnings($financialSummary, $commandCenter, $forecast);
    $categoryActions = build_category_action_items($categoryIntelligence);
    $officialUnofficialActions = build_official_unofficial_action_items($forecast);

    return [
        'top_risky_customers' => sort_and_dedupe_action_items(array_map('action_center_customer_risk_item', top_financial_cards($customerCards, ['overdue_amount', 'remaining_receivable'], 6))),
        'top_overdue_collections' => $actionCenter['critical_collections']['highest_overdue_customers'] ?? [],
        'top_supplier_liabilities' => sort_and_dedupe_action_items(array_map('action_center_supplier_item', top_financial_cards($supplierCards, ['remaining_payable', 'overdue_payable'], 6))),
        'top_personnel_cost_centers' => sort_and_dedupe_action_items(array_map('management_personnel_item', top_financial_cards($personnelCards, ['total_personnel_cost', 'salary_paid'], 6))),
        'top_profitable_projects' => sort_and_dedupe_action_items(array_map('management_project_profit_item', array_slice($topProfitable, 0, 6))),
        'top_loss_making_projects' => sort_and_dedupe_action_items(array_map(static fn(array $card): array => action_center_project_item($card, 'net_profit'), array_slice($lossMaking, 0, 6))),
        'cash_shortage_warnings' => sort_and_dedupe_action_items(array_merge($cashWarnings, $officialUnofficialActions)),
        'collection_priority_queue' => $actionCenter['daily_action_queue']['customers_to_contact_today'] ?? [],
        'payment_priority_queue' => $actionCenter['daily_action_queue']['payment_priority_queue'] ?? [],
        'category_priority_queue' => $categoryActions,
        'official_unofficial_actions' => $officialUnofficialActions,
        'top_spending_categories' => array_slice($categoryIntelligence['top_spending_categories'] ?? [], 0, 6),
    ];
}

function build_cash_shortage_warnings(array $financialSummary, array $commandCenter, array $forecast = []): array
{
    $warnings = [];
    $netCash = canonical_read_money($commandCenter['net_cash_position'] ?? 0);
    $upcomingPayments = canonical_read_money($commandCenter['upcoming_payments'] ?? 0);
    $currentReceivables = canonical_read_money($commandCenter['current_receivables'] ?? 0);
    $currentPayables = canonical_read_money($commandCenter['current_payables'] ?? 0);
    $overdueCollections = canonical_read_money($financialSummary['overdue_collections'] ?? 0);

    if ($netCash - $upcomingPayments < 0) {
        $warnings[] = [
            'id' => 'cash-shortage-upcoming',
            'name' => 'Yaklaşan ödeme riski',
            'label' => 'Nakit açığı uyarısı',
            'amount' => canonical_read_money(abs($netCash - $upcomingPayments)),
            'score' => 90,
            'reason' => 'Net nakit pozisyonu yaklaşan ödemeleri karşılamıyor',
            'due_date' => '',
        ];
    }
    if ($currentPayables > $currentReceivables) {
        $warnings[] = [
            'id' => 'cash-shortage-payables',
            'name' => 'Borç/alacak dengesi',
            'label' => 'Nakit açığı uyarısı',
            'amount' => canonical_read_money($currentPayables - $currentReceivables),
            'score' => 80,
            'reason' => 'Güncel borçlar güncel alacaklardan yüksek',
            'due_date' => '',
        ];
    }
    if ($overdueCollections > 0) {
        $warnings[] = [
            'id' => 'cash-shortage-overdue',
            'name' => 'Tahsilat gecikmesi',
            'label' => 'Nakit açığı uyarısı',
            'amount' => $overdueCollections,
            'score' => 70,
            'reason' => 'Vadesi geçmiş tahsilatlar nakit akışını baskılıyor',
            'due_date' => '',
        ];
    }
    foreach (($forecast['windows'] ?? []) as $window) {
        if (canonical_read_money($window['forecast_net_cash'] ?? 0) < 0) {
            $warnings[] = [
                'id' => 'cash-forecast-' . (string) ($window['window'] ?? 'window'),
                'name' => (string) ($window['label'] ?? 'Nakit tahmini'),
                'label' => 'Nakit tahmini uyarısı',
                'amount' => canonical_read_money(abs(canonical_read_money($window['forecast_net_cash'] ?? 0))),
                'score' => 95,
                'reason' => 'Tahminlenen net nakit pozisyonu negatif',
                'due_date' => '',
            ];
        }
    }

    return sort_and_dedupe_action_items($warnings);
}

function fetch_upcoming_action_payments(PDO $pdo, string $ownerType): array
{
    $today = (new DateTimeImmutable('today'))->format('Y-m-d');
    $in30 = (new DateTimeImmutable('today'))->modify('+30 days')->format('Y-m-d');
    $ownerFilter = $ownerType === 'personnel' ? 'personnel' : 'supplier';
    $rows = array_values(array_filter(fetch_payable_obligations($pdo), static function (array $row) use ($today, $in30, $ownerFilter): bool {
        $dueDate = (string) ($row['due_date'] ?? '');
        return ($row['owner_type'] ?? '') === $ownerFilter
            && payable_obligation_remaining($row) > 0
            && $dueDate >= $today
            && $dueDate <= $in30;
    }));
    usort($rows, static function (array $left, array $right): int {
        $dateCompare = strcmp((string) ($left['due_date'] ?? ''), (string) ($right['due_date'] ?? ''));
        if ($dateCompare !== 0) {
            return $dateCompare;
        }
        return payable_obligation_remaining($right) <=> payable_obligation_remaining($left);
    });

    return sort_and_dedupe_action_items(array_map(static fn(array $row): array => payable_obligation_action_item($row), $rows));
}

function fetch_payment_priority_actions(PDO $pdo): array
{
    $rows = array_values(array_filter(fetch_payable_obligations($pdo), static fn(array $row): bool => payable_obligation_remaining($row) > 0));

    return sort_and_dedupe_action_items(array_map(static fn(array $row): array => payable_obligation_action_item($row), $rows));
}

function payable_obligation_action_item(array $row): array
{
    $remaining = payable_obligation_remaining($row);
    $dueDate = (string) ($row['due_date'] ?? '');
    $today = (new DateTimeImmutable('today'))->format('Y-m-d');
    $isOverdue = $dueDate !== '' && $dueDate < $today;
    $ownerType = (string) ($row['owner_type'] ?? 'general');

    return [
        'id' => (string) ($row['id'] ?? ''),
        'name' => (string) ($row['owner_name'] ?? 'Bağlantısız'),
        'label' => (string) ($row['title'] ?? 'Ödeme kontrolü'),
        'amount' => $remaining,
        'score' => payment_action_score($remaining, $dueDate, $isOverdue),
        'reason' => $isOverdue
            ? 'Vadesi geçmiş ödeme yükümlülüğü'
            : ($ownerType === 'personnel' ? 'Personel ödeme kontrolü' : ($ownerType === 'supplier' ? 'Tedarikçi ödeme kontrolü' : 'Genel ödeme kontrolü')),
        'due_date' => $dueDate,
    ];
}

function payment_action_score(float $amount, string $dueDate, bool $isOverdue): int
{
    $amountScore = min(40, (int) round($amount / 100000));
    if ($isOverdue) {
        return min(100, 60 + $amountScore);
    }
    if ($dueDate === '') {
        return min(100, 30 + $amountScore);
    }
    $today = new DateTimeImmutable('today');
    $due = new DateTimeImmutable($dueDate);
    $daysUntilDue = max(0, (int) $today->diff($due)->format('%a'));
    $dateScore = $daysUntilDue <= 7 ? 45 : ($daysUntilDue <= 30 ? 30 : 15);

    return min(100, $dateScore + $amountScore);
}

function build_category_action_items(array $categoryIntelligence): array
{
    $items = [];
    foreach (($categoryIntelligence['top_spending_categories'] ?? []) as $category) {
        $cashPressure = canonical_read_money($category['cash_pressure'] ?? 0);
        $totalExposure = canonical_read_money($category['total_exposure'] ?? 0);
        if ($totalExposure <= 0) {
            continue;
        }
        $items[] = [
            'id' => 'category-' . md5((string) ($category['category'] ?? 'unknown')),
            'name' => (string) ($category['category'] ?? 'Kategori'),
            'label' => 'Kategori maliyet aksiyonu',
            'amount' => $totalExposure,
            'score' => min(100, (int) round(($cashPressure > 0 ? 50 : 25) + ($totalExposure / 250000))),
            'reason' => $cashPressure > 0 ? 'Planlanan kategori nakit baskısı var' : 'Yüksek kategori gerçekleşen gideri',
            'due_date' => '',
        ];
    }

    return sort_and_dedupe_action_items($items);
}

function build_official_unofficial_action_items(array $forecast): array
{
    $items = [];
    $officialCash = canonical_read_money($forecast['official_cash_position'] ?? 0);
    $unofficialCash = canonical_read_money($forecast['unofficial_cash_position'] ?? 0);
    if ($officialCash < 0) {
        $items[] = [
            'id' => 'official-cash-negative',
            'name' => 'Resmi nakit',
            'label' => 'Resmi/gayri resmi denge',
            'amount' => abs($officialCash),
            'score' => 95,
            'reason' => 'Resmi nakit pozisyonu negatif',
            'due_date' => '',
        ];
    }
    if ($unofficialCash < 0) {
        $items[] = [
            'id' => 'unofficial-cash-negative',
            'name' => 'Gayri resmi nakit',
            'label' => 'Resmi/gayri resmi denge',
            'amount' => abs($unofficialCash),
            'score' => 95,
            'reason' => 'Gayri resmi nakit pozisyonu negatif',
            'due_date' => '',
        ];
    }
    foreach (($forecast['windows'] ?? []) as $window) {
        $windowKey = (string) ($window['window'] ?? 'window');
        $officialGap = canonical_read_money(($window['official_expected_payments'] ?? 0) - ($window['official_expected_collections'] ?? 0));
        $unofficialGap = canonical_read_money(($window['unofficial_expected_payments'] ?? 0) - ($window['unofficial_expected_collections'] ?? 0));
        if ($officialGap > max(0.0, $officialCash)) {
            $items[] = [
                'id' => 'official-gap-' . $windowKey,
                'name' => (string) ($window['label'] ?? 'Resmi pencere'),
                'label' => 'Resmi ödeme baskısı',
                'amount' => canonical_read_money($officialGap),
                'score' => 85,
                'reason' => 'Resmi beklenen ödemeler resmi tahsilat/nakit tamponunu aşıyor',
                'due_date' => '',
            ];
        }
        if ($unofficialGap > max(0.0, $unofficialCash)) {
            $items[] = [
                'id' => 'unofficial-gap-' . $windowKey,
                'name' => (string) ($window['label'] ?? 'Gayri resmi pencere'),
                'label' => 'Gayri resmi ödeme baskısı',
                'amount' => canonical_read_money($unofficialGap),
                'score' => 85,
                'reason' => 'Gayri resmi beklenen ödemeler gayri resmi tahsilat/nakit tamponunu aşıyor',
                'due_date' => '',
            ];
        }
    }

    return sort_and_dedupe_action_items($items);
}

function sort_and_dedupe_action_items(array $items, int $limit = 6): array
{
    $seen = [];
    $deduped = [];
    foreach ($items as $item) {
        $key = implode('|', [
            (string) ($item['id'] ?? ''),
            (string) ($item['label'] ?? ''),
            (string) ($item['reason'] ?? ''),
        ]);
        if (isset($seen[$key])) {
            continue;
        }
        $seen[$key] = true;
        $deduped[] = $item;
    }
    usort($deduped, static function (array $left, array $right): int {
        $scoreCompare = ((int) ($right['score'] ?? 0)) <=> ((int) ($left['score'] ?? 0));
        if ($scoreCompare !== 0) {
            return $scoreCompare;
        }
        $amountCompare = canonical_read_money($right['amount'] ?? 0) <=> canonical_read_money($left['amount'] ?? 0);
        if ($amountCompare !== 0) {
            return $amountCompare;
        }
        return strcmp((string) ($left['due_date'] ?? ''), (string) ($right['due_date'] ?? ''));
    });

    return array_slice($deduped, 0, $limit);
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
    $amount = canonical_read_money(($card['overdue_amount'] ?? 0) ?: ($card['remaining_receivable'] ?? 0));
    return [
        'id' => (string) ($card['id'] ?? ''),
        'name' => (string) ($card['name'] ?? 'Müşteri'),
        'label' => (string) ($card['payment_performance_summary'] ?? 'Tahsilat aksiyonu'),
        'amount' => $amount,
        'score' => (int) (($card['collection_risk_score'] ?? 0) ?: min(100, round(($amount / 100000) + (canonical_read_money($card['overdue_amount'] ?? 0) > 0 ? 55 : 25)))),
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
    $remaining = canonical_read_money($card['remaining_payable'] ?? 0);
    $overdue = canonical_read_money($card['overdue_payable'] ?? 0);
    return [
        'id' => (string) ($card['id'] ?? ''),
        'name' => (string) ($card['name'] ?? 'Tedarikçi'),
        'label' => 'Kalan tedarikçi borcu',
        'amount' => $remaining,
        'score' => min(100, (int) round(($overdue > 0 ? 60 : 25) + ($remaining / 100000))),
        'reason' => $overdue > 0 ? 'Vadesi geçmiş borç var' : 'Yüksek kalan borç',
        'due_date' => (string) ($card['last_payment_date'] ?? ''),
    ];
}

function action_center_project_item(array $card, string $amountField = 'net_profit'): array
{
    $amount = canonical_read_money($card[$amountField] ?? 0);
    $negativeProfit = canonical_read_money($card['net_profit'] ?? 0) < 0;
    $negativeCash = canonical_read_money($card['current_cash_position'] ?? 0) < 0;
    $expensePressure = canonical_read_money($card['total_expenses'] ?? 0);
    return [
        'id' => (string) ($card['id'] ?? ''),
        'name' => (string) ($card['name'] ?? 'Proje'),
        'label' => 'Proje finans kontrolü',
        'amount' => $amount,
        'score' => min(100, (int) round(($negativeCash ? 45 : 0) + ($negativeProfit ? 35 : 10) + ($expensePressure / 250000))),
        'reason' => $negativeCash ? 'Negatif nakit akışı' : ($negativeProfit ? 'Zarar eden proje' : 'Kârlılık/gider kontrolü'),
        'due_date' => '',
    ];
}

function management_project_profit_item(array $card): array
{
    $amount = canonical_read_money($card['net_profit'] ?? 0);
    return [
        'id' => (string) ($card['id'] ?? ''),
        'name' => (string) ($card['name'] ?? 'Proje'),
        'label' => 'Kârlı proje',
        'amount' => $amount,
        'score' => min(100, (int) round(20 + ($amount / 250000))),
        'reason' => 'Pozitif net kâr',
        'due_date' => '',
    ];
}

function management_personnel_item(array $card): array
{
    $amount = canonical_read_money($card['total_personnel_cost'] ?? 0);
    return [
        'id' => (string) ($card['id'] ?? ''),
        'name' => (string) ($card['name'] ?? 'Personel'),
        'label' => 'Personel maliyet merkezi',
        'amount' => $amount,
        'score' => min(100, (int) round(20 + ($amount / 100000))),
        'reason' => 'Toplam personel maliyeti',
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
                ORDER BY row_date ASC
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
                SELECT fe.id, pr.title AS owner_name, fe.title AS label, fe.amount, fe.entry_date AS row_date, 'Gelir' AS row_type
                FROM ak_financial_entries fe
                LEFT JOIN ak_projects pr ON pr.id = fe.project_id
                WHERE fe.project_id IS NOT NULL
                  AND fe.direction = 'Gelir'
                  AND fe.status = 'Gerçekleşti'
                ORDER BY fe.entry_date DESC, fe.created_at DESC
                LIMIT 8
            "),
            'expense_rows' => fetch_drilldown_rows($pdo, "
                SELECT fe.id, pr.title AS owner_name, fe.title AS label, fe.amount, fe.entry_date AS row_date, 'Gider' AS row_type
                FROM ak_financial_entries fe
                LEFT JOIN ak_projects pr ON pr.id = fe.project_id
                WHERE fe.project_id IS NOT NULL
                  AND fe.direction = 'Gider'
                  AND fe.status = 'Gerçekleşti'
                ORDER BY fe.entry_date DESC, fe.created_at DESC
                LIMIT 8
            "),
            'profit_components' => fetch_drilldown_rows($pdo, "
                SELECT pr.id, pr.title AS owner_name, 'Net kâr bileşeni' AS label,
                  COALESCE(pay.total_revenue, 0) - COALESCE(exp.total_expenses, 0) AS amount,
                  CURDATE() AS row_date,
                  'Kâr' AS row_type
                FROM ak_projects pr
                LEFT JOIN (SELECT project_id, SUM(amount) AS total_revenue FROM ak_financial_entries WHERE project_id IS NOT NULL AND direction = 'Gelir' AND status = 'Gerçekleşti' GROUP BY project_id) pay ON pay.project_id = pr.id
                LEFT JOIN (SELECT project_id, SUM(amount) AS total_expenses FROM ak_financial_entries WHERE project_id IS NOT NULL AND direction = 'Gider' AND status = 'Gerçekleşti' GROUP BY project_id) exp ON exp.project_id = pr.id
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
            'remaining_payable_rows' => fetch_supplier_remaining_payable_rows($pdo),
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

function fetch_expense_category_intelligence(PDO $pdo): array
{
    $categories = [];
    $ensure = static function (string $category) use (&$categories): void {
        if (!isset($categories[$category])) {
            $categories[$category] = [
                'category' => $category,
                'realized_cost' => 0.0,
                'planned_cost' => 0.0,
                'total_exposure' => 0.0,
                'cash_pressure' => 0.0,
                'profitability_impact' => 0.0,
                'official_realized_cost' => 0.0,
                'unofficial_realized_cost' => 0.0,
                'official_planned_cost' => 0.0,
                'unofficial_planned_cost' => 0.0,
                'project_linked_realized_cost' => 0.0,
                'supplier_related_cost' => 0.0,
                'personnel_related_cost' => 0.0,
                'row_count' => 0,
            ];
        }
    };

    foreach (canonical_read_all($pdo, "
        SELECT fe.amount, fe.status, fe.group_tag, fe.project_id, fe.employee_id, fe.expense_card_id,
          ec.category AS expense_card_category
        FROM ak_financial_entries fe
        LEFT JOIN ak_expense_cards ec ON ec.id = fe.expense_card_id
        WHERE fe.direction = 'Gider'
          AND fe.status = 'Gerçekleşti'
    ") as $entry) {
        $category = expense_category_for_entry($entry);
        $ensure($category);
        $amount = canonical_read_money($entry['amount'] ?? 0);
        $isUnofficial = ((string) ($entry['group_tag'] ?? 'Resmi')) === 'Gayri Resmi';
        $categories[$category]['realized_cost'] = canonical_read_money($categories[$category]['realized_cost'] + $amount);
        $categories[$category][$isUnofficial ? 'unofficial_realized_cost' : 'official_realized_cost'] = canonical_read_money($categories[$category][$isUnofficial ? 'unofficial_realized_cost' : 'official_realized_cost'] + $amount);
        $categories[$category]['row_count']++;
        if (!empty($entry['project_id'])) {
            $categories[$category]['profitability_impact'] = canonical_read_money($categories[$category]['profitability_impact'] + $amount);
            $categories[$category]['project_linked_realized_cost'] = canonical_read_money($categories[$category]['project_linked_realized_cost'] + $amount);
        }
        if (!empty($entry['expense_card_id'])) {
            $categories[$category]['supplier_related_cost'] = canonical_read_money($categories[$category]['supplier_related_cost'] + $amount);
        }
        if (!empty($entry['employee_id'])) {
            $categories[$category]['personnel_related_cost'] = canonical_read_money($categories[$category]['personnel_related_cost'] + $amount);
        }
    }

    foreach (fetch_payable_obligations($pdo) as $obligation) {
        $category = expense_category_for_entry($obligation);
        $ensure($category);
        $amount = canonical_read_money($obligation['amount'] ?? 0);
        $remaining = payable_obligation_remaining($obligation);
        $isUnofficial = ((string) ($obligation['account_type'] ?? 'resmi')) === 'gayri_resmi';
        $categories[$category]['planned_cost'] = canonical_read_money($categories[$category]['planned_cost'] + $amount);
        $categories[$category]['cash_pressure'] = canonical_read_money($categories[$category]['cash_pressure'] + $remaining);
        $categories[$category][$isUnofficial ? 'unofficial_planned_cost' : 'official_planned_cost'] = canonical_read_money($categories[$category][$isUnofficial ? 'unofficial_planned_cost' : 'official_planned_cost'] + $amount);
    }

    foreach ($categories as &$category) {
        $category['total_exposure'] = canonical_read_money($category['realized_cost'] + $category['planned_cost']);
    }
    unset($category);

    $rows = array_values($categories);
    usort($rows, static fn(array $left, array $right): int => canonical_read_money($right['total_exposure'] ?? 0) <=> canonical_read_money($left['total_exposure'] ?? 0));
    $uncategorized = array_values(array_filter($rows, static fn(array $row): bool => ($row['category'] ?? '') === 'Diğer / Kategorisiz'));

    return [
        'categories' => $rows,
        'top_spending_categories' => array_slice($rows, 0, 8),
        'uncategorized' => $uncategorized,
        'summary' => [
            'realized_cost_total' => canonical_read_money(array_sum(array_map(static fn(array $row): float => canonical_read_money($row['realized_cost'] ?? 0), $rows))),
            'planned_cost_total' => canonical_read_money(array_sum(array_map(static fn(array $row): float => canonical_read_money($row['planned_cost'] ?? 0), $rows))),
            'cash_pressure_total' => canonical_read_money(array_sum(array_map(static fn(array $row): float => canonical_read_money($row['cash_pressure'] ?? 0), $rows))),
            'profitability_impact_total' => canonical_read_money(array_sum(array_map(static fn(array $row): float => canonical_read_money($row['profitability_impact'] ?? 0), $rows))),
            'uncategorized_count' => count($uncategorized),
            'category_count' => count($rows),
        ],
    ];
}

function expense_category_for_entry(array $row): string
{
    if (!empty($row['employee_id']) || ($row['owner_type'] ?? '') === 'personnel') {
        return 'Personel';
    }

    $category = trim((string) ($row['expense_card_category'] ?? $row['category'] ?? ''));
    if ($category !== '') {
        return $category;
    }

    if (!empty($row['expense_card_id']) || ($row['owner_type'] ?? '') === 'supplier') {
        return 'Tedarikçi / Malzeme';
    }

    return 'Diğer / Kategorisiz';
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

function fetch_supplier_remaining_payable_rows(PDO $pdo): array
{
    $rows = array_values(array_filter(fetch_payable_obligations($pdo), static function (array $row): bool {
        return ($row['owner_type'] ?? '') === 'supplier' && payable_obligation_remaining($row) > 0;
    }));
    usort($rows, static function (array $left, array $right): int {
        $dateCompare = strcmp((string) ($left['due_date'] ?? ''), (string) ($right['due_date'] ?? ''));
        if ($dateCompare !== 0) {
            return $dateCompare;
        }
        return payable_obligation_remaining($right) <=> payable_obligation_remaining($left);
    });

    return array_map(static fn(array $row): array => [
        'id' => (string) ($row['id'] ?? ''),
        'owner_name' => (string) ($row['owner_name'] ?? 'Bağlantısız'),
        'label' => (string) ($row['title'] ?? 'Kalan borç'),
        'amount' => payable_obligation_remaining($row),
        'row_date' => (string) ($row['due_date'] ?? ''),
        'row_type' => ($row['source_type'] ?? '') === 'financial_entry' ? 'Planlanan Borç' : 'Kalan Borç',
    ], array_slice($rows, 0, 8));
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

    foreach (fetch_payable_obligations($pdo) as $plan) {
        $remaining = payable_obligation_remaining($plan);
        $state['current_payables'] = canonical_read_money($state['current_payables'] + $remaining);
        $dueDate = (string) ($plan['due_date'] ?? '');
        if ($dueDate >= $today && $dueDate <= $in30) {
            $state['upcoming_payments'] = canonical_read_money($state['upcoming_payments'] + $remaining);
        }
    }

    return $state;
}

function fetch_net_cash_forecast(PDO $pdo, array $financialSummary): array
{
    $officialCash = sum_entry_balance_by_group($pdo, 'Resmi');
    $unofficialCash = sum_entry_balance_by_group($pdo, 'Gayri Resmi');
    $availableCash = canonical_read_money($officialCash + $unofficialCash);
    $receivables = fetch_receivable_obligations($pdo);
    $payables = fetch_payable_obligations($pdo);
    $today = new DateTimeImmutable('today');
    $overdueCollections = sum_due_obligations($receivables, null, true);
    $overduePayables = sum_due_obligations($payables, null, true);
    $currentPayables = sum_remaining_obligations($payables);
    $windows = [
        ['key' => 'immediate', 'label' => 'Bugün / acil', 'days' => 0],
        ['key' => '7_days', 'label' => '7 gün', 'days' => 7],
        ['key' => '30_days', 'label' => '30 gün', 'days' => 30],
        ['key' => '60_days', 'label' => '60 gün', 'days' => 60],
    ];

    return [
        'available_cash' => $availableCash,
        'current_payables' => $currentPayables,
        'overdue_collections' => $overdueCollections,
        'overdue_payables' => $overduePayables,
        'official_cash_position' => $officialCash,
        'unofficial_cash_position' => $unofficialCash,
        'combined_operational_cash_position' => $availableCash,
        'windows' => array_map(static function (array $window) use ($receivables, $payables, $availableCash, $currentPayables, $overduePayables, $today): array {
            $endDate = $today->modify('+' . (int) $window['days'] . ' days');
            $expectedCollections = sum_due_obligations($receivables, $endDate, false);
            $expectedPayments = sum_due_obligations($payables, $endDate, false);
            $officialCollections = sum_due_obligations($receivables, $endDate, false, 'resmi');
            $unofficialCollections = sum_due_obligations($receivables, $endDate, false, 'gayri_resmi');
            $officialPayments = sum_due_obligations($payables, $endDate, false, 'resmi');
            $unofficialPayments = sum_due_obligations($payables, $endDate, false, 'gayri_resmi');
            $forecastNet = canonical_read_money($availableCash + $expectedCollections - $currentPayables - $expectedPayments);
            $riskAdjusted = canonical_read_money($availableCash + ($expectedCollections * 0.7) - $overduePayables - $expectedPayments);

            return [
                'window' => $window['key'],
                'label' => $window['label'],
                'days' => (int) $window['days'],
                'expected_collections' => $expectedCollections,
                'expected_payments' => $expectedPayments,
                'overdue_payables' => $overduePayables,
                'forecast_net_cash' => $forecastNet,
                'risk_adjusted_forecast' => $riskAdjusted,
                'official_expected_collections' => $officialCollections,
                'unofficial_expected_collections' => $unofficialCollections,
                'official_expected_payments' => $officialPayments,
                'unofficial_expected_payments' => $unofficialPayments,
                'negative_forecast_cash' => $forecastNet < 0,
            ];
        }, $windows),
    ];
}

function fetch_combined_realized_cash_position(PDO $pdo): float
{
    return canonical_read_money(sum_entry_balance_by_group($pdo, 'Resmi') + sum_entry_balance_by_group($pdo, 'Gayri Resmi'));
}

function fetch_receivable_obligations(PDO $pdo): array
{
    $plans = canonical_read_all($pdo, "
        SELECT id, title, amount, paid_amount, due_date, status, customer_id, project_id, account_type
        FROM ak_payment_plans
        WHERE customer_id IS NOT NULL
          AND status <> 'İptal'
        ORDER BY customer_id ASC, account_type ASC, due_date ASC
    ");
    $payments = canonical_read_all($pdo, "
        SELECT customer_id, payment_plan_id, amount, account_type
        FROM ak_payments
        WHERE customer_id IS NOT NULL
    ");
    return array_map(static fn(array $plan): array => [
        'id' => (string) ($plan['id'] ?? ''),
        'title' => (string) ($plan['title'] ?? 'Tahsilat'),
        'amount' => canonical_read_money($plan['amount'] ?? 0),
        'paid_amount' => canonical_read_money($plan['paid_amount'] ?? 0),
        'remaining_amount' => canonical_read_money($plan['remaining_amount'] ?? 0),
        'due_date' => (string) ($plan['due_date'] ?? ''),
        'project_id' => $plan['project_id'] ?? null,
        'account_type' => (string) ($plan['account_type'] ?? 'resmi'),
    ], canonical_read_customer_plan_buckets($plans, $payments)['states'] ?? []);
}

function sum_remaining_obligations(array $rows): float
{
    return canonical_read_money(array_reduce($rows, static fn(float $sum, array $row): float => $sum + payable_obligation_remaining($row), 0.0));
}

function sum_due_obligations(array $rows, ?DateTimeImmutable $endDate, bool $overdueOnly, ?string $accountType = null): float
{
    $today = new DateTimeImmutable('today');
    $sum = 0.0;
    foreach ($rows as $row) {
        if ($accountType !== null && (string) ($row['account_type'] ?? 'resmi') !== $accountType) {
            continue;
        }
        $dueDateValue = (string) ($row['due_date'] ?? '');
        $dueDate = DateTimeImmutable::createFromFormat('!Y-m-d', $dueDateValue);
        if (!$dueDate) {
            continue;
        }
        if ($overdueOnly && $dueDate >= $today) {
            continue;
        }
        if (!$overdueOnly && ($dueDate < $today || ($endDate !== null && $dueDate > $endDate))) {
            continue;
        }
        $sum += isset($row['remaining_amount'])
            ? canonical_read_money($row['remaining_amount'] ?? 0)
            : payable_obligation_remaining($row);
    }

    return canonical_read_money($sum);
}

function sum_entry_balance_by_group(PDO $pdo, string $groupTag): float
{
    $row = fetch_one($pdo, "
        SELECT COALESCE(SUM(CASE WHEN direction = 'Gelir' THEN amount ELSE -amount END), 0) AS total
        FROM ak_financial_entries
        WHERE status = 'Gerçekleşti'
          AND group_tag = " . $pdo->quote($groupTag) . "
    ");

    return canonical_read_money($row['total'] ?? 0);
}

function fetch_payable_obligations(PDO $pdo): array
{
    $plans = canonical_read_all($pdo, "
        SELECT pp.id, pp.title, pp.amount, pp.paid_amount, pp.due_date, pp.status, pp.project_id, pp.employee_id, pp.expense_card_id, pp.account_type,
          emp.full_name AS employee_name,
          ec.name AS expense_card_name,
          ec.category AS expense_card_category
        FROM ak_payment_plans pp
        LEFT JOIN ak_employees emp ON emp.id = pp.employee_id
        LEFT JOIN ak_expense_cards ec ON ec.id = pp.expense_card_id
        WHERE pp.customer_id IS NULL
          AND pp.status <> 'İptal'
    ");
    $obligations = [];
    $planSignatures = [];
    foreach ($plans as $plan) {
        $ownerType = payable_owner_type($plan);
        $ownerName = $ownerType === 'personnel'
            ? (string) ($plan['employee_name'] ?? 'Personel')
            : (string) ($plan['expense_card_name'] ?? 'Gider');
        $row = [
            'id' => 'plan-' . (string) ($plan['id'] ?? ''),
            'source_type' => 'payment_plan',
            'title' => (string) ($plan['title'] ?? 'Ödeme planı'),
            'amount' => canonical_read_money($plan['amount'] ?? 0),
            'paid_amount' => canonical_read_money($plan['paid_amount'] ?? 0),
            'due_date' => (string) ($plan['due_date'] ?? ''),
            'project_id' => $plan['project_id'] ?? null,
            'employee_id' => $plan['employee_id'] ?? null,
            'expense_card_id' => $plan['expense_card_id'] ?? null,
            'account_type' => (string) ($plan['account_type'] ?? 'resmi'),
            'owner_type' => $ownerType,
            'owner_name' => $ownerName,
            'expense_card_category' => $plan['expense_card_category'] ?? null,
        ];
        $planSignatures[payable_obligation_signature($row)] = true;
        $obligations[] = $row;
    }

    foreach (canonical_read_all($pdo, "
        SELECT fe.id, fe.title, fe.amount, fe.entry_date, fe.project_id, fe.employee_id, fe.expense_card_id, fe.group_tag,
          emp.full_name AS employee_name,
          ec.name AS expense_card_name,
          ec.category AS expense_card_category
        FROM ak_financial_entries fe
        LEFT JOIN ak_employees emp ON emp.id = fe.employee_id
        LEFT JOIN ak_expense_cards ec ON ec.id = fe.expense_card_id
        WHERE fe.direction = 'Gider'
          AND fe.status = 'Planlandı'
    ") as $entry) {
        $ownerType = payable_owner_type($entry);
        $ownerName = $ownerType === 'personnel'
            ? (string) ($entry['employee_name'] ?? 'Personel')
            : (string) ($entry['expense_card_name'] ?? 'Gider');
        $row = [
            'id' => 'entry-' . (string) ($entry['id'] ?? ''),
            'source_type' => 'financial_entry',
            'title' => (string) ($entry['title'] ?? 'Planlanan gider'),
            'amount' => canonical_read_money($entry['amount'] ?? 0),
            'paid_amount' => 0.0,
            'due_date' => (string) ($entry['entry_date'] ?? ''),
            'project_id' => $entry['project_id'] ?? null,
            'employee_id' => $entry['employee_id'] ?? null,
            'expense_card_id' => $entry['expense_card_id'] ?? null,
            'account_type' => ((string) ($entry['group_tag'] ?? 'Resmi')) === 'Gayri Resmi' ? 'gayri_resmi' : 'resmi',
            'owner_type' => $ownerType,
            'owner_name' => $ownerName,
            'expense_card_category' => $entry['expense_card_category'] ?? null,
        ];
        if (!isset($planSignatures[payable_obligation_signature($row)])) {
            $obligations[] = $row;
        }
    }

    return $obligations;
}

function payable_owner_type(array $row): string
{
    if (!empty($row['employee_id'])) {
        return 'personnel';
    }
    if (!empty($row['expense_card_id'])) {
        return 'supplier';
    }
    return 'general';
}

function payable_obligation_signature(array $row): string
{
    return implode('|', [
        payable_owner_type($row),
        (string) ($row['employee_id'] ?? ''),
        (string) ($row['expense_card_id'] ?? ''),
        (string) ($row['project_id'] ?? ''),
        (string) canonical_read_money($row['amount'] ?? 0),
        (string) ($row['due_date'] ?? ''),
        (string) ($row['account_type'] ?? ''),
    ]);
}

function payable_obligation_remaining(array $row): float
{
    return canonical_read_money(max(0.0, canonical_read_money($row['amount'] ?? 0) - canonical_read_money($row['paid_amount'] ?? 0)));
}

function fetch_customer_financial_cards(PDO $pdo, ?int $limit = 6): array
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
            'official_contract_value' => 0.0,
            'unofficial_contract_value' => 0.0,
            'official_collected' => 0.0,
            'unofficial_collected' => 0.0,
            'official_remaining_receivable' => 0.0,
            'unofficial_remaining_receivable' => 0.0,
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
        $isUnofficial = ((string) ($plan['account_type'] ?? 'resmi')) === 'gayri_resmi';
        $cards[$customerId]['total_contract_value'] = canonical_read_money($cards[$customerId]['total_contract_value'] + $amount);
        $cards[$customerId]['total_collected'] = canonical_read_money($cards[$customerId]['total_collected'] + $paid);
        $cards[$customerId]['remaining_receivable'] = canonical_read_money($cards[$customerId]['remaining_receivable'] + $remaining);
        $cards[$customerId][$isUnofficial ? 'unofficial_contract_value' : 'official_contract_value'] = canonical_read_money($cards[$customerId][$isUnofficial ? 'unofficial_contract_value' : 'official_contract_value'] + $amount);
        $cards[$customerId][$isUnofficial ? 'unofficial_collected' : 'official_collected'] = canonical_read_money($cards[$customerId][$isUnofficial ? 'unofficial_collected' : 'official_collected'] + $paid);
        $cards[$customerId][$isUnofficial ? 'unofficial_remaining_receivable' : 'official_remaining_receivable'] = canonical_read_money($cards[$customerId][$isUnofficial ? 'unofficial_remaining_receivable' : 'official_remaining_receivable'] + $remaining);
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
    }, array_values($cards)), ['overdue_amount', 'remaining_receivable', 'total_contract_value'], $limit);
}

function fetch_project_financial_cards(PDO $pdo, ?int $limit = 6): array
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
            'cash_exposure' => 0.0,
            'official_project_revenue' => 0.0,
            'unofficial_project_revenue' => 0.0,
            'official_project_expenses' => 0.0,
            'unofficial_project_expenses' => 0.0,
            'official_project_profit' => 0.0,
            'unofficial_project_profit' => 0.0,
            'combined_project_profit' => 0.0,
            'official_project_cash_exposure' => 0.0,
            'unofficial_project_cash_exposure' => 0.0,
            'combined_project_cash_exposure' => 0.0,
        ];
    }

    foreach (canonical_read_all($pdo, "
        SELECT project_id, amount, direction, group_tag
        FROM ak_financial_entries
        WHERE project_id IS NOT NULL
          AND status = 'Gerçekleşti'
    ") as $entry) {
        $id = (string) ($entry['project_id'] ?? '');
        if (isset($cards[$id])) {
            $amount = canonical_read_money($entry['amount'] ?? 0);
            $isUnofficial = ((string) ($entry['group_tag'] ?? 'Resmi')) === 'Gayri Resmi';
            if (($entry['direction'] ?? null) === 'Gelir') {
                $cards[$id]['total_revenue'] = canonical_read_money($cards[$id]['total_revenue'] + $amount);
                $field = $isUnofficial ? 'unofficial_project_revenue' : 'official_project_revenue';
                $cards[$id][$field] = canonical_read_money($cards[$id][$field] + $amount);
            } elseif (($entry['direction'] ?? null) === 'Gider') {
                $cards[$id]['total_expenses'] = canonical_read_money($cards[$id]['total_expenses'] + $amount);
                $field = $isUnofficial ? 'unofficial_project_expenses' : 'official_project_expenses';
                $cards[$id][$field] = canonical_read_money($cards[$id][$field] + $amount);
            }
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
            $remaining = canonical_read_money($plan['remaining_amount'] ?? 0);
            $cards[$id]['outstanding_receivables'] = canonical_read_money($cards[$id]['outstanding_receivables'] + $remaining);
            $field = ((string) ($plan['account_type'] ?? 'resmi')) === 'gayri_resmi'
                ? 'unofficial_project_cash_exposure'
                : 'official_project_cash_exposure';
            $cards[$id][$field] = canonical_read_money($cards[$id][$field] + $remaining);
        }
    }

    foreach (fetch_payable_obligations($pdo) as $plan) {
        $id = (string) ($plan['project_id'] ?? '');
        if (isset($cards[$id])) {
            $remaining = payable_obligation_remaining($plan);
            $cards[$id]['outstanding_payables'] = canonical_read_money($cards[$id]['outstanding_payables'] + $remaining);
            $field = ((string) ($plan['account_type'] ?? 'resmi')) === 'gayri_resmi'
                ? 'unofficial_project_cash_exposure'
                : 'official_project_cash_exposure';
            $cards[$id][$field] = canonical_read_money($cards[$id][$field] - $remaining);
        }
    }

    foreach ($cards as &$card) {
        $card['net_profit'] = canonical_read_money($card['total_revenue'] - $card['total_expenses']);
        $card['cash_exposure'] = canonical_read_money($card['outstanding_receivables'] - $card['outstanding_payables']);
        $card['current_cash_position'] = canonical_read_money($card['net_profit'] + $card['cash_exposure']);
        $card['official_project_profit'] = canonical_read_money($card['official_project_revenue'] - $card['official_project_expenses']);
        $card['unofficial_project_profit'] = canonical_read_money($card['unofficial_project_revenue'] - $card['unofficial_project_expenses']);
        $card['combined_project_profit'] = $card['net_profit'];
        $card['combined_project_cash_exposure'] = $card['cash_exposure'];
        $card['negative_net_profit'] = canonical_read_money(max(0.0, -1 * $card['net_profit']));
        $card['negative_cashflow'] = canonical_read_money(max(0.0, -1 * $card['current_cash_position']));
    }
    unset($card);

    return top_financial_cards(array_values($cards), ['outstanding_receivables', 'total_revenue', 'total_expenses'], $limit);
}

function fetch_supplier_financial_cards(PDO $pdo, ?int $limit = 6): array
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
            'official_total_paid' => 0.0,
            'unofficial_total_paid' => 0.0,
            'official_remaining_payable' => 0.0,
            'unofficial_remaining_payable' => 0.0,
        ];
    }

    foreach (canonical_read_all($pdo, "
        SELECT expense_card_id, amount, direction, status, entry_date, group_tag
        FROM ak_financial_entries
        WHERE expense_card_id IS NOT NULL
          AND status = 'Gerçekleşti'
    ") as $entry) {
        $id = (string) ($entry['expense_card_id'] ?? '');
        if (!isset($cards[$id])) {
            continue;
        }
        $amount = canonical_read_money($entry['amount'] ?? 0);
        if (($entry['direction'] ?? null) === 'Gider') {
            $isUnofficial = ((string) ($entry['group_tag'] ?? 'Resmi')) === 'Gayri Resmi';
            $cards[$id]['total_paid'] = canonical_read_money($cards[$id]['total_paid'] + $amount);
            $cards[$id]['total_purchases'] = canonical_read_money($cards[$id]['total_purchases'] + $amount);
            $cards[$id][$isUnofficial ? 'unofficial_total_paid' : 'official_total_paid'] = canonical_read_money($cards[$id][$isUnofficial ? 'unofficial_total_paid' : 'official_total_paid'] + $amount);
            $cards[$id]['last_payment_date'] = max_date($cards[$id]['last_payment_date'], (string) ($entry['entry_date'] ?? ''));
        }
    }

    $today = (new DateTimeImmutable('today'))->format('Y-m-d');
    foreach (fetch_payable_obligations($pdo) as $plan) {
        $id = (string) ($plan['expense_card_id'] ?? '');
        if (!isset($cards[$id])) {
            continue;
        }
        $remaining = payable_obligation_remaining($plan);
        $isUnofficial = ((string) ($plan['account_type'] ?? 'resmi')) === 'gayri_resmi';
        $cards[$id]['total_purchases'] = canonical_read_money($cards[$id]['total_purchases'] + canonical_read_money($plan['amount'] ?? 0));
        $cards[$id]['remaining_payable'] = canonical_read_money($cards[$id]['remaining_payable'] + $remaining);
        $cards[$id][$isUnofficial ? 'unofficial_remaining_payable' : 'official_remaining_payable'] = canonical_read_money($cards[$id][$isUnofficial ? 'unofficial_remaining_payable' : 'official_remaining_payable'] + $remaining);
        if ((string) ($plan['due_date'] ?? '') < $today) {
            $cards[$id]['overdue_payable'] = canonical_read_money($cards[$id]['overdue_payable'] + $remaining);
        }
    }

    return top_financial_cards(array_values($cards), ['overdue_payable', 'remaining_payable', 'total_purchases'], $limit);
}

function fetch_personnel_financial_cards(PDO $pdo, ?int $limit = 6): array
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
            'remaining_payable' => 0.0,
            'overdue_payable' => 0.0,
            'official_total_personnel_cost' => 0.0,
            'unofficial_total_personnel_cost' => 0.0,
            'official_remaining_payable' => 0.0,
            'unofficial_remaining_payable' => 0.0,
        ];
    }

    foreach (canonical_read_all($pdo, "
        SELECT employee_id, title, amount, direction, status, group_tag
        FROM ak_financial_entries
        WHERE employee_id IS NOT NULL
          AND status = 'Gerçekleşti'
    ") as $entry) {
        $id = (string) ($entry['employee_id'] ?? '');
        if (!isset($cards[$id]) || ($entry['direction'] ?? null) !== 'Gider') {
            continue;
        }
        $amount = canonical_read_money($entry['amount'] ?? 0);
        $isUnofficial = ((string) ($entry['group_tag'] ?? 'Resmi')) === 'Gayri Resmi';
        $title = mb_strtolower((string) ($entry['title'] ?? ''), 'UTF-8');
        if (str_contains($title, 'avans')) {
            $cards[$id]['advances_paid'] = canonical_read_money($cards[$id]['advances_paid'] + $amount);
        } elseif (str_contains($title, 'masraf') || str_contains($title, 'iade')) {
            $cards[$id]['expense_reimbursements'] = canonical_read_money($cards[$id]['expense_reimbursements'] + $amount);
        } else {
            $cards[$id]['salary_paid'] = canonical_read_money($cards[$id]['salary_paid'] + $amount);
        }
        $cards[$id]['total_personnel_cost'] = canonical_read_money($cards[$id]['total_personnel_cost'] + $amount);
        $cards[$id][$isUnofficial ? 'unofficial_total_personnel_cost' : 'official_total_personnel_cost'] = canonical_read_money($cards[$id][$isUnofficial ? 'unofficial_total_personnel_cost' : 'official_total_personnel_cost'] + $amount);
    }

    $today = (new DateTimeImmutable('today'))->format('Y-m-d');
    foreach (fetch_payable_obligations($pdo) as $plan) {
        $id = (string) ($plan['employee_id'] ?? '');
        if (!isset($cards[$id])) {
            continue;
        }
        $remaining = payable_obligation_remaining($plan);
        $isUnofficial = ((string) ($plan['account_type'] ?? 'resmi')) === 'gayri_resmi';
        $cards[$id]['remaining_payable'] = canonical_read_money($cards[$id]['remaining_payable'] + $remaining);
        $cards[$id]['total_personnel_cost'] = canonical_read_money($cards[$id]['total_personnel_cost'] + $remaining);
        $cards[$id][$isUnofficial ? 'unofficial_remaining_payable' : 'official_remaining_payable'] = canonical_read_money($cards[$id][$isUnofficial ? 'unofficial_remaining_payable' : 'official_remaining_payable'] + $remaining);
        if ((string) ($plan['due_date'] ?? '') < $today) {
            $cards[$id]['overdue_payable'] = canonical_read_money($cards[$id]['overdue_payable'] + $remaining);
        }
    }

    return top_financial_cards(array_values($cards), ['total_personnel_cost', 'salary_paid', 'advances_paid'], $limit);
}

function top_financial_cards(array $cards, array $sortFields, ?int $limit = 6): array
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

    return $limit === null ? $cards : array_slice($cards, 0, $limit);
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
