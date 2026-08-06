<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

require_admin();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// ak_employee_project_allocations ships in install-schema.php but that installer is
// gated and must be run manually — an environment that hasn't had it (re-)run yet
// would otherwise 500 on every method here. See employee-personnel-tables-apply.php.
require_admin_tables(['ak_employee_project_allocations'], 'Tahsisat tablosu henüz oluşturulmadı. Lütfen sistem yöneticisiyle iletişime geçin.');

try {
    // GET — by project_id or employee_id
    if ($method === 'GET') {
        $projectId  = trim((string) ($_GET['project_id'] ?? ''));
        $employeeId = trim((string) ($_GET['employee_id'] ?? ''));

        if ($projectId !== '') {
            $stmt = db()->prepare(
                'SELECT a.*, e.full_name AS employee_name
                 FROM ak_employee_project_allocations a
                 JOIN ak_employees e ON e.id = a.employee_id
                 WHERE a.project_id = :project_id
                 ORDER BY a.allocation_year DESC, a.allocation_month DESC, e.full_name ASC'
            );
            $stmt->execute(['project_id' => $projectId]);
        } elseif ($employeeId !== '') {
            $stmt = db()->prepare(
                'SELECT a.*, p.title AS project_title
                 FROM ak_employee_project_allocations a
                 JOIN ak_projects p ON p.id = a.project_id
                 WHERE a.employee_id = :employee_id
                 ORDER BY a.allocation_year DESC, a.allocation_month DESC, p.title ASC'
            );
            $stmt->execute(['employee_id' => $employeeId]);
        } else {
            json_error('project_id veya employee_id zorunludur.');
        }

        json_success(['allocations' => $stmt->fetchAll() ?: []]);
    }

    // POST — create allocation (full snapshot write path)
    if ($method === 'POST') {
        $input      = read_admin_json_body();
        $employeeId = require_non_empty($input, 'employee_id', 'employee_id zorunludur.');
        $projectId  = require_non_empty($input, 'project_id', 'project_id zorunludur.');

        $year  = (int) ($input['allocation_year'] ?? 0);
        $month = (int) ($input['allocation_month'] ?? 0);
        if ($year < 2000 || $year > 2100) {
            json_error('allocation_year geçerli bir yıl olmalıdır.');
        }
        if ($month < 1 || $month > 12) {
            json_error('allocation_month 1–12 arasında olmalıdır.');
        }

        $daysWorked = (float) ($input['days_worked'] ?? 0);
        if ($daysWorked <= 0) {
            json_error('days_worked 0\'dan büyük olmalıdır.');
        }

        $workingDaysBase = (int) ($input['working_days_base'] ?? 0);
        if ($workingDaysBase <= 0 || $workingDaysBase > 31) {
            json_error('working_days_base 1–31 arasında olmalıdır.');
        }

        // Validate employee and project exist
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

        // Step 1a: days_worked ceiling check (across all projects, this employee+month)
        $existing = db()->prepare(
            'SELECT COALESCE(SUM(days_worked), 0) AS total_days
             FROM ak_employee_project_allocations
             WHERE employee_id = :employee_id
               AND allocation_year = :year
               AND allocation_month = :month'
        );
        $existing->execute(['employee_id' => $employeeId, 'year' => $year, 'month' => $month]);
        $totalDays = (float) $existing->fetch()['total_days'];
        if (($totalDays + $daysWorked) > $workingDaysBase) {
            json_error('Bu personel için ilgili ayda toplam çalışma günü çalışma günü bazını aşamaz.');
        }

        // Step 2: Find active cost period for this month
        $monthStart = sprintf('%04d-%02d-01', $year, $month);
        $monthEnd   = (new DateTimeImmutable($monthStart))->modify('last day of this month')->format('Y-m-d');

        $period = db()->prepare(
            'SELECT * FROM ak_employee_cost_periods
             WHERE employee_id = :employee_id
               AND effective_from <= :month_end
               AND (effective_to IS NULL OR effective_to >= :month_start)
             ORDER BY effective_from DESC
             LIMIT 1'
        );
        $period->execute([
            'employee_id' => $employeeId,
            'month_end'   => $monthEnd,
            'month_start' => $monthStart,
        ]);
        $cp = $period->fetch();
        if (!$cp) {
            json_error('Bu personel için ilgili ayda aktif maliyet dönemi bulunamadı. Önce maliyet dönemi oluşturun.');
        }

        // Step 3: Compute snapshot values
        $salary         = (float) $cp['salary'];
        $sgk            = (float) $cp['sgk'];
        $meal           = (float) $cp['meal'];
        $transportation = (float) $cp['transportation'];
        $bonus          = (float) $cp['bonus'];
        $accommodation  = (float) $cp['accommodation'];
        $other          = (float) $cp['other'];
        $monthlyCost    = $salary + $sgk + $meal + $transportation + $bonus + $accommodation + $other;
        $calculatedCost = $workingDaysBase > 0
            ? round(($daysWorked / $workingDaysBase) * $monthlyCost, 2)
            : 0.0;

        $id = uuid_v4();
        db()->prepare(
            'INSERT INTO ak_employee_project_allocations (
               id, employee_id, project_id,
               allocation_year, allocation_month,
               days_worked, working_days_base,
               cost_date,
               salary_snapshot, sgk_snapshot, meal_snapshot,
               transportation_snapshot, bonus_snapshot, accommodation_snapshot,
               other_snapshot, monthly_cost_snapshot, calculated_cost,
               notes
             ) VALUES (
               :id, :employee_id, :project_id,
               :allocation_year, :allocation_month,
               :days_worked, :working_days_base,
               :cost_date,
               :salary_snapshot, :sgk_snapshot, :meal_snapshot,
               :transportation_snapshot, :bonus_snapshot, :accommodation_snapshot,
               :other_snapshot, :monthly_cost_snapshot, :calculated_cost,
               :notes
             )'
        )->execute([
            'id'                      => $id,
            'employee_id'             => $employeeId,
            'project_id'              => $projectId,
            'allocation_year'         => $year,
            'allocation_month'        => $month,
            'days_worked'             => $daysWorked,
            'working_days_base'       => $workingDaysBase,
            'cost_date'               => $cp['effective_from'],
            'salary_snapshot'         => $salary,
            'sgk_snapshot'            => $sgk,
            'meal_snapshot'           => $meal,
            'transportation_snapshot' => $transportation,
            'bonus_snapshot'          => $bonus,
            'accommodation_snapshot'  => $accommodation,
            'other_snapshot'          => $other,
            'monthly_cost_snapshot'   => $monthlyCost,
            'calculated_cost'         => $calculatedCost,
            'notes'                   => nullable_string($input, 'notes'),
        ]);

        $row = db()->prepare('SELECT * FROM ak_employee_project_allocations WHERE id = :id');
        $row->execute(['id' => $id]);
        json_success(['allocation' => $row->fetch()], 201);
    }

    // PATCH — update days_worked / working_days_base / notes only
    // Snapshot columns are NEVER updated. calculated_cost is recomputed from stored snapshots.
    if ($method === 'PATCH') {
        $input = read_admin_json_body();
        $id    = require_non_empty($input, 'id', 'Tahsisat bulunamadı.');

        $existing = db()->prepare('SELECT * FROM ak_employee_project_allocations WHERE id = :id LIMIT 1');
        $existing->execute(['id' => $id]);
        $alloc = $existing->fetch();
        if (!$alloc) {
            json_error('Tahsisat bulunamadı.', 404);
        }

        $updates = [];
        $params  = ['id' => $id];

        $daysWorked      = array_key_exists('days_worked', $input)      ? (float) $input['days_worked']      : (float) $alloc['days_worked'];
        $workingDaysBase = array_key_exists('working_days_base', $input) ? (int)   $input['working_days_base'] : (int)   $alloc['working_days_base'];

        if (array_key_exists('days_worked', $input)) {
            if ($daysWorked <= 0) {
                json_error('days_worked 0\'dan büyük olmalıdır.');
            }
            $updates[] = 'days_worked = :days_worked';
            $params['days_worked'] = $daysWorked;
        }
        if (array_key_exists('working_days_base', $input)) {
            if ($workingDaysBase <= 0 || $workingDaysBase > 31) {
                json_error('working_days_base 1–31 arasında olmalıdır.');
            }
            $updates[] = 'working_days_base = :working_days_base';
            $params['working_days_base'] = $workingDaysBase;
        }
        if (array_key_exists('notes', $input)) {
            $updates[] = 'notes = :notes';
            $params['notes'] = nullable_string($input, 'notes');
        }

        // days_worked ceiling check (excluding this row's current contribution)
        if (array_key_exists('days_worked', $input) || array_key_exists('working_days_base', $input)) {
            $otherDays = db()->prepare(
                'SELECT COALESCE(SUM(days_worked), 0) AS total_days
                 FROM ak_employee_project_allocations
                 WHERE employee_id = :employee_id
                   AND allocation_year = :year
                   AND allocation_month = :month
                   AND id != :id'
            );
            $otherDays->execute([
                'employee_id' => $alloc['employee_id'],
                'year'        => $alloc['allocation_year'],
                'month'       => $alloc['allocation_month'],
                'id'          => $id,
            ]);
            $totalOther = (float) $otherDays->fetch()['total_days'];
            if (($totalOther + $daysWorked) > $workingDaysBase) {
                json_error('Bu personel için ilgili ayda toplam çalışma günü çalışma günü bazını aşamaz.');
            }

            // Recompute calculated_cost from stored snapshots (snapshot columns are never touched)
            $newCost = $workingDaysBase > 0
                ? round(($daysWorked / $workingDaysBase) * (float) $alloc['monthly_cost_snapshot'], 2)
                : 0.0;
            $updates[] = 'calculated_cost = :calculated_cost';
            $params['calculated_cost'] = $newCost;
        }

        if (empty($updates)) {
            json_error('Güncellenecek alan bulunamadı.');
        }

        db()->prepare('UPDATE ak_employee_project_allocations SET ' . implode(', ', $updates) . ' WHERE id = :id')
            ->execute($params);

        $row = db()->prepare('SELECT * FROM ak_employee_project_allocations WHERE id = :id');
        $row->execute(['id' => $id]);
        json_success(['allocation' => $row->fetch()]);
    }

    if ($method === 'DELETE') {
        $id = trim((string) ($_GET['id'] ?? ''));
        if ($id === '') {
            $input = read_admin_json_body();
            $id    = require_non_empty($input, 'id', 'Tahsisat bulunamadı.');
        }

        $row = db()->prepare('SELECT id FROM ak_employee_project_allocations WHERE id = :id LIMIT 1');
        $row->execute(['id' => $id]);
        if (!$row->fetch()) {
            json_error('Tahsisat bulunamadı.', 404);
        }

        db()->prepare('DELETE FROM ak_employee_project_allocations WHERE id = :id')->execute(['id' => $id]);
        json_success(['deleted' => true]);
    }

    header('Allow: GET, POST, PATCH, DELETE');
    json_error('İstek yöntemi desteklenmiyor.', 405);
} catch (Throwable $exception) {
    json_error('Tahsisat işlemi tamamlanamadı.', 500);
}
