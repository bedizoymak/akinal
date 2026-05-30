<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

require_admin();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        $projectId = trim((string) ($_GET['project_id'] ?? ''));
        if ($projectId === '') {
            $statement = db()->query('SELECT * FROM ak_project_images ORDER BY sort_order ASC, created_at DESC');
            json_success(['images' => $statement->fetchAll()]);
        }

        $stmt = db()->prepare('SELECT * FROM ak_project_images WHERE project_id = :project_id ORDER BY sort_order ASC, created_at ASC');
        $stmt->execute(['project_id' => $projectId]);
        json_success(['images' => $stmt->fetchAll()]);
    }

    if ($method === 'POST') {
        $input = read_admin_json_body();
        $id = nullable_string($input, 'id') ?? uuid_v4();
        $payload = image_payload($input);
        $payload['id'] = $id;

        $columns = array_keys($payload);
        db()->prepare('INSERT INTO ak_project_images (`' . implode('`, `', $columns) . '`) VALUES (:' . implode(', :', $columns) . ')')->execute($payload);

        $stmt = db()->prepare('SELECT * FROM ak_project_images WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        json_success(['image' => $stmt->fetch()], 201);
    }

    if ($method === 'PATCH') {
        $input = read_admin_json_body();
        $id = require_non_empty($input, 'id', 'Görsel bulunamadı.');
        $payload = [];
        foreach (['project_id', 'image_url', 'thumbnail_url', 'title', 'alt_text'] as $field) {
            if (array_key_exists($field, $input)) {
                $payload[$field] = in_array($field, ['project_id', 'image_url'], true)
                    ? require_non_empty($input, $field, 'Zorunlu görsel alanı eksik.')
                    : nullable_string($input, $field);
            }
        }
        if (array_key_exists('sort_order', $input)) {
            $payload['sort_order'] = (int) $input['sort_order'];
        }
        if ($payload === []) {
            json_error('Güncellenecek görsel alanı bulunamadı.');
        }

        $sets = array_map(static fn($field) => "`{$field}` = :{$field}", array_keys($payload));
        $payload['id'] = $id;
        db()->prepare('UPDATE ak_project_images SET ' . implode(', ', $sets) . ' WHERE id = :id')->execute($payload);

        $stmt = db()->prepare('SELECT * FROM ak_project_images WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        json_success(['image' => $stmt->fetch()]);
    }

    if ($method === 'DELETE') {
        $id = trim((string) ($_GET['id'] ?? ''));
        if ($id === '') {
            $input = read_admin_json_body();
            $id = require_non_empty($input, 'id', 'Görsel bulunamadı.');
        }
        db()->prepare('DELETE FROM ak_project_images WHERE id = :id')->execute(['id' => $id]);
        json_success(['deleted' => true]);
    }

    header('Allow: GET, POST, PATCH, DELETE');
    json_error('Method not allowed.', 405);
} catch (Throwable $exception) {
    json_error('Görsel işlemi tamamlanamadı.', 500);
}

function image_payload(array $input): array
{
    return [
        'project_id' => require_non_empty($input, 'project_id', 'Proje bilgisi zorunludur.'),
        'image_url' => require_non_empty($input, 'image_url', 'Görsel URL zorunludur.'),
        'thumbnail_url' => nullable_string($input, 'thumbnail_url'),
        'title' => nullable_string($input, 'title'),
        'alt_text' => nullable_string($input, 'alt_text'),
        'sort_order' => (int) ($input['sort_order'] ?? 0),
    ];
}
