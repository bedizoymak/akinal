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
