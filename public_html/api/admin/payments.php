<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

require_admin();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        json_success([
            'payments' => fetch_all('SELECT * FROM ak_payments ORDER BY payment_date DESC'),
            'customers' => fetch_all('SELECT * FROM ak_customers ORDER BY created_at DESC'),
            'projects' => fetch_all('SELECT id, title FROM ak_projects ORDER BY sort_order ASC, created_at DESC'),
            'payment_plans' => fetch_all('SELECT id, title, customer_id, project_id, amount, due_date, status FROM ak_payment_plans ORDER BY due_date ASC'),
        ]);
    }

    if ($method === 'POST') {
        $input = read_admin_json_body();
        $id = uuid_v4();
        $payload = payment_payload($input);
        $payload['id'] = $id;
        insert_row('ak_payments', $payload);
        sync_plan_status($payload['payment_plan_id']);
        json_success(['payment' => fetch_one('SELECT * FROM ak_payments WHERE id = :id', ['id' => $id])], 201);
    }

    if ($method === 'PATCH') {
        $input = read_admin_json_body();
        $id = require_non_empty($input, 'id', 'Tahsilat bulunamadı.');
        $previous = fetch_one('SELECT payment_plan_id FROM ak_payments WHERE id = :id', ['id' => $id]);
        $payload = payment_payload($input);
        update_row('ak_payments', $payload, $id);
        sync_plan_status($payload['payment_plan_id']);
        if (($previous['payment_plan_id'] ?? null) && $previous['payment_plan_id'] !== $payload['payment_plan_id']) {
            sync_plan_status($previous['payment_plan_id']);
        }
        json_success(['payment' => fetch_one('SELECT * FROM ak_payments WHERE id = :id', ['id' => $id])]);
    }

    if ($method === 'DELETE') {
        $id = trim((string) ($_GET['id'] ?? ''));
        if ($id === '') {
            $input = read_admin_json_body();
            $id = require_non_empty($input, 'id', 'Tahsilat bulunamadı.');
        }
        $previous = fetch_one('SELECT payment_plan_id FROM ak_payments WHERE id = :id', ['id' => $id]);
        db()->prepare('DELETE FROM ak_payments WHERE id = :id')->execute(['id' => $id]);
        sync_plan_status($previous['payment_plan_id'] ?? null);
        json_success(['deleted' => true]);
    }

    header('Allow: GET, POST, PATCH, DELETE');
    json_error('Method not allowed.', 405);
} catch (Throwable $exception) {
    json_error('Tahsilat işlemi tamamlanamadı.', 500);
}

function payment_payload(array $input): array
{
    return [
        'customer_id' => require_non_empty($input, 'customer_id', 'Müşteri zorunludur.'),
        'project_id' => nullable_string($input, 'project_id'),
        'payment_plan_id' => nullable_string($input, 'payment_plan_id'),
        'amount' => (float) ($input['amount'] ?? 0),
        'payment_date' => require_non_empty($input, 'payment_date', 'Tahsilat tarihi zorunludur.'),
        'payment_method' => nullable_string($input, 'payment_method') ?? 'Nakit',
        'description' => nullable_string($input, 'description'),
        'document_url' => nullable_string($input, 'document_url'),
    ];
}

function sync_plan_status(?string $planId): void
{
    if (!$planId) return;
    $plan = fetch_one('SELECT id, amount, due_date, status FROM ak_payment_plans WHERE id = :id', ['id' => $planId]);
    if (!$plan) return;
    $paid = (float) (fetch_one('SELECT COALESCE(SUM(amount),0) AS paid FROM ak_payments WHERE payment_plan_id = :id', ['id' => $planId])['paid'] ?? 0);
    $amount = (float) $plan['amount'];
    $status = $paid >= $amount ? 'Ödendi' : ((string) $plan['due_date'] < date('Y-m-d') ? 'Gecikti' : 'Bekliyor');
    db()->prepare('UPDATE ak_payment_plans SET status = :status WHERE id = :id')->execute(['id' => $planId, 'status' => $status]);
}

function fetch_all(string $sql, array $params = []): array { $stmt = db()->prepare($sql); $stmt->execute($params); return $stmt->fetchAll() ?: []; }
function fetch_one(string $sql, array $params = []): ?array { $rows = fetch_all($sql . ' LIMIT 1', $params); return $rows[0] ?? null; }
function insert_row(string $table, array $payload): void { $columns = array_keys($payload); db()->prepare('INSERT INTO ' . $table . ' (`' . implode('`, `', $columns) . '`) VALUES (:' . implode(', :', $columns) . ')')->execute($payload); }
function update_row(string $table, array $payload, string $id): void { $sets = array_map(static fn($field) => "`{$field}` = :{$field}", array_keys($payload)); $payload['id'] = $id; db()->prepare('UPDATE ' . $table . ' SET ' . implode(', ', $sets) . ' WHERE id = :id')->execute($payload); }
