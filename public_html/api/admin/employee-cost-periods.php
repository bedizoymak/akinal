<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

require_admin();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// ak_employee_cost_periods ships in install-schema.php but that installer is gated
// and must be run manually — an environment that hasn't had it (re-)run yet would
// otherwise 500 on every method here. See employee-personnel-tables-apply.php.
require_admin_tables(['ak_employee_cost_periods'], 'Maliyet dönemi tablosu henüz oluşturulmadı. Lütfen sistem yöneticisiyle iletişime geçin.');

try {
    // GET /api/admin/employee-cost-periods.php?employee_id=:id
    if ($method === 'GET') {
        $employeeId = trim((string) ($_GET['employee_id'] ?? ''));
        if ($employeeId === '') {
            json_error('employee_id zorunludur.');
        }
        $stmt = db()->prepare(
            'SELECT * FROM ak_employee_cost_periods
             WHERE employee_id = :employee_id
             ORDER BY effective_from DESC'
        );
        $stmt->execute(['employee_id' => $employeeId]);
        json_success(['cost_periods' => $stmt->fetchAll() ?: []]);
    }

    // POST — create a new cost period (closes prior open period automatically)
    if ($method === 'POST') {
        $input      = read_admin_json_body();
        $employeeId = require_non_empty($input, 'employee_id', 'employee_id zorunludur.');
        $from       = require_iso_date($input, 'effective_from', 'effective_from geçerli bir tarih (YYYY-MM-DD) olmalıdır.');

        // Verify employee exists
        $emp = db()->prepare('SELECT id FROM ak_employees WHERE id = :id LIMIT 1');
        $emp->execute(['id' => $employeeId]);
        if (!$emp->fetch()) {
            json_error('Personel bulunamadı.', 404);
        }

        // Check UNIQUE constraint: no period may start on the same date for the same employee
        $dup = db()->prepare(
            'SELECT id FROM ak_employee_cost_periods
             WHERE employee_id = :employee_id AND effective_from = :from LIMIT 1'
        );
        $dup->execute(['employee_id' => $employeeId, 'from' => $from]);
        if ($dup->fetch()) {
            json_error('Bu personel için bu tarihte zaten bir maliyet dönemi mevcut.', 409);
        }

        // Close prior open period: set effective_to = effective_from - 1 day
        $prevDate = (new DateTimeImmutable($from))->modify('-1 day')->format('Y-m-d');
        db()->prepare(
            'UPDATE ak_employee_cost_periods
             SET effective_to = :prev_date
             WHERE employee_id = :employee_id AND effective_to IS NULL'
        )->execute(['prev_date' => $prevDate, 'employee_id' => $employeeId]);

        $id = uuid_v4();
        $payload = [
            'id'             => $id,
            'employee_id'    => $employeeId,
            'effective_from' => $from,
            'effective_to'   => null,
            'salary'         => (float) ($input['salary']         ?? 0),
            'sgk'            => (float) ($input['sgk']            ?? 0),
            'meal'           => (float) ($input['meal']           ?? 0),
            'transportation' => (float) ($input['transportation']  ?? 0),
            'bonus'          => (float) ($input['bonus']          ?? 0),
            'accommodation'  => (float) ($input['accommodation']  ?? 0),
            'other'          => (float) ($input['other']          ?? 0),
            'notes'          => nullable_string($input, 'notes'),
        ];

        $cols = array_keys($payload);
        db()->prepare(
            'INSERT INTO ak_employee_cost_periods (`' . implode('`, `', $cols) . '`) VALUES (:' . implode(', :', $cols) . ')'
        )->execute($payload);

        $row = db()->prepare('SELECT * FROM ak_employee_cost_periods WHERE id = :id');
        $row->execute(['id' => $id]);
        json_success(['cost_period' => $row->fetch()], 201);
    }

    // PATCH — update notes only (cost values are immutable after creation)
    if ($method === 'PATCH') {
        $input = read_admin_json_body();
        $id    = require_non_empty($input, 'id', 'Maliyet dönemi bulunamadı.');

        $row = db()->prepare('SELECT id FROM ak_employee_cost_periods WHERE id = :id LIMIT 1');
        $row->execute(['id' => $id]);
        if (!$row->fetch()) {
            json_error('Maliyet dönemi bulunamadı.', 404);
        }

        if (!array_key_exists('notes', $input)) {
            json_error('Sadece notes alanı güncellenebilir.');
        }
        db()->prepare('UPDATE ak_employee_cost_periods SET notes = :notes WHERE id = :id')
            ->execute(['notes' => nullable_string($input, 'notes'), 'id' => $id]);
        json_success(['updated' => true]);
    }

    // DELETE — blocked if allocations reference this period's date range
    if ($method === 'DELETE') {
        $id = trim((string) ($_GET['id'] ?? ''));
        if ($id === '') {
            $input = read_admin_json_body();
            $id    = require_non_empty($input, 'id', 'Maliyet dönemi bulunamadı.');
        }

        $period = db()->prepare('SELECT * FROM ak_employee_cost_periods WHERE id = :id LIMIT 1');
        $period->execute(['id' => $id]);
        $row = $period->fetch();
        if (!$row) {
            json_error('Maliyet dönemi bulunamadı.', 404);
        }

        // Block if any allocation's cost_date falls within this period
        $effectiveTo = $row['effective_to'] ?? date('Y-m-d');
        $check = db()->prepare(
            'SELECT id FROM ak_employee_project_allocations
             WHERE employee_id = :employee_id
               AND cost_date >= :from
               AND cost_date <= :to
             LIMIT 1'
        );
        $check->execute([
            'employee_id' => $row['employee_id'],
            'from'        => $row['effective_from'],
            'to'          => $effectiveTo,
        ]);
        if ($check->fetch()) {
            json_error('Bu maliyet dönemine ait tahsisat kayıtları mevcut olduğu için silinemez.', 409);
        }

        db()->prepare('DELETE FROM ak_employee_cost_periods WHERE id = :id')->execute(['id' => $id]);
        json_success(['deleted' => true]);
    }

    header('Allow: GET, POST, PATCH, DELETE');
    json_error('İstek yöntemi desteklenmiyor.', 405);
} catch (Throwable $exception) {
    json_error('Maliyet dönemi işlemi tamamlanamadı.', 500);
}
