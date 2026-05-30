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
        $stmt = db()->prepare('DELETE FROM ak_projects WHERE id = :id');
        $stmt->execute(['id' => $id]);
        json_success(['deleted' => true]);
    }

    header('Allow: GET, POST, PATCH, DELETE');
    json_error('Method not allowed.', 405);
} catch (Throwable $exception) {
    json_error('Proje işlemi tamamlanamadı.', 500);
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
