<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

require_admin();

const SUPPLIER_TYPES = ['supplier', 'subcontractor', 'labor_service', 'equipment_rental', 'crane_rental', 'other'];

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        $id = trim((string) ($_GET['id'] ?? ''));
        if ($id !== '') {
            $supplier = sup_fetch_one($id);
            if (!$supplier) json_error('Tedarikçi bulunamadı.', 404);
            json_success(['supplier' => $supplier]);
        }

        $q = trim((string) ($_GET['q'] ?? ''));
        if ($q !== '') {
            $like = '%' . $q . '%';
            json_success([
                'suppliers' => sup_fetch_all(
                    'SELECT * FROM ak_suppliers WHERE (name LIKE :like OR contact_person LIKE :like2) AND is_active = 1 ORDER BY name ASC LIMIT 50',
                    ['like' => $like, 'like2' => $like]
                ),
            ]);
        }

        $activeOnly = (string) ($_GET['active_only'] ?? '') === '1';
        $where = $activeOnly ? 'WHERE is_active = 1' : '';
        json_success([
            'suppliers' => sup_fetch_all("SELECT * FROM ak_suppliers {$where} ORDER BY name ASC"),
        ]);
    }

    if ($method === 'POST') {
        $input   = read_admin_json_body();
        $payload = sup_payload($input);
        $id      = uuid_v4();
        $payload['id'] = $id;
        $cols = array_keys($payload);
        db()->prepare(
            'INSERT INTO ak_suppliers (`' . implode('`, `', $cols) . '`) VALUES (:' . implode(', :', $cols) . ')'
        )->execute($payload);
        json_success(['supplier' => sup_fetch_one($id)], 201);
    }

    if ($method === 'PATCH') {
        $input = read_admin_json_body();
        $id    = require_non_empty($input, 'id', 'Tedarikçi bulunamadı.');
        if (!sup_fetch_one($id)) json_error('Tedarikçi bulunamadı.', 404);
        $payload = sup_payload($input);
        $sets    = array_map(static fn($f) => "`{$f}` = :{$f}", array_keys($payload));
        $payload['id'] = $id;
        db()->prepare(
            'UPDATE ak_suppliers SET ' . implode(', ', $sets) . ' WHERE id = :id'
        )->execute($payload);
        json_success(['supplier' => sup_fetch_one($id)]);
    }

    if ($method === 'DELETE') {
        $id = trim((string) ($_GET['id'] ?? ''));
        if ($id === '') {
            $input = read_admin_json_body();
            $id    = require_non_empty($input, 'id', 'Tedarikçi bulunamadı.');
        }
        if (!sup_fetch_one($id)) json_error('Tedarikçi bulunamadı.', 404);

        $pdo = db();
        $pdo->beginTransaction();
        try {
            $counts = [];
            // 1. Canonical financial entries (RESTRICT on supplier_id)
            $s = $pdo->prepare('DELETE FROM ak_supplier_financial_entries WHERE supplier_id = :id');
            $s->execute(['id' => $id]); $counts['supplier_financial_entries'] = $s->rowCount();
            // 2. Parent
            $pdo->prepare('DELETE FROM ak_suppliers WHERE id = :id')->execute(['id' => $id]);
            $pdo->commit();
            json_success(['deleted' => true, 'counts' => $counts]);
        } catch (Throwable $txEx) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $txEx;
        }
    }

    header('Allow: GET, POST, PATCH, DELETE');
    json_error('İstek yöntemi desteklenmiyor.', 405);
} catch (Throwable $exception) {
    json_error('Tedarikçi işlemi tamamlanamadı.', 500);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sup_fetch_all(string $sql, array $params = []): array
{
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll() ?: [];
}

function sup_fetch_one(string $id): ?array
{
    $rows = sup_fetch_all('SELECT * FROM ak_suppliers WHERE id = :id LIMIT 1', ['id' => $id]);
    return $rows[0] ?? null;
}

function sup_payload(array $input): array
{
    $supplierType = trim((string) ($input['supplier_type'] ?? 'other'));
    if (!in_array($supplierType, SUPPLIER_TYPES, true)) {
        json_error('Geçerli bir tedarikçi türü seçilmelidir.');
    }

    $isActive = isset($input['is_active']) ? (int) (bool) $input['is_active'] : 1;

    return [
        'name'           => require_non_empty($input, 'name', 'Tedarikçi adı zorunludur.'),
        'supplier_type'  => $supplierType,
        'contact_person' => nullable_string($input, 'contact_person'),
        'phone'          => nullable_string($input, 'phone'),
        'whatsapp'       => nullable_string($input, 'whatsapp'),
        'email'          => nullable_string($input, 'email'),
        'tax_no'         => nullable_string($input, 'tax_no'),
        'address'        => nullable_string($input, 'address'),
        'city'           => nullable_string($input, 'city'),
        'district'       => nullable_string($input, 'district'),
        'notes'          => nullable_string($input, 'notes'),
        'is_active'      => $isActive,
    ];
}
