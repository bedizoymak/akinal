<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

require_admin();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        $statement = db()->query(
            'SELECT i.*, p.title AS project_title, p.slug AS project_slug
             FROM ak_project_images i
             LEFT JOIN ak_projects p ON p.id = i.project_id
             ORDER BY i.created_at DESC'
        );
        json_success(['images' => $statement->fetchAll()]);
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

    header('Allow: GET, DELETE');
    json_error('Method not allowed.', 405);
} catch (Throwable $exception) {
    json_error('Medya işlemi tamamlanamadı.', 500);
}
