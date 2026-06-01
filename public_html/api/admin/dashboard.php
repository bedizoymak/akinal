<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

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
    $paymentStats = fetch_one($pdo, 'SELECT COALESCE(SUM(amount), 0) AS total_payments FROM ak_payments');
    $expenseStats = fetch_one($pdo, 'SELECT COALESCE(SUM(amount), 0) AS total_expenses FROM ak_expenses');
    $ledgerTotals = fetch_one($pdo, "
        SELECT
          COUNT(*) AS entry_count,
          COALESCE(SUM(CASE WHEN currency_tag = 'TRY' AND status = 'Gerçekleşti' AND direction = 'Gelir' THEN amount ELSE 0 END), 0) AS realized_income_try,
          COALESCE(SUM(CASE WHEN currency_tag = 'TRY' AND status = 'Gerçekleşti' AND direction = 'Gider' THEN amount ELSE 0 END), 0) AS realized_expense_try,
          COALESCE(SUM(CASE WHEN currency_tag = 'TRY' AND status = 'Planlandı' AND direction = 'Gelir' THEN amount ELSE 0 END), 0) AS planned_income_try,
          COALESCE(SUM(CASE WHEN currency_tag = 'TRY' AND status = 'Gerçekleşti' AND direction = 'Gelir' AND entry_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN amount ELSE 0 END), 0) AS month_income_try,
          COALESCE(SUM(CASE WHEN currency_tag = 'TRY' AND status = 'Gerçekleşti' AND direction = 'Gider' AND entry_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN amount ELSE 0 END), 0) AS month_expense_try
        FROM ak_financial_entries
        WHERE status <> 'İptal'
    ");

    $activeProjects = $pdo->query("
        SELECT id, title, project_status, location, is_published, slug, sort_order
        FROM ak_projects
        WHERE project_status <> 'Tamamlandı'
        ORDER BY sort_order ASC, created_at DESC
        LIMIT 6
    ")->fetchAll();

    $overduePlans = $pdo->query("
        SELECT
          pp.id,
          pp.title,
          pp.amount,
          pp.due_date,
          pp.status,
          pp.customer_id,
          pp.project_id,
          COALESCE(SUM(p.amount), 0) AS paid_amount,
          GREATEST(pp.amount - COALESCE(SUM(p.amount), 0), 0) AS remaining_amount,
          COALESCE(c.company_name, c.full_name) AS customer_name,
          pr.title AS project_title
        FROM ak_payment_plans pp
        LEFT JOIN ak_payments p ON p.payment_plan_id = pp.id
        LEFT JOIN ak_customers c ON c.id = pp.customer_id
        LEFT JOIN ak_projects pr ON pr.id = pp.project_id
        WHERE pp.due_date < CURDATE()
          AND pp.status NOT IN ('Ödendi', 'İptal')
        GROUP BY pp.id, pp.title, pp.amount, pp.due_date, pp.status, pp.customer_id, pp.project_id, c.company_name, c.full_name, pr.title
        HAVING remaining_amount > 0
        ORDER BY pp.due_date ASC
        LIMIT 8
    ")->fetchAll();

    $upcomingPlans = $pdo->query("
        SELECT
          pp.id,
          pp.title,
          pp.amount,
          pp.due_date,
          pp.status,
          pp.customer_id,
          pp.project_id,
          COALESCE(SUM(p.amount), 0) AS paid_amount,
          GREATEST(pp.amount - COALESCE(SUM(p.amount), 0), 0) AS remaining_amount,
          COALESCE(c.company_name, c.full_name) AS customer_name,
          pr.title AS project_title
        FROM ak_payment_plans pp
        LEFT JOIN ak_payments p ON p.payment_plan_id = pp.id
        LEFT JOIN ak_customers c ON c.id = pp.customer_id
        LEFT JOIN ak_projects pr ON pr.id = pp.project_id
        WHERE pp.due_date >= CURDATE()
          AND pp.due_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
          AND pp.status NOT IN ('Ödendi', 'İptal')
        GROUP BY pp.id, pp.title, pp.amount, pp.due_date, pp.status, pp.customer_id, pp.project_id, c.company_name, c.full_name, pr.title
        HAVING remaining_amount > 0
        ORDER BY pp.due_date ASC
        LIMIT 8
    ")->fetchAll();

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
            'Resmi' AS `group`,
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

    $monthlyFinancials = $pdo->query("
        SELECT
          DATE_FORMAT(finance_date, '%Y-%m') AS month_key,
          COALESCE(SUM(CASE WHEN direction = 'Gelir' THEN amount ELSE 0 END), 0) AS income,
          COALESCE(SUM(CASE WHEN direction = 'Gider' THEN amount ELSE 0 END), 0) AS expenses
        FROM (
          SELECT entry_date AS finance_date, direction, amount
          FROM ak_financial_entries
          WHERE status = 'Gerçekleşti'
            AND currency_tag = 'TRY'
            AND entry_date >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 5 MONTH), '%Y-%m-01')
          UNION ALL
          SELECT payment_date AS finance_date, 'Gelir' AS direction, amount
          FROM ak_payments
          WHERE payment_date >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 5 MONTH), '%Y-%m-01')
          UNION ALL
          SELECT expense_date AS finance_date, 'Gider' AS direction, amount
          FROM ak_expenses
          WHERE expense_date >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 5 MONTH), '%Y-%m-01')
        ) finance_rows
        GROUP BY DATE_FORMAT(finance_date, '%Y-%m')
        ORDER BY month_key ASC
    ")->fetchAll();

    $hasLedgerEntries = (int) ($ledgerTotals['entry_count'] ?? 0) > 0;
    $totalPayments = ($hasLedgerEntries ? (float) ($ledgerTotals['realized_income_try'] ?? 0) : 0.0) + (float) ($paymentStats['total_payments'] ?? 0);
    $totalExpenses = ($hasLedgerEntries ? (float) ($ledgerTotals['realized_expense_try'] ?? 0) : 0.0) + (float) ($expenseStats['total_expenses'] ?? 0);
    $monthPaymentStats = fetch_one($pdo, "SELECT COALESCE(SUM(amount), 0) AS month_income FROM ak_payments WHERE payment_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')");
    $monthIncome = (float) ($ledgerTotals['month_income_try'] ?? 0) + (float) ($monthPaymentStats['month_income'] ?? 0);
    $monthExpenseStats = fetch_one($pdo, "SELECT COALESCE(SUM(amount), 0) AS month_expenses FROM ak_expenses WHERE expense_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')");
    $monthExpenses = (float) ($ledgerTotals['month_expense_try'] ?? 0) + (float) ($monthExpenseStats['month_expenses'] ?? 0);
    $overdueCollections = array_reduce($overduePlans ?: [], static function (float $sum, array $plan): float {
        return $sum + (float) ($plan['remaining_amount'] ?? 0);
    }, 0.0);
    $expectedPayments = array_reduce($upcomingPlans ?: [], static function (float $sum, array $plan): float {
        return $sum + (float) ($plan['remaining_amount'] ?? 0);
    }, 0.0);

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
            'total_payments' => $totalPayments,
            'total_expenses' => $totalExpenses,
            'basic_net_balance' => $totalPayments - $totalExpenses,
            'planned_income' => (float) ($ledgerTotals['planned_income_try'] ?? 0),
            'month_income' => $monthIncome,
            'month_expenses' => $monthExpenses,
            'month_net' => $monthIncome - $monthExpenses,
            'overdue_collections' => $overdueCollections,
            'expected_payments' => $expectedPayments,
            'financial_entry_count' => (int) ($ledgerTotals['entry_count'] ?? 0),
        ],
        'active_projects_list' => $activeProjects ?: [],
        'overdue_plans' => $overduePlans ?: [],
        'upcoming_plans' => $upcomingPlans ?: [],
        'recent_movements' => $recentMovements ?: [],
        'monthly_financials' => array_map(static function (array $row): array {
            $income = (float) ($row['income'] ?? 0);
            $expenses = (float) ($row['expenses'] ?? 0);
            return [
                'month_key' => (string) ($row['month_key'] ?? ''),
                'income' => $income,
                'expenses' => $expenses,
                'net' => $income - $expenses,
            ];
        }, $monthlyFinancials ?: []),
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
