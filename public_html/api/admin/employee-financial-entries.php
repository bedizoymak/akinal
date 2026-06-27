<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/finance-entry-helpers.php';

require_admin();

const EFE_TABLE = 'ak_employee_financial_entries';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        $id         = trim((string) ($_GET['id']          ?? ''));
        $employeeId = trim((string) ($_GET['employee_id'] ?? ''));
        $projectId  = trim((string) ($_GET['project_id']  ?? ''));

        if ($id !== '') {
            $entry = fe_fetch_one_by_id(EFE_TABLE, $id);
            if (!$entry) json_error('Personel finansal kaydı bulunamadı.', 404);
            json_success(['entry' => $entry]);
        }

        if ($employeeId !== '') {
            $entries = fe_fetch_all(
                'SELECT efe.*, e.full_name AS owner_name, p.title AS project_title
                   FROM ak_employee_financial_entries efe
                   LEFT JOIN ak_employees e ON e.id = efe.employee_id
                   LEFT JOIN ak_projects  p ON p.id = efe.project_id
                  WHERE efe.employee_id = :eid
                  ORDER BY efe.entry_date DESC, efe.created_at DESC',
                ['eid' => $employeeId]
            );
            json_success(['entries' => $entries]);
        }

        if ($projectId !== '') {
            $entries = fe_fetch_all(
                'SELECT efe.*, e.full_name AS owner_name, p.title AS project_title
                   FROM ak_employee_financial_entries efe
                   LEFT JOIN ak_employees e ON e.id = efe.employee_id
                   LEFT JOIN ak_projects  p ON p.id = efe.project_id
                  WHERE efe.project_id = :pid
                  ORDER BY efe.entry_date DESC, efe.created_at DESC',
                ['pid' => $projectId]
            );
            json_success(['entries' => $entries]);
        }

        $entries = fe_fetch_all(
            'SELECT efe.*, e.full_name AS owner_name, p.title AS project_title
               FROM ak_employee_financial_entries efe
               LEFT JOIN ak_employees e ON e.id = efe.employee_id
               LEFT JOIN ak_projects  p ON p.id = efe.project_id
              ORDER BY efe.entry_date DESC, efe.created_at DESC
              LIMIT 500'
        );
        json_success(['entries' => $entries]);
    }

    if ($method === 'POST') {
        $input      = read_admin_json_body();
        $employeeId = require_non_empty($input, 'employee_id', 'Personel seçimi zorunludur.');
        $payload    = fe_payload($input, 'employee_id', $employeeId);
        $id         = uuid_v4();
        $payload['id'] = $id;
        $cols = array_keys($payload);
        db()->prepare(
            'INSERT INTO `' . EFE_TABLE . '` (`' . implode('`, `', $cols) . '`) VALUES (:' . implode(', :', $cols) . ')'
        )->execute($payload);
        json_success(['entry' => fe_fetch_one_by_id(EFE_TABLE, $id)], 201);
    }

    if ($method === 'PATCH') {
        $input    = read_admin_json_body();
        $id       = require_non_empty($input, 'id', 'Kayıt bulunamadı.');
        $existing = fe_fetch_one_by_id(EFE_TABLE, $id);
        if (!$existing) json_error('Personel finansal kaydı bulunamadı.', 404);
        $employeeId       = require_non_empty($input, 'employee_id', 'Personel seçimi zorunludur.');
        $preserveSnapshot = fe_should_preserve_snapshot($input, $existing);
        $payload          = fe_payload($input, 'employee_id', $employeeId, $preserveSnapshot);
        $sets       = array_map(static fn($f) => "`{$f}` = :{$f}", array_keys($payload));
        $payload['id'] = $id;
        db()->prepare(
            'UPDATE `' . EFE_TABLE . '` SET ' . implode(', ', $sets) . ' WHERE id = :id'
        )->execute($payload);
        json_success(['entry' => fe_fetch_one_by_id(EFE_TABLE, $id)]);
    }

    if ($method === 'DELETE') {
        $id = trim((string) ($_GET['id'] ?? ''));
        if ($id === '') {
            $input = read_admin_json_body();
            $id    = require_non_empty($input, 'id', 'Kayıt bulunamadı.');
        }
        if (!fe_fetch_one_by_id(EFE_TABLE, $id)) json_error('Personel finansal kaydı bulunamadı.', 404);
        db()->prepare('DELETE FROM `' . EFE_TABLE . '` WHERE id = :id')->execute(['id' => $id]);
        json_success(['deleted' => true]);
    }

    header('Allow: GET, POST, PATCH, DELETE');
    json_error('İstek yöntemi desteklenmiyor.', 405);
} catch (Throwable $exception) {
    json_error('Personel finansal kaydı işlemi tamamlanamadı.', 500);
}
