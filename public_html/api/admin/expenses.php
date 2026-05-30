<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

require_admin();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        json_success([
            'expenses' => fetch_all_expenses('SELECT * FROM ak_expenses ORDER BY expense_date DESC, created_at DESC'),
            'customers' => fetch_all_expenses('SELECT * FROM ak_customers ORDER BY created_at DESC'),
            'projects' => fetch_all_expenses('SELECT id, title FROM ak_projects ORDER BY sort_order ASC, created_at DESC'),
        ]);
    }

    if ($method === 'POST') {
        $input = read_admin_json_body();
        $id = uuid_v4();
        $payload = expense_payload($input);
        $payload['id'] = $id;
        insert_expense_row('ak_expenses', $payload);
        json_success(['expense' => fetch_one_expense('SELECT * FROM ak_expenses WHERE id = :id', ['id' => $id])], 201);
    }

    if ($method === 'PATCH') {
        $input = read_admin_json_body();
        $id = require_non_empty($input, 'id', 'Gider kaydı bulunamadı.');
        update_expense_row('ak_expenses', expense_payload($input), $id);
        json_success(['expense' => fetch_one_expense('SELECT * FROM ak_expenses WHERE id = :id', ['id' => $id])]);
    }

    if ($method === 'DELETE') {
        $id = trim((string) ($_GET['id'] ?? ''));
        if ($id === '') {
            $input = read_admin_json_body();
            $id = require_non_empty($input, 'id', 'Gider kaydı bulunamadı.');
        }
        db()->prepare('DELETE FROM ak_expenses WHERE id = :id')->execute(['id' => $id]);
        json_success(['deleted' => true]);
    }

    header('Allow: GET, POST, PATCH, DELETE');
    json_error('Method not allowed.', 405);
} catch (Throwable $exception) {
    json_error('Gider işlemi tamamlanamadı.', 500);
}

function expense_payload(array $input): array
{
    return [
        'project_id' => nullable_string($input, 'project_id'),
        'customer_id' => nullable_string($input, 'customer_id'),
        'title' => require_non_empty($input, 'title', 'Gider başlığı zorunludur.'),
        'category' => nullable_string($input, 'category') ?? 'Diğer',
        'amount' => (float) ($input['amount'] ?? 0),
        'expense_date' => require_non_empty($input, 'expense_date', 'Gider tarihi zorunludur.'),
        'description' => nullable_string($input, 'description'),
        'document_url' => nullable_string($input, 'document_url'),
    ];
}

function fetch_all_expenses(string $sql, array $params = []): array { $stmt = db()->prepare($sql); $stmt->execute($params); return $stmt->fetchAll() ?: []; }
function fetch_one_expense(string $sql, array $params = []): ?array { $rows = fetch_all_expenses($sql . ' LIMIT 1', $params); return $rows[0] ?? null; }
function insert_expense_row(string $table, array $payload): void { $columns = array_keys($payload); db()->prepare('INSERT INTO ' . $table . ' (`' . implode('`, `', $columns) . '`) VALUES (:' . implode(', :', $columns) . ')')->execute($payload); }
function update_expense_row(string $table, array $payload, string $id): void { $sets = array_map(static fn($field) => "`{$field}` = :{$field}", array_keys($payload)); $payload['id'] = $id; db()->prepare('UPDATE ' . $table . ' SET ' . implode(', ', $sets) . ' WHERE id = :id')->execute($payload); }
