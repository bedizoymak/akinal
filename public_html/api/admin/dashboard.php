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

    $activeProjects = $pdo->query("
        SELECT id, title, project_status, location, is_published, slug, sort_order
        FROM ak_projects
        WHERE project_status <> 'Tamamlandı'
        ORDER BY sort_order ASC, created_at DESC
        LIMIT 6
    ")->fetchAll();

    $totalPayments = (float) ($paymentStats['total_payments'] ?? 0);
    $totalExpenses = (float) ($expenseStats['total_expenses'] ?? 0);

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
        ],
        'active_projects_list' => $activeProjects ?: [],
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
