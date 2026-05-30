<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

require_admin();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        json_success([
            'payment_plans' => fetch_all('SELECT * FROM ak_payment_plans ORDER BY due_date ASC'),
            'customers' => fetch_all('SELECT * FROM ak_customers ORDER BY created_at DESC'),
            'projects' => fetch_all('SELECT id, title FROM ak_projects ORDER BY sort_order ASC, created_at DESC'),
            'payments' => fetch_all('SELECT payment_plan_id, amount FROM ak_payments'),
        ]);
    }

    if ($method === 'POST') {
        $input = read_admin_json_body();
        $id = uuid_v4();
        $payload = plan_payload($input);
        $payload['id'] = $id;
        insert_row('ak_payment_plans', $payload);
        json_success(['payment_plan' => fetch_one('SELECT * FROM ak_payment_plans WHERE id = :id', ['id' => $id])], 201);
    }

    if ($method === 'PATCH') {
        $input = read_admin_json_body();
        $id = require_non_empty($input, 'id', 'Ödeme planı bulunamadı.');
        update_row('ak_payment_plans', plan_payload($input), $id);
        json_success(['payment_plan' => fetch_one('SELECT * FROM ak_payment_plans WHERE id = :id', ['id' => $id])]);
    }

    if ($method === 'DELETE') {
        $id = trim((string) ($_GET['id'] ?? ''));
        if ($id === '') {
            $input = read_admin_json_body();
            $id = require_non_empty($input, 'id', 'Ödeme planı bulunamadı.');
        }
        db()->prepare('DELETE FROM ak_payment_plans WHERE id = :id')->execute(['id' => $id]);
        json_success(['deleted' => true]);
    }

    header('Allow: GET, POST, PATCH, DELETE');
    json_error('Method not allowed.', 405);
} catch (Throwable $exception) {
    json_error('Ödeme planı işlemi tamamlanamadı.', 500);
}

function plan_payload(array $input): array
{
    return [
        'customer_id' => require_non_empty($input, 'customer_id', 'Müşteri zorunludur.'),
        'project_id' => nullable_string($input, 'project_id'),
        'title' => require_non_empty($input, 'title', 'Başlık zorunludur.'),
        'description' => nullable_string($input, 'description'),
        'amount' => (float) ($input['amount'] ?? 0),
        'due_date' => require_non_empty($input, 'due_date', 'Vade tarihi zorunludur.'),
        'status' => nullable_string($input, 'status') ?? 'Bekliyor',
        'notes' => nullable_string($input, 'notes'),
    ];
}

function fetch_all(string $sql, array $params = []): array { $stmt = db()->prepare($sql); $stmt->execute($params); return $stmt->fetchAll() ?: []; }
function fetch_one(string $sql, array $params = []): ?array { $rows = fetch_all($sql . ' LIMIT 1', $params); return $rows[0] ?? null; }
function insert_row(string $table, array $payload): void { $columns = array_keys($payload); db()->prepare('INSERT INTO ' . $table . ' (`' . implode('`, `', $columns) . '`) VALUES (:' . implode(', :', $columns) . ')')->execute($payload); }
function update_row(string $table, array $payload, string $id): void { $sets = array_map(static fn($field) => "`{$field}` = :{$field}", array_keys($payload)); $payload['id'] = $id; db()->prepare('UPDATE ' . $table . ' SET ' . implode(', ', $sets) . ' WHERE id = :id')->execute($payload); }
