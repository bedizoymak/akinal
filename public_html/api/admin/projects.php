<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

require_admin();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

$projectFields = [
    'title',
    'slug',
    'short_description',
    'detailed_description',
    'project_type',
    'project_status',
    'location',
    'city',
    'district',
    'start_year',
    'delivery_year',
    'land_area',
    'construction_area',
    'apartment_count',
    'floor_count',
    'block_count',
    'cover_image_url',
    'seo_title',
    'seo_description',
];

$decimalProjectFields = ['contract_total_try'];

try {
    if ($method === 'GET') {
        $id = trim((string) ($_GET['id'] ?? ''));
        if ($id !== '') {
            $stmt = db()->prepare('SELECT * FROM ak_projects WHERE id = :id LIMIT 1');
            $stmt->execute(['id' => $id]);
            json_success(['project' => $stmt->fetch() ?: null]);
        }

        $statement = db()->query('SELECT * FROM ak_projects ORDER BY sort_order ASC, created_at DESC');
        json_success(['projects' => $statement->fetchAll()]);
    }

    if ($method === 'POST') {
        $input = read_admin_json_body();
        $id = nullable_string($input, 'id') ?? uuid_v4();
        $payload = project_payload($input, $projectFields);
        $payload['id'] = $id;
        $payload['is_featured'] = normalize_bool($input['is_featured'] ?? false);
        $payload['is_published'] = normalize_bool($input['is_published'] ?? false);
        $payload['sort_order'] = (int) ($input['sort_order'] ?? 0);
        $payload['contract_total_try'] = nullable_decimal($input['contract_total_try'] ?? null);

        $columns = array_keys($payload);
        $sql = 'INSERT INTO ak_projects (`' . implode('`, `', $columns) . '`) VALUES (:' . implode(', :', $columns) . ')';
        db()->prepare($sql)->execute($payload);

        $stmt = db()->prepare('SELECT * FROM ak_projects WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        json_success(['project' => $stmt->fetch()], 201);
    }

    if ($method === 'PATCH') {
        $input = read_admin_json_body();
        $id = require_non_empty($input, 'id', 'Proje bulunamadı.');
        $existing = db()->prepare('SELECT id FROM ak_projects WHERE id = :id LIMIT 1');
        $existing->execute(['id' => $id]);
        if (!$existing->fetch()) {
            json_error('Proje bulunamadı.', 404);
        }
        $payload = [];

        foreach ($projectFields as $field) {
            if (array_key_exists($field, $input)) {
                $payload[$field] = in_array($field, ['title', 'slug', 'short_description', 'project_type', 'project_status', 'location'], true)
                    ? require_non_empty($input, $field, 'Zorunlu proje alanı eksik.')
                    : nullable_string($input, $field);
            }
        }
        foreach (['is_featured', 'is_published'] as $field) {
            if (array_key_exists($field, $input)) {
                $payload[$field] = normalize_bool($input[$field]);
            }
        }
        if (array_key_exists('sort_order', $input)) {
            $payload['sort_order'] = (int) $input['sort_order'];
        }
        if (array_key_exists('contract_total_try', $input)) {
            $payload['contract_total_try'] = nullable_decimal($input['contract_total_try']);
        }

        if ($payload === []) {
            json_error('Güncellenecek proje alanı bulunamadı.');
        }

        $sets = array_map(static fn($field) => "`{$field}` = :{$field}", array_keys($payload));
        $payload['id'] = $id;
        db()->prepare('UPDATE ak_projects SET ' . implode(', ', $sets) . ' WHERE id = :id')->execute($payload);

        $stmt = db()->prepare('SELECT * FROM ak_projects WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        json_success(['project' => $stmt->fetch()]);
    }

    if ($method === 'DELETE') {
        $id = trim((string) ($_GET['id'] ?? ''));
        if ($id === '') {
            $input = read_admin_json_body();
            $id = require_non_empty($input, 'id', 'Proje bulunamadı.');
        }
        $existing = db()->prepare('SELECT id FROM ak_projects WHERE id = :id LIMIT 1');
        $existing->execute(['id' => $id]);
        if (!$existing->fetch()) {
            json_error('Proje bulunamadı.', 404);
        }
        $pdo = db();
        $pdo->beginTransaction();
        try {
            $counts = [];
            // Check if ak_payment_plan_settlements exists (late-added table; may be absent on older installs)
            $settlementsExist = (bool) $pdo->query(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'ak_payment_plan_settlements'"
            )->fetchColumn();
            if ($settlementsExist) {
                // 1a. Settlements linked to this project's payment plans (RESTRICT on payment_plan_id)
                $s = $pdo->prepare('DELETE FROM ak_payment_plan_settlements WHERE payment_plan_id IN (SELECT id FROM ak_payment_plans WHERE project_id = :id)');
                $s->execute(['id' => $id]); $counts['payment_plan_settlements_via_plans'] = $s->rowCount();
                // 1b. Settlements linked to this project's legacy financial entries (RESTRICT on financial_entry_id)
                $s = $pdo->prepare('DELETE FROM ak_payment_plan_settlements WHERE financial_entry_id IN (SELECT id FROM ak_financial_entries WHERE project_id = :id)');
                $s->execute(['id' => $id]); $counts['payment_plan_settlements_via_entries'] = $s->rowCount();
            }
            // 3. Canonical financial entries (all four owner tables)
            $s = $pdo->prepare('DELETE FROM ak_customer_financial_entries WHERE project_id = :id');
            $s->execute(['id' => $id]); $counts['customer_financial_entries'] = $s->rowCount();
            $s = $pdo->prepare('DELETE FROM ak_employee_financial_entries WHERE project_id = :id');
            $s->execute(['id' => $id]); $counts['employee_financial_entries'] = $s->rowCount();
            $s = $pdo->prepare('DELETE FROM ak_supplier_financial_entries WHERE project_id = :id');
            $s->execute(['id' => $id]); $counts['supplier_financial_entries'] = $s->rowCount();
            $s = $pdo->prepare('DELETE FROM ak_expense_card_financial_entries WHERE project_id = :id');
            $s->execute(['id' => $id]); $counts['expense_card_financial_entries'] = $s->rowCount();
            // Determine which optional/legacy tables exist in this install
            $optionalTables = [];
            $optCheck = $pdo->query(
                "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN ('ak_project_expense_transactions','ak_financial_entries','ak_payment_plans','ak_payments','ak_expenses','ak_employee_project_assignments','ak_employee_project_allocations')"
            );
            foreach ($optCheck->fetchAll(PDO::FETCH_COLUMN) as $t) {
                $optionalTables[$t] = true;
            }

            // 4. Expense transactions (RESTRICT on project_id; absent in some installs)
            if (isset($optionalTables['ak_project_expense_transactions'])) {
                $s = $pdo->prepare('DELETE FROM ak_project_expense_transactions WHERE project_id = :id');
                $s->execute(['id' => $id]); $counts['project_expense_transactions'] = $s->rowCount();
            }
            // 5. Legacy financial entries (SET NULL FK; delete for clean removal)
            if (isset($optionalTables['ak_financial_entries'])) {
                $s = $pdo->prepare('DELETE FROM ak_financial_entries WHERE project_id = :id');
                $s->execute(['id' => $id]); $counts['financial_entries'] = $s->rowCount();
            }
            // 6. Payment plans (RESTRICT; settlements already removed above)
            if (isset($optionalTables['ak_payment_plans'])) {
                $s = $pdo->prepare('DELETE FROM ak_payment_plans WHERE project_id = :id');
                $s->execute(['id' => $id]); $counts['payment_plans'] = $s->rowCount();
            }
            // 7. Employee assignments and allocations (optional; absent in some installs)
            if (isset($optionalTables['ak_employee_project_assignments'])) {
                $s = $pdo->prepare('DELETE FROM ak_employee_project_assignments WHERE project_id = :id');
                $s->execute(['id' => $id]); $counts['employee_project_assignments'] = $s->rowCount();
            }
            if (isset($optionalTables['ak_employee_project_allocations'])) {
                $s = $pdo->prepare('DELETE FROM ak_employee_project_allocations WHERE project_id = :id');
                $s->execute(['id' => $id]); $counts['employee_project_allocations'] = $s->rowCount();
            }
            // 8. Legacy payments and expenses (SET NULL FK; delete for clean removal)
            if (isset($optionalTables['ak_payments'])) {
                $s = $pdo->prepare('DELETE FROM ak_payments WHERE project_id = :id');
                $s->execute(['id' => $id]); $counts['payments'] = $s->rowCount();
            }
            if (isset($optionalTables['ak_expenses'])) {
                $s = $pdo->prepare('DELETE FROM ak_expenses WHERE project_id = :id');
                $s->execute(['id' => $id]); $counts['expenses'] = $s->rowCount();
            }
            // 9. Project images (CASCADE; explicit for clarity)
            $s = $pdo->prepare('DELETE FROM ak_project_images WHERE project_id = :id');
            $s->execute(['id' => $id]); $counts['project_images'] = $s->rowCount();
            // 10. Customer-project links (CASCADE; explicit for clarity)
            $s = $pdo->prepare('DELETE FROM ak_customer_projects WHERE project_id = :id');
            $s->execute(['id' => $id]); $counts['customer_projects'] = $s->rowCount();
            // media_library and notifications use SET NULL FKs — DB handles them on DELETE
            // 11. Parent
            $pdo->prepare('DELETE FROM ak_projects WHERE id = :id')->execute(['id' => $id]);
            $pdo->commit();
            json_success(['deleted' => true, 'counts' => $counts]);
        } catch (Throwable $txEx) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            error_log(sprintf('[projects] DELETE id=%s %s code=%s: %s in %s:%d', $id, get_class($txEx), $txEx->getCode(), $txEx->getMessage(), basename($txEx->getFile()), $txEx->getLine()));
            json_error('Proje silinemedi. [' . $txEx->getCode() . '] ' . $txEx->getMessage(), 500);
        }
    }

    header('Allow: GET, POST, PATCH, DELETE');
    json_error('İstek yöntemi desteklenmiyor.', 405);
} catch (Throwable $exception) {
    error_log(sprintf('[projects] %s %s: %s in %s:%d', $method ?? 'UNKNOWN', get_class($exception), $exception->getMessage(), basename($exception->getFile()), $exception->getLine()));
    $safeReason = ($exception instanceof PDOException) ? 'Veritabanı hatası: ' . $exception->getCode() : get_class($exception);
    json_error('Proje işlemi tamamlanamadı. (' . $safeReason . ')', 500);
}

function nullable_decimal(mixed $value): ?float
{
    if ($value === null || $value === '' || $value === false) {
        return null;
    }
    $f = (float) $value;
    return is_nan($f) || is_infinite($f) ? null : round($f, 2);
}

function project_payload(array $input, array $fields): array
{
    return [
        'title' => require_non_empty($input, 'title', 'Proje adı zorunludur.'),
        'slug' => require_non_empty($input, 'slug', 'Slug zorunludur.'),
        'short_description' => require_non_empty($input, 'short_description', 'Kısa açıklama zorunludur.'),
        'detailed_description' => nullable_string($input, 'detailed_description'),
        'project_type' => require_non_empty($input, 'project_type', 'Proje türü zorunludur.'),
        'project_status' => require_non_empty($input, 'project_status', 'Proje durumu zorunludur.'),
        'location' => require_non_empty($input, 'location', 'Konum zorunludur.'),
        'city' => nullable_string($input, 'city'),
        'district' => nullable_string($input, 'district'),
        'start_year' => nullable_string($input, 'start_year'),
        'delivery_year' => nullable_string($input, 'delivery_year'),
        'land_area' => nullable_string($input, 'land_area'),
        'construction_area' => nullable_string($input, 'construction_area'),
        'apartment_count' => nullable_string($input, 'apartment_count'),
        'floor_count' => nullable_string($input, 'floor_count'),
        'block_count' => nullable_string($input, 'block_count'),
        'cover_image_url' => nullable_string($input, 'cover_image_url'),
        'seo_title' => nullable_string($input, 'seo_title'),
        'seo_description' => nullable_string($input, 'seo_description'),
    ];
}
