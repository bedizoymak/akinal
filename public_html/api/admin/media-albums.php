<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

require_admin();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        if (!album_tables_exist()) {
            json_success(['albums' => [], 'tables_pending' => true]);
        }
        ensure_favorites_album();
        json_success(['albums' => fetch_albums_with_counts()]);
    }

    if ($method === 'POST' || $method === 'PATCH' || $method === 'DELETE') {
        if (!album_tables_exist()) {
            json_error('Albüm tabloları henüz oluşturulmamış. Lütfen veritabanı şemasını güncelleyin.', 503);
        }
    }

    if ($method === 'POST') {
        $input = read_admin_json_body();
        $action = nullable_string($input, 'action') ?? 'create';

        if ($action === 'assign') {
            $albumId = require_non_empty($input, 'album_id', 'Albüm ID gereklidir.');
            $mediaId = require_non_empty($input, 'media_id', 'Medya ID gereklidir.');

            $check = db()->prepare('SELECT id FROM ak_media_albums WHERE id = :id LIMIT 1');
            $check->execute(['id' => $albumId]);
            if (!$check->fetch()) {
                json_error('Albüm bulunamadı.', 404);
            }

            db()->prepare(
                'INSERT IGNORE INTO ak_media_album_items (album_id, media_id) VALUES (:album_id, :media_id)'
            )->execute(['album_id' => $albumId, 'media_id' => $mediaId]);

            json_success(['assigned' => true]);
        }

        if ($action === 'remove') {
            $albumId = require_non_empty($input, 'album_id', 'Albüm ID gereklidir.');
            $mediaId = require_non_empty($input, 'media_id', 'Medya ID gereklidir.');

            db()->prepare(
                'DELETE FROM ak_media_album_items WHERE album_id = :album_id AND media_id = :media_id'
            )->execute(['album_id' => $albumId, 'media_id' => $mediaId]);

            json_success(['removed' => true]);
        }

        // default: create album
        $name = require_non_empty($input, 'name', 'Albüm adı gereklidir.');
        if (mb_strlen($name, 'UTF-8') > 255) {
            json_error('Albüm adı çok uzun.');
        }

        $color = nullable_string($input, 'color');
        if ($color !== null && !preg_match('/^#[0-9a-fA-F]{3,6}$/', $color)) {
            json_error('Geçersiz renk formatı. #RRGGBB veya #RGB kullanın.', 422);
        }

        $maxOrder = (int) db()->query('SELECT COALESCE(MAX(sort_order), 0) FROM ak_media_albums')->fetchColumn();
        $id = uuid_v4();

        db()->prepare(
            'INSERT INTO ak_media_albums (id, name, color, sort_order, is_favorite)
             VALUES (:id, :name, :color, :sort_order, 0)'
        )->execute(['id' => $id, 'name' => $name, 'color' => $color, 'sort_order' => $maxOrder + 1]);

        $row = fetch_album_by_id($id);
        json_success(['album' => $row], 201);
    }

    if ($method === 'PATCH') {
        $id = trim((string) ($_GET['id'] ?? ''));
        $input = read_admin_json_body();
        if ($id === '') {
            $id = require_non_empty($input, 'id', 'Albüm ID gereklidir.');
        }

        $check = db()->prepare('SELECT id, is_favorite FROM ak_media_albums WHERE id = :id LIMIT 1');
        $check->execute(['id' => $id]);
        $existing = $check->fetch();
        if (!$existing) {
            json_error('Albüm bulunamadı.', 404);
        }

        $sets = [];
        $params = ['id' => $id];

        if (array_key_exists('name', $input)) {
            if ((bool) $existing['is_favorite']) {
                json_error('Favoriler albümü yeniden adlandırılamaz.', 422);
            }
            $name = require_non_empty($input, 'name', 'Albüm adı boş olamaz.');
            if (mb_strlen($name, 'UTF-8') > 255) {
                json_error('Albüm adı çok uzun.');
            }
            $sets[] = 'name = :name';
            $params['name'] = $name;
        }

        if (array_key_exists('color', $input)) {
            $color = nullable_string($input, 'color');
            if ($color !== null && !preg_match('/^#[0-9a-fA-F]{3,6}$/', $color)) {
                json_error('Geçersiz renk formatı. #RRGGBB veya #RGB kullanın.', 422);
            }
            $sets[] = 'color = :color';
            $params['color'] = $color;
        }

        if ($sets !== []) {
            db()->prepare('UPDATE ak_media_albums SET ' . implode(', ', $sets) . ' WHERE id = :id')
               ->execute($params);
        }

        json_success(['album' => fetch_album_by_id($id)]);
    }

    if ($method === 'DELETE') {
        $id = trim((string) ($_GET['id'] ?? ''));
        if ($id === '') {
            $input = read_admin_json_body();
            $id = require_non_empty($input, 'id', 'Albüm ID gereklidir.');
        }

        $check = db()->prepare('SELECT id, is_favorite FROM ak_media_albums WHERE id = :id LIMIT 1');
        $check->execute(['id' => $id]);
        $existing = $check->fetch();
        if (!$existing) {
            json_error('Albüm bulunamadı.', 404);
        }
        if ((bool) $existing['is_favorite']) {
            json_error('Favoriler albümü silinemez.', 422);
        }

        // CASCADE on fk_media_album_items_album removes items automatically
        db()->prepare('DELETE FROM ak_media_albums WHERE id = :id')->execute(['id' => $id]);
        json_success(['deleted' => true]);
    }

    header('Allow: GET, POST, PATCH, DELETE');
    json_error('İstek yöntemi desteklenmiyor.', 405);
} catch (Throwable $exception) {
    json_error('Albüm işlemi tamamlanamadı: ' . $exception->getMessage(), 500);
}

