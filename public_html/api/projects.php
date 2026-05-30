<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

require_method('GET');

$fields = [
    'id',
    'title',
    'slug',
    'short_description',
    'project_type',
    'project_status',
    'location',
    'city',
    'district',
    'cover_image_url',
    'is_featured',
    'sort_order',
    'created_at',
    'updated_at',
];

try {
    $sql = 'SELECT ' . implode(', ', $fields) . '
        FROM ak_projects
        WHERE is_published = 1
        ORDER BY sort_order ASC, created_at DESC';
    $statement = db()->query($sql);

    json_success(['projects' => $statement->fetchAll()]);
} catch (Throwable $exception) {
    json_error('Unable to load projects.', 500);
}
