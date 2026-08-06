<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

require_admin();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// ak_roles ships in install-schema.php but that installer is gated and must be run
// manually — an environment that hasn't had it (re-)run yet would otherwise 500 on
// every method here. See employee-personnel-tables-apply.php for the migration.
require_admin_tables(['ak_roles'], 'Rol tablosu henüz oluşturulmadı. Lütfen sistem yöneticisiyle iletişime geçin.');

try {
    if ($method === 'GET') {
        $activeOnly = ($_GET['active_only'] ?? '') === '1';
        $sql = $activeOnly
            ? 'SELECT * FROM ak_roles WHERE is_active = 1 ORDER BY name ASC'
            : 'SELECT * FROM ak_roles ORDER BY is_active DESC, name ASC';
        $stmt = db()->query($sql);
        json_success(['roles' => $stmt->fetchAll() ?: []]);
    }

    if ($method === 'POST') {
        $input = read_admin_json_body();
        $name = require_non_empty($input, 'name', 'Rol adı zorunludur.');
        $normalized = role_normalize($name);
        if ($normalized === '') {
            json_error('Geçerli bir rol adı girin.');
        }
        $existing = db()->prepare('SELECT id FROM ak_roles WHERE normalized_name = :n LIMIT 1');
        $existing->execute(['n' => $normalized]);
        if ($existing->fetch()) {
            json_error('Bu isimde bir rol zaten mevcut.', 409);
        }
        $id = uuid_v4();
        db()->prepare('INSERT INTO ak_roles (id, name, normalized_name) VALUES (:id, :name, :normalized)')
            ->execute(['id' => $id, 'name' => $name, 'normalized' => $normalized]);
        $role = db()->prepare('SELECT * FROM ak_roles WHERE id = :id');
        $role->execute(['id' => $id]);
        json_success(['role' => $role->fetch()], 201);
    }

    if ($method === 'PATCH') {
        $input = read_admin_json_body();
        $id = require_non_empty($input, 'id', 'Rol bulunamadı.');
        $stmt = db()->prepare('SELECT * FROM ak_roles WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        if (!$stmt->fetch()) {
            json_error('Rol bulunamadı.', 404);
        }
        $updates = [];
        $params  = ['id' => $id];
        if (array_key_exists('name', $input) && $input['name'] !== null) {
            $name = trim((string) $input['name']);
            if ($name === '') {
                json_error('Rol adı boş olamaz.');
            }
            $normalized = role_normalize($name);
            $dup = db()->prepare('SELECT id FROM ak_roles WHERE normalized_name = :n AND id != :id LIMIT 1');
            $dup->execute(['n' => $normalized, 'id' => $id]);
            if ($dup->fetch()) {
                json_error('Bu isimde başka bir rol zaten mevcut.', 409);
            }
            $updates[] = 'name = :name';
            $updates[] = 'normalized_name = :normalized';
            $params['name'] = $name;
            $params['normalized'] = $normalized;
        }
        if (array_key_exists('is_active', $input)) {
            $updates[] = 'is_active = :is_active';
            $params['is_active'] = normalize_bool($input['is_active']);
        }
        if (empty($updates)) {
            json_error('Güncellenecek alan bulunamadı.');
        }
        db()->prepare('UPDATE ak_roles SET ' . implode(', ', $updates) . ' WHERE id = :id')
            ->execute($params);
        $role = db()->prepare('SELECT * FROM ak_roles WHERE id = :id');
        $role->execute(['id' => $id]);
        json_success(['role' => $role->fetch()]);
    }

    if ($method === 'DELETE') {
        $id = trim((string) ($_GET['id'] ?? ''));
        if ($id === '') {
            $input = read_admin_json_body();
            $id = require_non_empty($input, 'id', 'Rol bulunamadı.');
        }
        $stmt = db()->prepare('SELECT id FROM ak_roles WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        if (!$stmt->fetch()) {
            json_error('Rol bulunamadı.', 404);
        }
        // Prefer soft-delete (is_active = 0). Hard DELETE blocked at DB level by RESTRICT FK
        // if any ak_employee_roles rows reference this role.
        db()->prepare('UPDATE ak_roles SET is_active = 0 WHERE id = :id')->execute(['id' => $id]);
        json_success(['deactivated' => true]);
    }

    header('Allow: GET, POST, PATCH, DELETE');
    json_error('İstek yöntemi desteklenmiyor.', 405);
} catch (Throwable $exception) {
    json_error('Rol işlemi tamamlanamadı.', 500);
}

function role_normalize(string $name): string
{
    $name = mb_strtolower(trim($name), 'UTF-8');
    $map  = ['ş' => 's', 'ğ' => 'g', 'ü' => 'u', 'ö' => 'o', 'ç' => 'c', 'ı' => 'i', 'İ' => 'i', 'Ş' => 's', 'Ğ' => 'g', 'Ü' => 'u', 'Ö' => 'o', 'Ç' => 'c'];
    return strtr($name, $map);
}
