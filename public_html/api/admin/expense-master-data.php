<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

require_admin();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        $type = trim((string) ($_GET['type'] ?? ''));
        $activeOnly = (string) ($_GET['active_only'] ?? '') === '1';
        $categoryId = trim((string) ($_GET['category_id'] ?? ''));
        $q = trim((string) ($_GET['q'] ?? ''));

        if ($type === 'categories') {
            $sql = 'SELECT * FROM ak_expense_categories';
            $params = [];
            if ($activeOnly) {
                $sql .= ' WHERE is_active = 1';
            }
            $sql .= ' ORDER BY sort_order ASC, name ASC';
            json_success(['categories' => fetch_master_data_rows($sql, $params)]);
        }

        if ($type === 'items') {
            $sql = 'SELECT i.*, c.name AS category_name FROM ak_expense_items i LEFT JOIN ak_expense_categories c ON c.id = i.category_id';
            $params = [];
            $where = [];
            if ($activeOnly) {
                $where[] = 'i.is_active = 1';
            }
            if ($categoryId !== '') {
                $where[] = 'i.category_id = :category_id';
                $params['category_id'] = $categoryId;
            }
            if ($q !== '') {
                $where[] = '(i.name LIKE :like OR c.name LIKE :like2)';
                $params['like'] = '%' . $q . '%';
                $params['like2'] = '%' . $q . '%';
            }
            if ($where) {
                $sql .= ' WHERE ' . implode(' AND ', $where);
            }
            $sql .= ' ORDER BY i.name ASC';
            json_success(['items' => fetch_master_data_rows($sql, $params)]);
        }

        json_success([
            'categories' => fetch_master_data_rows('SELECT * FROM ak_expense_categories ORDER BY sort_order ASC, name ASC'),
            'items' => fetch_master_data_rows('SELECT i.*, c.name AS category_name FROM ak_expense_items i LEFT JOIN ak_expense_categories c ON c.id = i.category_id ORDER BY i.name ASC'),
        ]);
    }

    if ($method === 'POST') {
        $input = read_admin_json_body();
        $kind = trim((string) ($input['kind'] ?? ''));
        if ($kind === 'category') {
            json_success(['category' => create_category($input)], 201);
        }
        if ($kind === 'item') {
            json_success(['item' => create_item($input)], 201);
        }
        json_error('Geçersiz master-data türü.', 400);
    }

    if ($method === 'PATCH') {
        $input = read_admin_json_body();
        $kind = trim((string) ($input['kind'] ?? ''));
        if ($kind === 'category') {
            json_success(['category' => update_category($input)]);
        }
        if ($kind === 'item') {
            json_success(['item' => update_item($input)]);
        }
        json_error('Geçersiz master-data türü.', 400);
    }

    if ($method === 'DELETE') {
        $input = read_admin_json_body();
        $kind = trim((string) ($input['kind'] ?? ''));
        $id = require_non_empty($input, 'id', 'Master kayıt bulunamadı.');
        if ($kind === 'category') {
            json_success(['deleted' => delete_category($id)]);
        }
        if ($kind === 'item') {
            json_success(['deleted' => delete_item($id)]);
        }
        json_error('Geçersiz master-data türü.', 400);
    }

    header('Allow: GET, POST, PATCH, DELETE');
    json_error('İstek yöntemi desteklenmiyor.', 405);
} catch (Throwable $exception) {
    $message = $exception->getMessage();
    if (str_contains($message, 'UNIQUE') || str_contains($message, 'duplicate')) {
        json_error('Bu kayıt zaten mevcut.', 409);
    }
    if (str_contains($message, 'in use') || str_contains($message, 'kullanımda')) {
        json_error($message, 409);
    }
    json_error('Master veri işlemi tamamlanamadı.', 500);
}

function fetch_master_data_rows(string $sql, array $params = []): array
{
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll() ?: [];
}

function fetch_category_by_id(string $id): ?array
{
    $rows = fetch_master_data_rows('SELECT * FROM ak_expense_categories WHERE id = :id LIMIT 1', ['id' => $id]);
    return $rows[0] ?? null;
}

