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
        $pdo = db();
        $pdo->beginTransaction();
        try {
            $counts = [];

            // One batch check for all optional/legacy tables
            $optCheck = $pdo->query(
                "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN ('ak_employee_financial_entries','ak_financial_entries','ak_payment_plan_settlements','ak_employee_project_allocations','ak_employee_project_assignments','ak_employee_cost_periods','ak_employee_roles')"
            );
            $opt = [];
            foreach ($optCheck->fetchAll(PDO::FETCH_COLUMN) as $t) { $opt[$t] = true; }

            // 1. Canonical employee financial entries (RESTRICT on employee_id)
            if (isset($opt['ak_employee_financial_entries'])) {
                $s = $pdo->prepare('DELETE FROM ak_employee_financial_entries WHERE employee_id = :id');
                $s->execute(['id' => $id]); $counts['employee_financial_entries'] = $s->rowCount();
            }
            // 2. Settlements referencing this employee's legacy financial entries (RESTRICT on financial_entry_id)
            if (isset($opt['ak_payment_plan_settlements']) && isset($opt['ak_financial_entries'])) {
                $s = $pdo->prepare('DELETE FROM ak_payment_plan_settlements WHERE financial_entry_id IN (SELECT id FROM ak_financial_entries WHERE employee_id = :id)');
                $s->execute(['id' => $id]); $counts['payment_plan_settlements'] = $s->rowCount();
            }
            // 3. Legacy financial entries (SET NULL FK; safe after settlements removed)
            if (isset($opt['ak_financial_entries'])) {
                $s = $pdo->prepare('DELETE FROM ak_financial_entries WHERE employee_id = :id');
                $s->execute(['id' => $id]); $counts['financial_entries'] = $s->rowCount();
            }
            // 4. Employee-linked tables (optional; CASCADE in schema but may be absent)
            if (isset($opt['ak_employee_project_allocations'])) {
                $s = $pdo->prepare('DELETE FROM ak_employee_project_allocations WHERE employee_id = :id');
                $s->execute(['id' => $id]); $counts['employee_project_allocations'] = $s->rowCount();
            }
            if (isset($opt['ak_employee_project_assignments'])) {
                $s = $pdo->prepare('DELETE FROM ak_employee_project_assignments WHERE employee_id = :id');
                $s->execute(['id' => $id]); $counts['employee_project_assignments'] = $s->rowCount();
            }
            if (isset($opt['ak_employee_cost_periods'])) {
                $s = $pdo->prepare('DELETE FROM ak_employee_cost_periods WHERE employee_id = :id');
                $s->execute(['id' => $id]); $counts['employee_cost_periods'] = $s->rowCount();
            }
            if (isset($opt['ak_employee_roles'])) {
                $s = $pdo->prepare('DELETE FROM ak_employee_roles WHERE employee_id = :id');
                $s->execute(['id' => $id]); $counts['employee_roles'] = $s->rowCount();
            }
            // 5. Parent
            $pdo->prepare('DELETE FROM ak_employees WHERE id = :id')->execute(['id' => $id]);
            $pdo->commit();
            json_success(['deleted' => true, 'counts' => $counts]);
        } catch (Throwable $txEx) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            error_log(sprintf('[employees] DELETE id=%s %s code=%s: %s in %s:%d', $id, get_class($txEx), $txEx->getCode(), $txEx->getMessage(), basename($txEx->getFile()), $txEx->getLine()));
            json_error('Personel silinemedi. [' . $txEx->getCode() . '] ' . $txEx->getMessage(), 500);
        }
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
