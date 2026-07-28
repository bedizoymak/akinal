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

        // Guard: never cascade-delete a project's linked business/financial/media records.
        // This used to silently delete 10+ related tables behind a single confirm() with no
        // preview of what would be lost. Block the delete and report exact linked counts
        // instead (see audit P0 item F) — a project can only be deleted once it has zero
        // linked records in every table below.
        $linkedTableLabels = [
            'ak_project_images'                => 'proje görseli',
            'ak_customer_projects'              => 'müşteri bağlantısı',
            'ak_customer_financial_entries'     => 'müşteri finansal hareketi',
            'ak_employee_financial_entries'     => 'personel finansal hareketi',
            'ak_supplier_financial_entries'     => 'tedarikçi finansal hareketi',
            'ak_expense_card_financial_entries' => 'masraf kartı finansal hareketi',
            'ak_employee_project_assignments'   => 'personel görevlendirmesi',
            'ak_employee_project_allocations'   => 'personel maliyet tahsisatı',
            'ak_government_progress_payments'   => 'devlet hakedişi',
            'ak_project_expense_transactions'   => 'proje gider kaydı (deprecated)',
            'ak_payment_plans'                  => 'ödeme planı (legacy)',
            'ak_payments'                       => 'tahsilat (legacy)',
            'ak_expenses'                       => 'gider (legacy)',
        ];
        $existingTables = $pdo->query(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN ('"
            . implode("','", array_keys($linkedTableLabels)) . "')"
        )->fetchAll(PDO::FETCH_COLUMN);

        $blockedBy = [];
        foreach ($existingTables as $table) {
            $s = $pdo->prepare("SELECT COUNT(*) FROM `{$table}` WHERE project_id = :id");
            $s->execute(['id' => $id]);
            $count = (int) $s->fetchColumn();
            if ($count > 0) {
                $blockedBy[] = $linkedTableLabels[$table] . " ({$count})";
            }
        }

        if ($blockedBy) {
            json_error(
                'Bu proje silinemez, bağlı kayıtları var: ' . implode(', ', $blockedBy) . '. '
                . 'Finansal geçmişi ve medya kayıtlarını korumak için proje yalnızca hiçbir bağlı kaydı yoksa silinebilir.',
                409
            );
        }

        // No linked records anywhere — safe to remove the empty project.
        $pdo->prepare('DELETE FROM ak_projects WHERE id = :id')->execute(['id' => $id]);
        json_success(['deleted' => true]);
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