function fetch_item_by_id(string $id): ?array
{
    $rows = fetch_master_data_rows('SELECT i.*, c.name AS category_name FROM ak_expense_items i LEFT JOIN ak_expense_categories c ON c.id = i.category_id WHERE i.id = :id LIMIT 1', ['id' => $id]);
    return $rows[0] ?? null;
}

function create_category(array $input): array
{
    $name = require_non_empty($input, 'name', 'Kategori adı zorunludur.');
    $normalized = strtolower($name);
    $existing = fetch_master_data_rows('SELECT id FROM ak_expense_categories WHERE LOWER(name) = :name LIMIT 1', ['name' => $normalized]);
    if ($existing) {
        json_error('Bu kategori adı zaten mevcut.', 409);
    }
    $id = uuid_v4();
    $payload = [
        'id' => $id,
        'name' => $name,
        'description' => nullable_string($input, 'description'),
        'is_active' => isset($input['is_active']) ? (int) (bool) $input['is_active'] : 1,
        'sort_order' => isset($input['sort_order']) ? (int) $input['sort_order'] : 0,
    ];
    db()->prepare('INSERT INTO ak_expense_categories (`' . implode('`, `', array_keys($payload)) . '`) VALUES (:' . implode(', :', array_keys($payload)) . ')')->execute($payload);
    return fetch_category_by_id($id);
}

function update_category(array $input): array
{
    $id = require_non_empty($input, 'id', 'Kategori bulunamadı.');
    $existing = fetch_category_by_id($id);
    if (!$existing) {
        json_error('Kategori bulunamadı.', 404);
    }
    $name = require_non_empty($input, 'name', 'Kategori adı zorunludur.');
    $normalized = strtolower($name);
    $duplicate = fetch_master_data_rows('SELECT id FROM ak_expense_categories WHERE LOWER(name) = :name AND id != :id LIMIT 1', ['name' => $normalized, 'id' => $id]);
    if ($duplicate) {
        json_error('Bu kategori adı zaten mevcut.', 409);
    }
    $payload = [
        'name' => $name,
        'description' => nullable_string($input, 'description'),
        'is_active' => isset($input['is_active']) ? (int) (bool) $input['is_active'] : (int) ($existing['is_active'] ?? 1),
        'sort_order' => isset($input['sort_order']) ? (int) $input['sort_order'] : (int) ($existing['sort_order'] ?? 0),
    ];
    $sets = array_map(static fn($field) => "`{$field}` = :{$field}", array_keys($payload));
    $payload['id'] = $id;
    db()->prepare('UPDATE ak_expense_categories SET ' . implode(', ', $sets) . ' WHERE id = :id')->execute($payload);
    return fetch_category_by_id($id);
}

function delete_category(string $id): bool
{
    $category = fetch_category_by_id($id);
    if (!$category) {
        json_error('Kategori bulunamadı.', 404);
    }
    $itemCountStmt = db()->prepare('SELECT COUNT(*) FROM ak_expense_items WHERE category_id = :id');
    $itemCountStmt->execute(['id' => $id]);
    $itemCount = (int) $itemCountStmt->fetchColumn();
    $expenseCountStmt = db()->prepare('SELECT COUNT(*) FROM ak_expenses WHERE category_id = :id');
    $expenseCountStmt->execute(['id' => $id]);
    $expenseCount = (int) $expenseCountStmt->fetchColumn();
    if ($itemCount > 0 || $expenseCount > 0) {
        json_error('Bu kategori kullanımda olduğu için silinemez. Lütfen pasifleştirin.', 409);
    }
    db()->prepare('DELETE FROM ak_expense_categories WHERE id = :id')->execute(['id' => $id]);
    return true;
}