function album_tables_exist(): bool
{
    try {
        $stmt = db()->prepare(
            "SELECT COUNT(*) FROM information_schema.tables
             WHERE table_schema = DATABASE()
               AND table_name IN ('ak_media_albums', 'ak_media_album_items')"
        );
        $stmt->execute();
        return (int) $stmt->fetchColumn() === 2;
    } catch (Throwable $e) {
        return false;
    }
}

function ensure_favorites_album(): void
{
    $stmt = db()->query('SELECT id FROM ak_media_albums WHERE is_favorite = 1 LIMIT 1');
    if ($stmt->fetch()) {
        return;
    }
    $id = uuid_v4();
    db()->prepare(
        'INSERT INTO ak_media_albums (id, name, color, sort_order, is_favorite)
         VALUES (:id, :name, :color, 0, 1)'
    )->execute(['id' => $id, 'name' => 'Favoriler', 'color' => '#f59e0b']);
}

function fetch_albums_with_counts(): array
{
    // Deleting an image (media.php) now also deletes its ak_media_album_items rows going
    // forward, but rows orphaned by earlier deletions (before that fix existed) can still be
    // sitting in the table — that's exactly what inflated album/Favoriler counters past the
    // real image count (QA-B/C BUG-06). Rather than requiring a destructive cleanup migration
    // just to get an accurate number, only count items whose media_id still resolves to a row
    // in ak_project_images. Non-DB media ids (`fs:...`, `site-setting:...`, `project-cover:...`
    // — the latter two are always "protected" and can never be deleted via media.php, so they
    // can't orphan that way) are left uncounted-toward-validation here and instead always
    // counted, matching their previous behavior, since there is no single SQL-queryable table to
    // validate them against.
    $stmt = db()->query(
        "SELECT a.id, a.name, a.color, a.sort_order, a.is_favorite, a.created_at,
                COUNT(CASE
                        WHEN i.media_id REGEXP '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
                        THEN pi.id
                        ELSE i.media_id
                      END) AS item_count
         FROM ak_media_albums a
         LEFT JOIN ak_media_album_items i ON i.album_id = a.id
         LEFT JOIN ak_project_images pi
           ON pi.id = i.media_id
          AND i.media_id REGEXP '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
         GROUP BY a.id
         ORDER BY a.is_favorite DESC, a.sort_order ASC, a.created_at ASC"
    );
    $albums = $stmt->fetchAll() ?: [];
    foreach ($albums as &$album) {
        $album['item_count'] = (int) $album['item_count'];
        $album['is_favorite'] = (bool) $album['is_favorite'];
    }
    return $albums;
}

function fetch_album_by_id(string $id): array
{
    // Intentionally does not JOIN ak_media_album_items — avoids failure on partial
    // migrations and the count is derived from the list endpoint which aggregates.
    $stmt = db()->prepare(
        'SELECT id, name, color, sort_order, is_favorite, created_at
         FROM ak_media_albums
         WHERE id = :id
         LIMIT 1'
    );
    $stmt->execute(['id' => $id]);
    $row = $stmt->fetch();
    if (!$row) {
        json_error('Albüm bulunamadı.', 404);
    }
    $row['item_count'] = 0;
    $row['is_favorite'] = (bool) $row['is_favorite'];
    return $row;
}
