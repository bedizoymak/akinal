<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

require_admin();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        json_success([
            'expense_cards' => fetch_all_expense_cards('SELECT * FROM ak_expense_cards ORDER BY name ASC'),
        ]);
    }

    if ($method === 'POST') {
        $input = read_admin_json_body();
        $id = uuid_v4();
        $payload = expense_card_payload($input);
        $payload['id'] = $id;
        insert_expense_card_row('ak_expense_cards', $payload);
        json_success(['expense_card' => fetch_one_expense_card('SELECT * FROM ak_expense_cards WHERE id = :id', ['id' => $id])], 201);
    }

    if ($method === 'PATCH') {
        $input = read_admin_json_body();
        $id = require_non_empty($input, 'id', 'Gider kartı bulunamadı.');
        if (!fetch_one_expense_card('SELECT id FROM ak_expense_cards WHERE id = :id', ['id' => $id])) {
            json_error('Gider kartı bulunamadı.', 404);
        }
        update_expense_card_row('ak_expense_cards', expense_card_payload($input), $id);
        json_success(['expense_card' => fetch_one_expense_card('SELECT * FROM ak_expense_cards WHERE id = :id', ['id' => $id])]);
    }

    if ($method === 'DELETE') {
        $id = trim((string) ($_GET['id'] ?? ''));
        if ($id === '') {
            $input = read_admin_json_body();
            $id = require_non_empty($input, 'id', 'Gider kartı bulunamadı.');
        }
        if (!fetch_one_expense_card('SELECT id FROM ak_expense_cards WHERE id = :id', ['id' => $id])) {
            json_error('Gider kartı bulunamadı.', 404);
        }
        $linkedPlan = fetch_one_expense_card('SELECT id FROM ak_payment_plans WHERE expense_card_id = :id', ['id' => $id]);
        if ($linkedPlan) {
            json_error('Finans kaydı bulunan gider kartı silinemez. Önce bağlı ödeme planlarını kontrol edin.', 409);
        }
        $linkedEntry = fetch_one_expense_card('SELECT id FROM ak_financial_entries WHERE expense_card_id = :id', ['id' => $id]);
        if ($linkedEntry) {
            json_error('Finansal hareketi bulunan gider kartı silinemez. Önce bağlı finans kayıtlarını kontrol edin.', 409);
        }
        db()->prepare('DELETE FROM ak_expense_cards WHERE id = :id')->execute(['id' => $id]);
        json_success(['deleted' => true]);
    }

    header('Allow: GET, POST, PATCH, DELETE');
    json_error('İstek yöntemi desteklenmiyor.', 405);
} catch (Throwable $exception) {
    json_error('Gider kartı işlemi tamamlanamadı.', 500);
}

function expense_card_payload(array $input): array
{
    $status = nullable_string($input, 'status') ?? 'Aktif';
    if (!in_array($status, ['Aktif', 'Pasif'], true)) {
        json_error('Geçerli bir gider kartı durumu seçilmelidir.');
    }

    return [
        'name' => require_non_empty($input, 'name', 'Gider kartı adı zorunludur.'),
        'category' => nullable_string($input, 'category'),
        'description' => nullable_string($input, 'description'),
        'status' => $status,
    ];
}

function fetch_all_expense_cards(string $sql, array $params = []): array { $stmt = db()->prepare($sql); $stmt->execute($params); return $stmt->fetchAll() ?: []; }
function fetch_one_expense_card(string $sql, array $params = []): ?array { $rows = fetch_all_expense_cards($sql . ' LIMIT 1', $params); return $rows[0] ?? null; }
function insert_expense_card_row(string $table, array $payload): void { $columns = array_keys($payload); db()->prepare('INSERT INTO ' . $table . ' (`' . implode('`, `', $columns) . '`) VALUES (:' . implode(', :', $columns) . ')')->execute($payload); }
function update_expense_card_row(string $table, array $payload, string $id): void { $sets = array_map(static fn($field) => "`{$field}` = :{$field}", array_keys($payload)); $payload['id'] = $id; db()->prepare('UPDATE ' . $table . ' SET ' . implode(', ', $sets) . ' WHERE id = :id')->execute($payload); }
