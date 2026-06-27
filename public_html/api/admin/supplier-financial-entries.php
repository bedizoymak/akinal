<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/finance-entry-helpers.php';

require_admin();

const SFE_TABLE = 'ak_supplier_financial_entries';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        $id         = trim((string) ($_GET['id']          ?? ''));
        $supplierId = trim((string) ($_GET['supplier_id'] ?? ''));
        $projectId  = trim((string) ($_GET['project_id']  ?? ''));

        if ($id !== '') {
            $entry = fe_fetch_one_by_id(SFE_TABLE, $id);
            if (!$entry) json_error('Tedarikçi finansal kaydı bulunamadı.', 404);
            json_success(['entry' => $entry]);
        }

        if ($supplierId !== '') {
            $entries = fe_fetch_all(
                'SELECT sfe.*, s.name AS owner_name, p.title AS project_title
                   FROM ak_supplier_financial_entries sfe
                   LEFT JOIN ak_suppliers s ON s.id = sfe.supplier_id
                   LEFT JOIN ak_projects  p ON p.id = sfe.project_id
                  WHERE sfe.supplier_id = :sid
                  ORDER BY sfe.entry_date DESC, sfe.created_at DESC',
                ['sid' => $supplierId]
            );
            json_success(['entries' => $entries]);
        }

        if ($projectId !== '') {
            $entries = fe_fetch_all(
                'SELECT sfe.*, s.name AS owner_name, p.title AS project_title
                   FROM ak_supplier_financial_entries sfe
                   LEFT JOIN ak_suppliers s ON s.id = sfe.supplier_id
                   LEFT JOIN ak_projects  p ON p.id = sfe.project_id
                  WHERE sfe.project_id = :pid
                  ORDER BY sfe.entry_date DESC, sfe.created_at DESC',
                ['pid' => $projectId]
            );
            json_success(['entries' => $entries]);
        }

        $entries = fe_fetch_all(
            'SELECT sfe.*, s.name AS owner_name, p.title AS project_title
               FROM ak_supplier_financial_entries sfe
               LEFT JOIN ak_suppliers s ON s.id = sfe.supplier_id
               LEFT JOIN ak_projects  p ON p.id = sfe.project_id
              ORDER BY sfe.entry_date DESC, sfe.created_at DESC
              LIMIT 500'
        );
        json_success(['entries' => $entries]);
    }

    if ($method === 'POST') {
        $input      = read_admin_json_body();
        $supplierId = require_non_empty($input, 'supplier_id', 'Tedarikçi seçimi zorunludur.');
        $payload    = fe_payload($input, 'supplier_id', $supplierId);
        $id         = uuid_v4();
        $payload['id'] = $id;
        $cols = array_keys($payload);
        db()->prepare(
            'INSERT INTO `' . SFE_TABLE . '` (`' . implode('`, `', $cols) . '`) VALUES (:' . implode(', :', $cols) . ')'
        )->execute($payload);
        json_success(['entry' => fe_fetch_one_by_id(SFE_TABLE, $id)], 201);
    }

    if ($method === 'PATCH') {
        $input    = read_admin_json_body();
        $id       = require_non_empty($input, 'id', 'Kayıt bulunamadı.');
        $existing = fe_fetch_one_by_id(SFE_TABLE, $id);
        if (!$existing) json_error('Tedarikçi finansal kaydı bulunamadı.', 404);
        $supplierId       = require_non_empty($input, 'supplier_id', 'Tedarikçi seçimi zorunludur.');
        $preserveSnapshot = fe_should_preserve_snapshot($input, $existing);
        $payload          = fe_payload($input, 'supplier_id', $supplierId, $preserveSnapshot);
        $sets       = array_map(static fn($f) => "`{$f}` = :{$f}", array_keys($payload));
        $payload['id'] = $id;
        db()->prepare(
            'UPDATE `' . SFE_TABLE . '` SET ' . implode(', ', $sets) . ' WHERE id = :id'
        )->execute($payload);
        json_success(['entry' => fe_fetch_one_by_id(SFE_TABLE, $id)]);
    }

    if ($method === 'DELETE') {
        $id = trim((string) ($_GET['id'] ?? ''));
        if ($id === '') {
            $input = read_admin_json_body();
            $id    = require_non_empty($input, 'id', 'Kayıt bulunamadı.');
        }
        if (!fe_fetch_one_by_id(SFE_TABLE, $id)) json_error('Tedarikçi finansal kaydı bulunamadı.', 404);
        db()->prepare('DELETE FROM `' . SFE_TABLE . '` WHERE id = :id')->execute(['id' => $id]);
        json_success(['deleted' => true]);
    }

    header('Allow: GET, POST, PATCH, DELETE');
    json_error('İstek yöntemi desteklenmiyor.', 405);
} catch (Throwable $exception) {
    json_error('Tedarikçi finansal kaydı işlemi tamamlanamadı.', 500);
}
