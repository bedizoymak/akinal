<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

require_admin();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        json_success(['employees' => fetch_all_employees('SELECT * FROM ak_employees ORDER BY full_name ASC')]);
    }

    if ($method === 'POST') {
        $input = read_admin_json_body();
        $id = uuid_v4();
        $payload = employee_payload($input);
        $payload['id'] = $id;
        insert_employee_row('ak_employees', $payload);
        json_success(['employee' => fetch_one_employee('SELECT * FROM ak_employees WHERE id = :id', ['id' => $id])], 201);
    }

    if ($method === 'PATCH') {
        $input = read_admin_json_body();
        $id = require_non_empty($input, 'id', 'Personel bulunamadı.');
        if (!fetch_one_employee('SELECT id FROM ak_employees WHERE id = :id', ['id' => $id])) {
            json_error('Personel bulunamadı.', 404);
        }
        update_employee_row('ak_employees', employee_payload($input), $id);
        json_success(['employee' => fetch_one_employee('SELECT * FROM ak_employees WHERE id = :id', ['id' => $id])]);
    }

    if ($method === 'DELETE') {
        $id = trim((string) ($_GET['id'] ?? ''));
        if ($id === '') {
            $input = read_admin_json_body();
            $id = require_non_empty($input, 'id', 'Personel bulunamadı.');
        }
        if (!fetch_one_employee('SELECT id FROM ak_employees WHERE id = :id', ['id' => $id])) {
            json_error('Personel bulunamadı.', 404);
        }

        // Guard: never hard-delete an employee with any historical/business record.
        // This used to bypass the ak_employee_financial_entries RESTRICT FK and cascade-delete
        // salary/advance payment history behind a single confirm(). Financial and tenure history
        // must be preserved — direct the admin to set status='Pasif' instead (see audit P0 item A).
        $linkedTableLabels = [
            'ak_employee_financial_entries'    => 'maaş/avans hareketi',
            'ak_employee_roles'                => 'rol ataması',
            'ak_employee_cost_periods'          => 'maliyet dönemi',
            'ak_employee_project_assignments'  => 'proje görevlendirmesi',
            'ak_employee_project_allocations'  => 'proje maliyet tahsisatı',
        ];
        $pdo = db();
        $existingTables = $pdo->query(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN ('"
            . implode("','", array_keys($linkedTableLabels)) . "')"
        )->fetchAll(PDO::FETCH_COLUMN);

        $blockedBy = [];
        foreach ($existingTables as $table) {
            $s = $pdo->prepare("SELECT COUNT(*) FROM `{$table}` WHERE employee_id = :id");
            $s->execute(['id' => $id]);
            $count = (int) $s->fetchColumn();
            if ($count > 0) {
                $blockedBy[] = $linkedTableLabels[$table] . " ({$count})";
            }
        }

        if ($blockedBy) {
            json_error(
                'Bu personel silinemez, bağlı kayıtları var: ' . implode(', ', $blockedBy) . '. '
                . 'Finansal ve özlük geçmişini korumak için personeli silmek yerine durumunu "Pasif" yapın.',
                409
            );
        }

        // No linked records — safe to remove the empty employee card.
        $pdo->prepare('DELETE FROM ak_employees WHERE id = :id')->execute(['id' => $id]);
        json_success(['deleted' => true]);
    }

    header('Allow: GET, POST, PATCH, DELETE');
    json_error('İstek yöntemi desteklenmiyor.', 405);
} catch (Throwable $exception) {
    json_error('Personel işlemi tamamlanamadı.', 500);
}

function employee_payload(array $input): array
{
    $status = nullable_string($input, 'status') ?? 'Aktif';
    if (!in_array($status, ['Aktif', 'Pasif'], true)) {
        json_error('Geçerli bir personel durumu seçilmelidir.');
    }

    return [
        'full_name' => require_non_empty($input, 'full_name', 'Ad Soyad zorunludur.'),
        'phone' => nullable_string($input, 'phone'),
        'role' => nullable_string($input, 'role'),
        'notes' => nullable_string($input, 'notes'),
        'status' => $status,
    ];
}

function fetch_all_employees(string $sql, array $params = []): array { $stmt = db()->prepare($sql); $stmt->execute($params); return $stmt->fetchAll() ?: []; }
function fetch_one_employee(string $sql, array $params = []): ?array { $rows = fetch_all_employees($sql . ' LIMIT 1', $params); return $rows[0] ?? null; }
function insert_employee_row(string $table, array $payload): void { $columns = array_keys($payload); db()->prepare('INSERT INTO ' . $table . ' (`' . implode('`, `', $columns) . '`) VALUES (:' . implode(', :', $columns) . ')')->execute($payload); }
function update_employee_row(string $table, array $payload, string $id): void { $sets = array_map(static fn($field) => "`{$field}` = :{$field}", array_keys($payload)); $payload['id'] = $id; db()->prepare('UPDATE ' . $table . ' SET ' . implode(', ', $sets) . ' WHERE id = :id')->execute($payload); }
