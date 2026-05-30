<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

require_method('GET');

$slug = trim((string) ($_GET['slug'] ?? ''));

if ($slug === '') {
    json_error('Missing required slug parameter.', 400);
}

try {
    $projectStatement = db()->prepare('SELECT * FROM ak_projects WHERE slug = :slug AND is_published = 1 LIMIT 1');
    $projectStatement->execute(['slug' => $slug]);
    $project = $projectStatement->fetch();

    if (!$project) {
        json_error('Project not found.', 404);
    }

    $imageStatement = db()->prepare('
        SELECT id, project_id, image_url, thumbnail_url, title, alt_text, sort_order, created_at
        FROM ak_project_images
        WHERE project_id = :project_id
        ORDER BY sort_order ASC, created_at ASC
    ');
    $imageStatement->execute(['project_id' => $project['id']]);

    json_success([
        'project' => $project,
        'images' => $imageStatement->fetchAll(),
    ]);
} catch (Throwable $exception) {
    json_error('Unable to load project detail.', 500);
}
