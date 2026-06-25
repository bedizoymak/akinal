<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

require_admin();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        $q = trim((string) ($_GET['q'] ?? ''));
        if ($q !== '') {
            $like = '%' . $q . '%';
            json_success([
                'expense_items' => ec_fetch_all(
                    'SELECT id, name FROM ak_expense_cards WHERE name LIKE :like ORDER BY name ASC LIMIT 50',
                    ['like' => $like]
                ),
            ]);
        }
        json_success([
            'expense_items' => ec_fetch_all('SELECT id, name FROM ak_expense_cards ORDER BY name ASC'),
        ]);
    }

    if ($method === 'POST') {
        $input = read_admin_json_body();
        $name  = require_non_empty($input, 'name', 'Gider kalemi adı zorunludur.');
        $id    = uuid_v4();
        db()->prepare('INSERT INTO ak_expense_cards (id, name) VALUES (:id, :name)')->execute(['id' => $id, 'name' => $name]);
        json_success(['expense_item' => ec_fetch_one($id)], 201);
    }

    if ($method === 'PATCH') {
        $input = read_admin_json_body();
        $id    = require_non_empty($input, 'id', 'Gider kalemi bulunamadı.');
        if (!ec_fetch_one($id)) {
            json_error('Gider kalemi bulunamadı.', 404);
        }
        $name = require_non_empty($input, 'name', 'Gider kalemi adı zorunludur.');
        db()->prepare('UPDATE ak_expense_cards SET name = :name WHERE id = :id')->execute(['name' => $name, 'id' => $id]);
        json_success(['expense_item' => ec_fetch_one($id)]);
    }

    if ($method === 'DELETE') {
        $id = trim((string) ($_GET['id'] ?? ''));
        if ($id === '') {
            $input = read_admin_json_body();
            $id    = require_non_empty($input, 'id', 'Gider kalemi bulunamadı.');
        }
        if (!ec_fetch_one($id)) {
            json_error('Gider kalemi bulunamadı.', 404);
        }
        // FK ON DELETE SET NULL nulls expense_item_id in ak_project_expense_transactions; name snapshot is preserved.
        db()->prepare('DELETE FROM ak_expense_cards WHERE id = :id')->execute(['id' => $id]);
        json_success(['deleted' => true]);
    }

    header('Allow: GET, POST, PATCH, DELETE');
    json_error('İstek yöntemi desteklenmiyor.', 405);
} catch (Throwable $exception) {
    json_error('Gider kalemi işlemi tamamlanamadı.', 500);
}

function ec_fetch_all(string $sql, array $params = []): array
{
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll() ?: [];
}

function ec_fetch_one(string $id): ?array
{
    $rows = ec_fetch_all('SELECT id, name FROM ak_expense_cards WHERE id = :id LIMIT 1', ['id' => $id]);
    return $rows[0] ?? null;
}
