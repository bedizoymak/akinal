<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

require_admin();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        json_success(['images' => collect_media_images()]);
    }

    if ($method === 'DELETE') {
        $id = trim((string) ($_GET['id'] ?? ''));
        if ($id === '') {
            $input = read_admin_json_body();
            $id = require_non_empty($input, 'id', 'Görsel bulunamadı.');
        }

        if (substr($id, 0, 3) === 'fs:') {
            delete_filesystem_media($id);
            json_success(['deleted' => true]);
        }

        db()->prepare('DELETE FROM ak_project_images WHERE id = :id')->execute(['id' => $id]);
        json_success(['deleted' => true]);
    }

    header('Allow: GET, DELETE');
    json_error('Method not allowed.', 405);
} catch (Throwable $exception) {
    json_error('Medya işlemi tamamlanamadı.', 500);
}

function collect_media_images(): array
{
    $images = [];
    $seen = [];

    $statement = db()->query(
        'SELECT i.*, p.title AS project_title, p.slug AS project_slug
         FROM ak_project_images i
         LEFT JOIN ak_projects p ON p.id = i.project_id
         ORDER BY i.created_at DESC'
    );

    foreach ($statement->fetchAll() ?: [] as $row) {
        add_media_image($images, $seen, $row);
    }

    $coverStatement = db()->query(
        'SELECT id AS project_id, title AS project_title, slug AS project_slug, cover_image_url, created_at
         FROM ak_projects
         WHERE cover_image_url IS NOT NULL AND cover_image_url <> ""
         ORDER BY created_at DESC'
    );

    foreach ($coverStatement->fetchAll() ?: [] as $project) {
        add_media_image($images, $seen, [
            'id' => 'project-cover:' . sha1((string) $project['cover_image_url']),
            'project_id' => $project['project_id'],
            'image_url' => $project['cover_image_url'],
            'thumbnail_url' => null,
            'title' => 'Kapak görseli',
            'alt_text' => $project['project_title'],
            'sort_order' => null,
            'created_at' => $project['created_at'] ?? null,
            'project_title' => $project['project_title'],
            'project_slug' => $project['project_slug'],
            'source_type' => 'project_cover',
            'can_delete' => false,
        ]);
    }

    foreach (site_setting_image_rows() as $row) {
        add_media_image($images, $seen, $row);
    }

    foreach (filesystem_project_images() as $row) {
        add_media_image($images, $seen, $row);
    }

    return array_values($images);
}

function add_media_image(array &$images, array &$seen, array $row): void
{
    $url = trim((string) ($row['image_url'] ?? ''));
    if ($url === '') {
        return;
    }

    $key = normalize_media_url($url);
    if (isset($seen[$key])) {
        return;
    }

    $seen[$key] = true;
    $row['file_name'] = $row['file_name'] ?? basename(parse_url($url, PHP_URL_PATH) ?: $url);
    $row['source_type'] = $row['source_type'] ?? 'project_image';
    $row['can_delete'] = $row['can_delete'] ?? true;
    $images[] = $row;
}

function normalize_media_url(string $url): string
{
    $path = parse_url($url, PHP_URL_PATH);
    return strtolower($path ? trim($path) : trim($url));
}

function site_setting_image_rows(): array
{
    try {
        $columns = db()->query('SHOW COLUMNS FROM ak_site_settings')->fetchAll() ?: [];
    } catch (Throwable $exception) {
        return [];
    }

    $imageColumns = [];
    foreach ($columns as $column) {
        $field = (string) ($column['Field'] ?? '');
        if (preg_match('/(image|logo|favicon|og_|photo|picture)/i', $field)) {
            $imageColumns[] = $field;
        }
    }

    if ($imageColumns === []) {
        return [];
    }

    $select = implode(', ', array_map(static fn($field) => '`' . str_replace('`', '``', $field) . '`', $imageColumns));
    $row = db()->query('SELECT ' . $select . ' FROM ak_site_settings ORDER BY updated_at DESC LIMIT 1')->fetch();
    if (!is_array($row)) {
        return [];
    }

    $images = [];
    foreach ($imageColumns as $field) {
        $url = trim((string) ($row[$field] ?? ''));
        if ($url === '') {
            continue;
        }
        $images[] = [
            'id' => 'site-setting:' . sha1($field . ':' . $url),
            'project_id' => null,
            'image_url' => $url,
            'thumbnail_url' => null,
            'title' => $field,
            'alt_text' => 'Site ayarı',
            'sort_order' => null,
            'created_at' => null,
            'project_title' => 'Site Ayarları',
            'project_slug' => null,
            'source_type' => 'site_setting',
            'can_delete' => false,
        ];
    }

    return $images;
}

function filesystem_project_images(): array
{
    $baseDir = dirname(__DIR__, 2) . '/uploads/project-images';
    if (!is_dir($baseDir)) {
        return [];
    }

    $files = glob($baseDir . '/*.{jpg,jpeg,png,webp,gif}', GLOB_BRACE);
    if (!is_array($files)) {
        return [];
    }

    usort($files, static fn($left, $right) => filemtime($right) <=> filemtime($left));

    $images = [];
    foreach ($files as $file) {
        if (!is_file($file)) {
            continue;
        }

        $filename = basename($file);
        $url = '/uploads/project-images/' . $filename;
        $images[] = [
            'id' => 'fs:' . sha1($url),
            'project_id' => null,
            'image_url' => $url,
            'thumbnail_url' => null,
            'title' => $filename,
            'alt_text' => $filename,
            'sort_order' => null,
            'created_at' => date('Y-m-d H:i:s', filemtime($file)),
            'project_title' => 'Yüklenen Dosyalar',
            'project_slug' => null,
            'source_type' => 'filesystem',
            'can_delete' => true,
        ];
    }

    return $images;
}

function delete_filesystem_media(string $id): void
{
    $baseDir = dirname(__DIR__, 2) . '/uploads/project-images';
    if (!is_dir($baseDir)) {
        json_error('Dosya bulunamadı.', 404);
    }

    foreach (filesystem_project_images() as $image) {
        if (($image['id'] ?? '') !== $id) {
            continue;
        }

        $file = realpath($baseDir . '/' . basename((string) $image['file_name']));
        $base = realpath($baseDir);
        if ($file === false || $base === false || substr($file, 0, strlen($base . DIRECTORY_SEPARATOR)) !== $base . DIRECTORY_SEPARATOR) {
            json_error('Dosya yolu doğrulanamadı.', 400);
        }

        if (is_file($file) && !unlink($file)) {
            json_error('Dosya silinemedi.', 500);
        }

        return;
    }

    json_error('Dosya bulunamadı.', 404);
}
