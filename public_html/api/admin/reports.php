<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

require_admin();
require_method('GET');

try {
    json_success([
        'customers' => fetch_all_reports('SELECT * FROM ak_customers ORDER BY created_at DESC'),
        'payment_plans' => fetch_all_reports('SELECT * FROM ak_payment_plans ORDER BY due_date ASC'),
        'payments' => fetch_all_reports('SELECT * FROM ak_payments ORDER BY payment_date DESC'),
        'expenses' => fetch_all_reports('SELECT * FROM ak_expenses ORDER BY expense_date DESC'),
        'financial_entries' => fetch_all_reports('SELECT * FROM ak_financial_entries ORDER BY entry_date DESC, created_at DESC'),
        'projects' => fetch_all_reports('SELECT * FROM ak_projects ORDER BY sort_order ASC, created_at DESC'),
        'customer_projects' => fetch_all_reports('SELECT * FROM ak_customer_projects ORDER BY created_at ASC'),
        'contact_requests' => fetch_all_reports('SELECT * FROM ak_contact_requests ORDER BY created_at DESC'),
        'aggregates' => [
            'total_projects' => (int) (fetch_one_reports('SELECT COUNT(*) AS value FROM ak_projects')['value'] ?? 0),
            'total_customers' => (int) (fetch_one_reports('SELECT COUNT(*) AS value FROM ak_customers')['value'] ?? 0),
            'total_payments' => (float) (fetch_one_reports('SELECT COALESCE(SUM(amount),0) AS value FROM ak_payments')['value'] ?? 0),
            'total_expenses' => (float) (fetch_one_reports('SELECT COALESCE(SUM(amount),0) AS value FROM ak_expenses')['value'] ?? 0),
            'total_contact_requests' => (int) (fetch_one_reports('SELECT COUNT(*) AS value FROM ak_contact_requests')['value'] ?? 0),
        ],
    ]);
} catch (Throwable $exception) {
    json_error('Rapor verileri alınamadı.', 500);
}

function fetch_all_reports(string $sql, array $params = []): array
{
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll() ?: [];
}

function fetch_one_reports(string $sql, array $params = []): ?array
{
    $rows = fetch_all_reports($sql . ' LIMIT 1', $params);
    return $rows[0] ?? null;
}
