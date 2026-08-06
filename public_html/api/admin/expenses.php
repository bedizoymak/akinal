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
            'categories' => fetch_all_expenses('SELECT * FROM ak_expense_categories ORDER BY sort_order ASC, name ASC'),
            'items' => fetch_all_expenses('SELECT i.*, c.name AS category_name FROM ak_expense_items i LEFT JOIN ak_expense_categories c ON c.id = i.category_id ORDER BY i.name ASC'),
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
        if (!fetch_one_expense('SELECT id FROM ak_expenses WHERE id = :id', ['id' => $id])) {
            json_error('Gider kaydı bulunamadı.', 404);
        }
        update_expense_row('ak_expenses', expense_payload($input), $id);
        json_success(['expense' => fetch_one_expense('SELECT * FROM ak_expenses WHERE id = :id', ['id' => $id])]);
    }

    if ($method === 'DELETE') {
        $id = trim((string) ($_GET['id'] ?? ''));
        if ($id === '') {
            $input = read_admin_json_body();
            $id = require_non_empty($input, 'id', 'Gider kaydı bulunamadı.');
        }
        if (!fetch_one_expense('SELECT id FROM ak_expenses WHERE id = :id', ['id' => $id])) {
            json_error('Gider kaydı bulunamadı.', 404);
        }
        db()->prepare('DELETE FROM ak_expenses WHERE id = :id')->execute(['id' => $id]);
        json_success(['deleted' => true]);
    }

    header('Allow: GET, POST, PATCH, DELETE');
    json_error('İstek yöntemi desteklenmiyor.', 405);
} catch (Throwable $exception) {
    json_error('Gider işlemi tamamlanamadı.', 500);
}

function expense_payload(array $input): array
{
    $categoryId = nullable_string($input, 'category_id');
    $itemId = nullable_string($input, 'expense_item_id');
    $categoryName = nullable_string($input, 'category') ?? 'Diğer';

    if ($itemId !== null) {
        $item = fetch_expense_item($itemId);
        if (!$item) {
            json_error('Seçilen masraf kalemi bulunamadı.', 404);
        }
        if ((int) ($item['is_active'] ?? 0) !== 1) {
            json_error('Pasif masraf kalemi seçilemez.', 409);
        }
        if ($categoryId !== null && $item['category_id'] !== $categoryId) {
            json_error('Kategori ve masraf kalemi ilişkisi uyumsuz.', 409);
        }
        $categoryId = $item['category_id'];
        $categoryName = fetch_expense_category_name($categoryId) ?? $categoryName;
    }

    if ($categoryId !== null) {
        $category = fetch_expense_category($categoryId);
        if (!$category) {
            json_error('Seçilen kategori bulunamadı.', 404);
        }
        if ((int) ($category['is_active'] ?? 0) !== 1) {
            json_error('Pasif kategori seçilemez.', 409);
        }
    }

    return [
        'project_id' => nullable_string($input, 'project_id'),
        'customer_id' => nullable_string($input, 'customer_id'),
        'title' => require_non_empty($input, 'title', 'Gider başlığı zorunludur.'),
        'category' => $categoryName,
        'category_id' => $categoryId,
        'expense_item_id' => $itemId,
        'amount' => require_positive_amount($input),
        'expense_date' => require_iso_date($input, 'expense_date', 'Geçerli bir gider tarihi zorunludur.'),
        'description' => nullable_string($input, 'description'),
        'document_url' => nullable_string($input, 'document_url'),
    ];
}

function fetch_expense_item(string $id): ?array
{
    $rows = fetch_all_expenses('SELECT * FROM ak_expense_items WHERE id = :id LIMIT 1', ['id' => $id]);
    return $rows[0] ?? null;
}

function fetch_expense_category(string $id): ?array
{
    $rows = fetch_all_expenses('SELECT * FROM ak_expense_categories WHERE id = :id LIMIT 1', ['id' => $id]);
    return $rows[0] ?? null;
}

function fetch_expense_category_name(?string $id): ?string
{
    if ($id === null || $id === '') {
        return null;
    }
    $category = fetch_expense_category($id);
    return $category['name'] ?? null;
}

function fetch_all_expenses(string $sql, array $params = []): array { $stmt = db()->prepare($sql); $stmt->execute($params); return $stmt->fetchAll() ?: []; }
function fetch_one_expense(string $sql, array $params = []): ?array { $rows = fetch_all_expenses($sql . ' LIMIT 1', $params); return $rows[0] ?? null; }
function insert_expense_row(string $table, array $payload): void { $columns = array_keys($payload); db()->prepare('INSERT INTO ' . $table . ' (`' . implode('`, `', $columns) . '`) VALUES (:' . implode(', :', $columns) . ')')->execute($payload); }
function update_expense_row(string $table, array $payload, string $id): void { $sets = array_map(static fn($field) => "`{$field}` = :{$field}", array_keys($payload)); $payload['id'] = $id; db()->prepare('UPDATE ' . $table . ' SET ' . implode(', ', $sets) . ' WHERE id = :id')->execute($payload); }