function create_item(array $input): array
{
    $name = require_non_empty($input, 'name', 'Masraf kalemi adı zorunludur.');
    $categoryId = require_non_empty($input, 'category_id', 'Kategori zorunludur.');
    $category = fetch_category_by_id($categoryId);
    if (!$category) {
        json_error('Kategori bulunamadı.', 404);
    }
    if ((int) ($category['is_active'] ?? 0) !== 1) {
        json_error('Pasif kategori seçilemez.', 409);
    }
    $normalized = strtolower($name);
    $duplicate = fetch_master_data_rows('SELECT id FROM ak_expense_items WHERE category_id = :category_id AND LOWER(name) = :name LIMIT 1', ['category_id' => $categoryId, 'name' => $normalized]);
    if ($duplicate) {
        json_error('Bu masraf kalemi aynı kategori altında zaten mevcut.', 409);
    }
    $id = uuid_v4();
    $payload = [
        'id' => $id,
        'name' => $name,
        'category_id' => $categoryId,
        'description' => nullable_string($input, 'description'),
        'default_unit' => nullable_string($input, 'default_unit'),
        'default_vat_rate' => isset($input['default_vat_rate']) ? (float) $input['default_vat_rate'] : null,
        'is_active' => isset($input['is_active']) ? (int) (bool) $input['is_active'] : 1,
    ];
    db()->prepare('INSERT INTO ak_expense_items (`' . implode('`, `', array_keys($payload)) . '`) VALUES (:' . implode(', :', array_keys($payload)) . ')')->execute($payload);
    return fetch_item_by_id($id);
}

function update_item(array $input): array
{
    $id = require_non_empty($input, 'id', 'Masraf kalemi bulunamadı.');
    $existing = fetch_item_by_id($id);
    if (!$existing) {
        json_error('Masraf kalemi bulunamadı.', 404);
    }
    $name = require_non_empty($input, 'name', 'Masraf kalemi adı zorunludur.');
    $categoryId = require_non_empty($input, 'category_id', 'Kategori zorunludur.');
    $category = fetch_category_by_id($categoryId);
    if (!$category) {
        json_error('Kategori bulunamadı.', 404);
    }
    if ((int) ($category['is_active'] ?? 0) !== 1) {
        json_error('Pasif kategori seçilemez.', 409);
    }
    $normalized = strtolower($name);
    $duplicate = fetch_master_data_rows('SELECT id FROM ak_expense_items WHERE category_id = :category_id AND LOWER(name) = :name AND id != :id LIMIT 1', ['category_id' => $categoryId, 'name' => $normalized, 'id' => $id]);
    if ($duplicate) {
        json_error('Bu masraf kalemi aynı kategori altında zaten mevcut.', 409);
    }
    $payload = [
        'name' => $name,
        'category_id' => $categoryId,
        'description' => nullable_string($input, 'description'),
        'default_unit' => nullable_string($input, 'default_unit'),
        'default_vat_rate' => isset($input['default_vat_rate']) ? (float) $input['default_vat_rate'] : null,
        'is_active' => isset($input['is_active']) ? (int) (bool) $input['is_active'] : (int) ($existing['is_active'] ?? 1),
    ];
    $sets = array_map(static fn($field) => "`{$field}` = :{$field}", array_keys($payload));
    $payload['id'] = $id;
    db()->prepare('UPDATE ak_expense_items SET ' . implode(', ', $sets) . ' WHERE id = :id')->execute($payload);
    return fetch_item_by_id($id);
}

function delete_item(string $id): bool
{
    $item = fetch_item_by_id($id);
    if (!$item) {
        json_error('Masraf kalemi bulunamadı.', 404);
    }
    $expenseCountStmt = db()->prepare('SELECT COUNT(*) FROM ak_expenses WHERE expense_item_id = :id');
    $expenseCountStmt->execute(['id' => $id]);
    $expenseCount = (int) $expenseCountStmt->fetchColumn();
    if ($expenseCount > 0) {
        json_error('Bu masraf kalemi kullanımda olduğu için silinemez. Lütfen pasifleştirin.', 409);
    }
    db()->prepare('DELETE FROM ak_expense_items WHERE id = :id')->execute(['id' => $id]);
    return true;
}
