<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

require_admin();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    // GET /api/admin/employee-roles.php?employee_id=:id
    if ($method === 'GET') {
        $employeeId = trim((string) ($_GET['employee_id'] ?? ''));
        if ($employeeId === '') {
            json_error('employee_id zorunludur.');
        }
        $stmt = db()->prepare(
            'SELECT er.employee_id, er.role_id, er.assigned_at, er.ended_at,
                    r.name AS role_name, r.normalized_name, r.is_active AS role_is_active
             FROM ak_employee_roles er
             JOIN ak_roles r ON r.id = er.role_id
             WHERE er.employee_id = :employee_id
             ORDER BY er.ended_at IS NOT NULL ASC, er.assigned_at DESC'
        );
        $stmt->execute(['employee_id' => $employeeId]);
        json_success(['employee_roles' => $stmt->fetchAll() ?: []]);
    }

    // POST — assign a role to an employee
    if ($method === 'POST') {
        $input       = read_admin_json_body();
        $employeeId  = require_non_empty($input, 'employee_id', 'employee_id zorunludur.');
        $roleId      = require_non_empty($input, 'role_id', 'role_id zorunludur.');
        $assignedAt  = require_iso_date($input, 'assigned_at', 'assigned_at geçerli bir tarih (YYYY-MM-DD) olmalıdır.');

        // Verify employee exists
        $emp = db()->prepare('SELECT id FROM ak_employees WHERE id = :id LIMIT 1');
        $emp->execute(['id' => $employeeId]);
        if (!$emp->fetch()) {
            json_error('Personel bulunamadı.', 404);
        }

        // Verify role exists and is active
        $role = db()->prepare('SELECT id FROM ak_roles WHERE id = :id AND is_active = 1 LIMIT 1');
        $role->execute(['id' => $roleId]);
        if (!$role->fetch()) {
            json_error('Rol bulunamadı veya pasif durumda.', 404);
        }

        // Close any currently active assignment for this same role
        // (active = ended_at IS NULL)
        db()->prepare(
            'UPDATE ak_employee_roles
             SET ended_at = DATE_SUB(:assigned_at, INTERVAL 1 DAY)
             WHERE employee_id = :employee_id
               AND role_id = :role_id
               AND ended_at IS NULL'
        )->execute(['assigned_at' => $assignedAt, 'employee_id' => $employeeId, 'role_id' => $roleId]);

        // Insert new assignment
        db()->prepare(
            'INSERT INTO ak_employee_roles (employee_id, role_id, assigned_at)
             VALUES (:employee_id, :role_id, :assigned_at)'
        )->execute(['employee_id' => $employeeId, 'role_id' => $roleId, 'assigned_at' => $assignedAt]);

        $row = db()->prepare(
            'SELECT er.*, r.name AS role_name FROM ak_employee_roles er
             JOIN ak_roles r ON r.id = er.role_id
             WHERE er.employee_id = :e AND er.role_id = :r AND er.assigned_at = :a LIMIT 1'
        );
        $row->execute(['e' => $employeeId, 'r' => $roleId, 'a' => $assignedAt]);
        json_success(['employee_role' => $row->fetch()], 201);
    }

    // PATCH — set ended_at on an assignment
    if ($method === 'PATCH') {
        $input      = read_admin_json_body();
        $employeeId = require_non_empty($input, 'employee_id', 'employee_id zorunludur.');
        $roleId     = require_non_empty($input, 'role_id', 'role_id zorunludur.');
        $assignedAt = require_iso_date($input, 'assigned_at', 'assigned_at geçerli bir tarih (YYYY-MM-DD) olmalıdır.');

        // Verify assignment exists
        $check = db()->prepare(
            'SELECT employee_id FROM ak_employee_roles
             WHERE employee_id = :e AND role_id = :r AND assigned_at = :a LIMIT 1'
        );
        $check->execute(['e' => $employeeId, 'r' => $roleId, 'a' => $assignedAt]);
        if (!$check->fetch()) {
            json_error('Rol ataması bulunamadı.', 404);
        }

        if (!array_key_exists('ended_at', $input)) {
            json_error('ended_at alanı gereklidir.');
        }
        $endedAt = $input['ended_at'];
        if ($endedAt !== null) {
            $date = DateTimeImmutable::createFromFormat('!Y-m-d', (string) $endedAt);
            if (!$date || $date->format('Y-m-d') !== (string) $endedAt) {
                json_error('ended_at geçerli bir tarih (YYYY-MM-DD) olmalıdır.');
            }
        }

        db()->prepare(
            'UPDATE ak_employee_roles SET ended_at = :ended_at
             WHERE employee_id = :e AND role_id = :r AND assigned_at = :a'
        )->execute(['ended_at' => $endedAt, 'e' => $employeeId, 'r' => $roleId, 'a' => $assignedAt]);

        json_success(['updated' => true]);
    }

    // DELETE — hard delete an assignment row
    if ($method === 'DELETE') {
        $employeeId = trim((string) ($_GET['employee_id'] ?? ''));
        $roleId     = trim((string) ($_GET['role_id'] ?? ''));
        $assignedAt = trim((string) ($_GET['assigned_at'] ?? ''));
        if ($employeeId === '' || $roleId === '' || $assignedAt === '') {
            $input      = read_admin_json_body();
            $employeeId = require_non_empty($input, 'employee_id', 'employee_id zorunludur.');
            $roleId     = require_non_empty($input, 'role_id', 'role_id zorunludur.');
            $assignedAt = require_iso_date($input, 'assigned_at', 'assigned_at zorunludur.');
        }
        db()->prepare(
            'DELETE FROM ak_employee_roles
             WHERE employee_id = :e AND role_id = :r AND assigned_at = :a'
        )->execute(['e' => $employeeId, 'r' => $roleId, 'a' => $assignedAt]);
        json_success(['deleted' => true]);
    }

    header('Allow: GET, POST, PATCH, DELETE');
    json_error('İstek yöntemi desteklenmiyor.', 405);
} catch (Throwable $exception) {
    json_error('Personel rol işlemi tamamlanamadı.', 500);
}
