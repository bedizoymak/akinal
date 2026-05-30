<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

require_admin();
require_method('GET');

try {
    json_success([
        'payment_plans' => fetch_all_finance_summary('SELECT * FROM ak_payment_plans'),
        'payments' => fetch_all_finance_summary('SELECT * FROM ak_payments'),
        'expenses' => fetch_all_finance_summary('SELECT * FROM ak_expenses'),
        'financial_entries' => fetch_all_finance_summary('SELECT * FROM ak_financial_entries'),
        'customers' => fetch_all_finance_summary('SELECT * FROM ak_customers'),
        'projects' => fetch_all_finance_summary('SELECT id, title, slug FROM ak_projects ORDER BY sort_order ASC, created_at DESC'),
    ]);
} catch (Throwable $exception) {
    json_error('Finans özeti alınamadı.', 500);
}

function fetch_all_finance_summary(string $sql, array $params = []): array
{
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll() ?: [];
}
