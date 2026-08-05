<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

require_admin();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        $employeeId = trim((string) ($_GET['employee_id'] ?? ''));
        $projectId  = trim((string) ($_GET['project_id'] ?? ''));

        // ak_employee_project_assignments ships in install-schema.php but that installer is
        // gated and must be run manually — an environment that hasn't had it (re-)run yet
        // would otherwise 500 here instead of showing an empty assignment list.
        if (!epa_table_exists('ak_employee_project_assignments')) {
            json_success(['assignments' => [], 'table_missing' => true]);
        }

        if ($employeeId !== '') {
            $stmt = db()->prepare(
                'SELECT a.*, p.title AS project_title
                 FROM ak_employee_project_assignments a
                 JOIN ak_projects p ON p.id = a.project_id
                 WHERE a.employee_id = :employee_id
                 ORDER BY a.end_date IS NOT NULL ASC, a.start_date DESC'
            );
            $stmt->execute(['employee_id' => $employeeId]);
        } elseif ($projectId !== '') {
            $stmt = db()->prepare(
                'SELECT a.*, e.full_name AS employee_name
                 FROM ak_employee_project_assignments a
                 JOIN ak_employees e ON e.id = a.employee_id
                 WHERE a.project_id = :project_id
                 ORDER BY a.end_date IS NOT NULL ASC, a.start_date DESC'
            );
            $stmt->execute(['project_id' => $projectId]);
        } else {
            json_error('employee_id veya project_id zorunludur.');
        }

        json_success(['assignments' => $stmt->fetchAll() ?: []]);
    }

    if ($method === 'POST') {
        $input      = read_admin_json_body();
        $employeeId = require_non_empty($input, 'employee_id', 'employee_id zorunludur.');
        $projectId  = require_non_empty($input, 'project_id', 'project_id zorunludur.');
        $startDate  = require_iso_date($input, 'start_date', 'start_date geçerli bir tarih (YYYY-MM-DD) olmalıdır.');

        $emp = db()->prepare('SELECT id FROM ak_employees WHERE id = :id LIMIT 1');
        $emp->execute(['id' => $employeeId]);
        if (!$emp->fetch()) {
            json_error('Personel bulunamadı.', 404);
        }
        $proj = db()->prepare('SELECT id FROM ak_projects WHERE id = :id LIMIT 1');
        $proj->execute(['id' => $projectId]);
        if (!$proj->fetch()) {
            json_error('Proje bulunamadı.', 404);
        }

        $id = uuid_v4();
        db()->prepare(
            'INSERT INTO ak_employee_project_assignments (id, employee_id, project_id, start_date, end_date, notes)
             VALUES (:id, :employee_id, :project_id, :start_date, :end_date, :notes)'
        )->execute([
            'id'          => $id,
            'employee_id' => $employeeId,
            'project_id'  => $projectId,
            'start_date'  => $startDate,
            'end_date'    => null,
            'notes'       => nullable_string($input, 'notes'),
        ]);

        $row = db()->prepare('SELECT * FROM ak_employee_project_assignments WHERE id = :id');
        $row->execute(['id' => $id]);
        json_success(['assignment' => $row->fetch()], 201);
    }

    if ($method === 'PATCH') {
        $input = read_admin_json_body();
        $id    = require_non_empty($input, 'id', 'Görevlendirme bulunamadı.');

        $row = db()->prepare('SELECT id FROM ak_employee_project_assignments WHERE id = :id LIMIT 1');
        $row->execute(['id' => $id]);
        if (!$row->fetch()) {
            json_error('Görevlendirme bulunamadı.', 404);
        }

        $updates = [];
        $params  = ['id' => $id];

        if (array_key_exists('end_date', $input)) {
            $endDate = $input['end_date'];
            if ($endDate !== null) {
                $date = DateTimeImmutable::createFromFormat('!Y-m-d', (string) $endDate);
                if (!$date || $date->format('Y-m-d') !== (string) $endDate) {
                    json_error('end_date geçerli bir tarih (YYYY-MM-DD) olmalıdır.');
                }
            }
            $updates[] = 'end_date = :end_date';
            $params['end_date'] = $endDate;
        }
        if (array_key_exists('notes', $input)) {
            $updates[] = 'notes = :notes';
            $params['notes'] = nullable_string($input, 'notes');
        }
        if (empty($updates)) {
            json_error('Güncellenecek alan bulunamadı.');
        }

        db()->prepare('UPDATE ak_employee_project_assignments SET ' . implode(', ', $updates) . ' WHERE id = :id')
            ->execute($params);
        json_success(['updated' => true]);
    }

    if ($method === 'DELETE') {
        $id = trim((string) ($_GET['id'] ?? ''));
        if ($id === '') {
            $input = read_admin_json_body();
            $id    = require_non_empty($input, 'id', 'Görevlendirme bulunamadı.');
        }

        $row = db()->prepare('SELECT employee_id, project_id FROM ak_employee_project_assignments WHERE id = :id LIMIT 1');
        $row->execute(['id' => $id]);
        $assignment = $row->fetch();
        if (!$assignment) {
            json_error('Görevlendirme bulunamadı.', 404);
        }

        // Warn but don't block: allocations can exist without assignments
        db()->prepare('DELETE FROM ak_employee_project_assignments WHERE id = :id')->execute(['id' => $id]);
        json_success(['deleted' => true]);
    }

    header('Allow: GET, POST, PATCH, DELETE');
    json_error('İstek yöntemi desteklenmiyor.', 405);
} catch (Throwable $exception) {
    json_error('Görevlendirme işlemi tamamlanamadı.', 500);
}

function epa_table_exists(string $table): bool
{
    $stmt = db()->prepare(
        'SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :t LIMIT 1'
    );
    $stmt->execute(['t' => $table]);
    return (bool) $stmt->fetchColumn();
}
