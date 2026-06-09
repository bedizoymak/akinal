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
        $path = trim((string) ($_GET['path'] ?? ''));
        if ($id === '' && $path === '') {
            $input = read_admin_json_body();
            $id = nullable_string($input, 'id') ?? '';
            $path = nullable_string($input, 'path') ?? '';
        }

        if ($id === '' && $path === '') {
            json_error('Görsel bulunamadı.');
        }

        if ($path !== '') {
            ensure_media_not_protected($path);
            delete_media_by_path($path);
            json_success(['deleted' => true]);
        }

        if (substr($id, 0, 3) === 'fs:') {
            delete_filesystem_media($id);
            json_success(['deleted' => true]);
        }

        $deletedPath = media_path_for_db_id($id);
        if ($deletedPath !== null) {
            ensure_media_not_protected($deletedPath);
        }
        $deletedPath = delete_db_media($id);
        if ($deletedPath !== null && is_safe_project_upload_url($deletedPath)) {
            delete_upload_file_by_url($deletedPath, false);
        }

        json_success(['deleted' => true]);
    }

    header('Allow: GET, DELETE');
    json_error('İstek yöntemi desteklenmiyor.', 405);
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
        $row['source_type'] = 'project_gallery';
        $row['source_label'] = 'Proje Galerisi';
        $row['can_delete'] = true;
        $row['is_protected'] = false;
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
            'source_label' => 'Kapak Resmi',
            'can_delete' => false,
            'is_protected' => true,
            'protected_reason' => 'Bu görsel önce ilgili ayardan/projeden kaldırılmalı',
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
        $index = $seen[$key];
        if (($row['can_delete'] ?? true) === false) {
            $images[$index]['can_delete'] = false;
            $images[$index]['is_protected'] = true;
            $images[$index]['protected_reason'] = $row['protected_reason'] ?? 'Bu görsel önce ilgili ayardan/projeden kaldırılmalı';
        }
        $labels = array_filter(array_unique(array_merge(
            explode(', ', (string) ($images[$index]['source_label'] ?? '')),
            [(string) ($row['source_label'] ?? media_source_label((string) ($row['source_type'] ?? '')))]
        )));
        $images[$index]['source_label'] = implode(', ', $labels);
        return;
    }

    $seen[$key] = count($images);
    $row['file_name'] = $row['file_name'] ?? basename(parse_url($url, PHP_URL_PATH) ?: $url);
    $row['source_type'] = $row['source_type'] ?? 'project_gallery';
    $row['source_label'] = $row['source_label'] ?? media_source_label((string) $row['source_type']);
    $row['can_delete'] = $row['can_delete'] ?? true;
    $row['is_protected'] = $row['is_protected'] ?? ($row['can_delete'] === false);
    $row['protected_reason'] = $row['protected_reason'] ?? ($row['is_protected'] ? 'Bu görsel önce ilgili ayardan/projeden kaldırılmalı' : null);
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
        if (preg_match('/(image|logo|favicon|og_|photo|picture|hero|home|homepage|about)/i', $field)) {
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
        if ($url === '' || !looks_like_image_reference($url)) {
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
            'source_label' => 'Site Ayarı',
            'can_delete' => false,
            'is_protected' => true,
            'protected_reason' => 'Bu görsel önce ilgili ayardan/projeden kaldırılmalı',
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
            'source_label' => 'Yüklenen Dosya',
            'can_delete' => true,
            'is_protected' => false,
        ];
    }

    return $images;
}

function delete_filesystem_media(string $id): void
{
    foreach (filesystem_project_images() as $image) {
        if (($image['id'] ?? '') !== $id) {
            continue;
        }
        ensure_media_not_protected((string) $image['image_url']);
        delete_upload_file_by_url((string) $image['image_url'], true);
        return;
    }

    json_error('Dosya bulunamadı.', 404);
}

function delete_media_by_path(string $path): void
{
    $normalized = '/' . ltrim($path, '/');
    delete_db_media_by_url($normalized);
    delete_upload_file_by_url($normalized, true);
}

function media_path_for_db_id(string $id): ?string
{
    $stmt = db()->prepare('SELECT image_url FROM ak_project_images WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $id]);
    $row = $stmt->fetch();
    return is_array($row) ? (string) ($row['image_url'] ?? '') : null;
}

function delete_db_media(string $id): ?string
{
    $stmt = db()->prepare('SELECT image_url FROM ak_project_images WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $id]);
    $row = $stmt->fetch();
    if (!is_array($row)) {
        return null;
    }

    db()->prepare('DELETE FROM ak_project_images WHERE id = :id')->execute(['id' => $id]);
    return (string) ($row['image_url'] ?? '');
}

function delete_db_media_by_url(string $url): void
{
    db()->prepare('DELETE FROM ak_project_images WHERE image_url = :url')->execute(['url' => $url]);
}

function ensure_media_not_protected(string $url): void
{
    $normalized = normalize_media_url($url);

    $cover = db()->prepare('SELECT id FROM ak_projects WHERE cover_image_url = :url OR cover_image_url = :path LIMIT 1');
    $cover->execute(['url' => $url, 'path' => '/' . ltrim($url, '/')]);
    if ($cover->fetch()) {
        json_error('Bu görsel önce ilgili ayardan/projeden kaldırılmalı.', 409);
    }

    foreach (site_setting_image_rows() as $row) {
        if (normalize_media_url((string) ($row['image_url'] ?? '')) === $normalized) {
            json_error('Bu görsel önce ilgili ayardan/projeden kaldırılmalı.', 409);
        }
    }
}

function delete_upload_file_by_url(string $url, bool $missingIsError): void
{
    if (!is_safe_project_upload_url($url)) {
        if ($missingIsError) {
            json_error('Dosya yolu doğrulanamadı.', 400);
        }
        return;
    }

    $baseDir = dirname(__DIR__, 2) . '/uploads/project-images';
    $base = realpath($baseDir);
    if ($base === false) {
        if ($missingIsError) {
            json_error('Dosya bulunamadı.', 404);
        }
        return;
    }

    $path = parse_url($url, PHP_URL_PATH) ?: $url;
    $file = realpath($baseDir . '/' . basename($path));
    if ($file === false || substr($file, 0, strlen($base . DIRECTORY_SEPARATOR)) !== $base . DIRECTORY_SEPARATOR) {
        if ($missingIsError) {
            json_error('Dosya bulunamadı.', 404);
        }
        return;
    }

    if (is_file($file) && !unlink($file)) {
        json_error('Dosya silinemedi.', 500);
    }
}

function is_safe_project_upload_url(string $url): bool
{
    $path = parse_url($url, PHP_URL_PATH) ?: $url;
    return preg_match('#^/uploads/project-images/[^/]+\.(jpe?g|png|webp|gif)$#i', $path) === 1;
}

function media_source_label(string $sourceType): string
{
    if ($sourceType === 'project_cover') {
        return 'Proje Kapak Görseli';
    }
    if ($sourceType === 'project_gallery') {
        return 'Proje Galerisi';
    }
    if ($sourceType === 'site_setting') {
        return 'Site Ayarı';
    }
    if ($sourceType === 'filesystem') {
        return 'Yüklenen Dosya';
    }
    return 'Proje Galerisi';
}

function looks_like_image_reference(string $value): bool
{
    $trimmed = trim($value);
    if ($trimmed === '') {
        return false;
    }

    $path = parse_url($trimmed, PHP_URL_PATH) ?: $trimmed;
    if (preg_match('/\.(jpe?g|png|webp|gif|svg|ico)$/i', $path)) {
        return true;
    }

    return preg_match('#^/(uploads|assets|public)/#i', $path) === 1;
}
