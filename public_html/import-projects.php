<?php
declare(strict_types=1);

/**
 * One-time Akinal project JSON importer.
 *
 * Upload the export JSON to public_html/import-data/ and run with:
 * import-projects.php?confirm=IMPORT_AKINAL_PROJECTS
 *
 * Delete this file and the uploaded JSON immediately after a successful import.
 */

const IMPORT_CONFIRM_TOKEN = 'IMPORT_AKINAL_PROJECTS';
const IMPORT_JSON_PATH = __DIR__ . '/import-data/akinal-projeler-export-2026-05-30-07-11.json';

if (($_GET['confirm'] ?? '') !== IMPORT_CONFIRM_TOKEN) {
    output_import_report([
        'status' => 'locked',
        'message' => 'Importer is locked. Run with ?confirm=IMPORT_AKINAL_PROJECTS to import intentionally.',
    ]);
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    output_import_report([
        'status' => 'error',
        'message' => 'Method not allowed. Use GET with the confirm parameter.',
    ], 405);
}

require_once __DIR__ . '/api/db.php';

try {
    $payload = load_export_payload(IMPORT_JSON_PATH);
    $projects = extract_projects($payload);
    $topLevelImages = extract_top_level_images($payload);

    $stats = [
        'total_projects' => count($projects),
        'imported_projects' => 0,
        'skipped_demo_projects' => 0,
        'image_rows_imported' => 0,
        'warnings' => [],
    ];

    $pdo = db();
    $pdo->beginTransaction();

    $findProject = $pdo->prepare('SELECT id, slug FROM ak_projects WHERE id = :id OR slug = :slug LIMIT 1');
    $insertProject = $pdo->prepare(project_insert_sql());
    $updateProject = $pdo->prepare(project_update_sql());
    $findImage = $pdo->prepare('SELECT id FROM ak_project_images WHERE id = :id LIMIT 1');
    $insertImage = $pdo->prepare(project_image_insert_sql());
    $updateImage = $pdo->prepare(project_image_update_sql());

    foreach ($projects as $project) {
        if (!is_array($project)) {
            $stats['warnings'][] = 'Skipped a project entry because it was not an object.';
            continue;
        }

        $title = trim((string) ($project['title'] ?? ''));
        if (starts_with($title, 'DEMO_DATA_')) {
            $stats['skipped_demo_projects']++;
            continue;
        }

        if ($title === '' || empty($project['id']) || empty($project['slug'])) {
            $stats['warnings'][] = 'Skipped a project because id, slug, or title was missing.';
            continue;
        }

        $projectRow = normalize_project_row($project, $stats['warnings']);

        $findProject->execute([
            'id' => $projectRow['id'],
            'slug' => $projectRow['slug'],
        ]);
        $existingProject = $findProject->fetch();

        if ($existingProject) {
            $updateProject->execute($projectRow + ['where_id' => $existingProject['id']]);
        } else {
            $insertProject->execute($projectRow);
        }
        $stats['imported_projects']++;

        $projectImages = extract_project_images($project, $topLevelImages, $projectRow['id']);
        foreach ($projectImages as $image) {
            if (!is_array($image)) {
                $stats['warnings'][] = 'Skipped an image for "' . $title . '" because it was not an object.';
                continue;
            }

            $imageRow = normalize_project_image_row($image, $projectRow['id'], $stats['warnings']);
            if ($imageRow === null) {
                continue;
            }

            $findImage->execute(['id' => $imageRow['id']]);
            if ($findImage->fetch()) {
                $updateImage->execute($imageRow + ['where_id' => $imageRow['id']]);
            } else {
                $insertImage->execute($imageRow);
            }
            $stats['image_rows_imported']++;
        }
    }

    $pdo->commit();

    output_import_report([
        'status' => 'success',
        'message' => 'Project import finished.',
        'total_projects_in_json' => $stats['total_projects'],
        'imported_projects_count' => $stats['imported_projects'],
        'skipped_demo_projects_count' => $stats['skipped_demo_projects'],
        'image_rows_imported_count' => $stats['image_rows_imported'],
        'warnings' => $stats['warnings'],
        'reminder' => 'Delete import-projects.php and the uploaded import-data JSON immediately after success.',
    ]);
} catch (Throwable $exception) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    output_import_report([
        'status' => 'error',
        'message' => 'Project import failed.',
        'error' => $exception->getMessage(),
    ], 500);
}

function load_export_payload(string $path): array
{
    if (!is_file($path)) {
        throw new RuntimeException('JSON file not found at public_html/import-data/akinal-projeler-export-2026-05-30-07-11.json.');
    }

    $json = file_get_contents($path);
    if ($json === false) {
        throw new RuntimeException('JSON file could not be read.');
    }

    $payload = json_decode($json, true);
    if (!is_array($payload)) {
        throw new RuntimeException('JSON file is invalid or does not contain an object/array payload.');
    }

    return $payload;
}

function extract_projects(array $payload): array
{
    if (isset($payload['projects']) && is_array($payload['projects'])) {
        return $payload['projects'];
    }

    if (isset($payload['data']['projects']) && is_array($payload['data']['projects'])) {
        return $payload['data']['projects'];
    }

    if (array_is_list_compat($payload)) {
        return $payload;
    }

    throw new RuntimeException('Could not find a projects array in the JSON export.');
}

function extract_top_level_images(array $payload): array
{
    foreach (['project_images', 'images'] as $key) {
        if (isset($payload[$key]) && is_array($payload[$key])) {
            return $payload[$key];
        }
        if (isset($payload['data'][$key]) && is_array($payload['data'][$key])) {
            return $payload['data'][$key];
        }
    }

    return [];
}

function extract_project_images(array $project, array $topLevelImages, string $projectId): array
{
    foreach (['project_images', 'images'] as $key) {
        if (isset($project[$key]) && is_array($project[$key])) {
            return $project[$key];
        }
    }

    if ($topLevelImages === []) {
        return [];
    }

    return array_values(array_filter($topLevelImages, static function ($image) use ($projectId): bool {
        return is_array($image) && (string) ($image['project_id'] ?? '') === $projectId;
    }));
}

function normalize_project_row(array $project, array &$warnings): array
{
    $coverImageUrl = nullable_string($project['cover_image_url'] ?? null);
    if ($coverImageUrl !== null && starts_with($coverImageUrl, '/src/assets/')) {
        $warnings[] = 'Project "' . (string) $project['title'] . '" has local dev cover image "' . $coverImageUrl . '"; imported cover_image_url as NULL.';
        $coverImageUrl = null;
    }

    return [
        'id' => required_string($project, 'id'),
        'title' => required_string($project, 'title'),
        'slug' => required_string($project, 'slug'),
        'short_description' => (string) ($project['short_description'] ?? ''),
        'detailed_description' => nullable_string($project['detailed_description'] ?? null),
        'project_type' => (string) ($project['project_type'] ?? ''),
        'project_status' => (string) ($project['project_status'] ?? ''),
        'location' => (string) ($project['location'] ?? ''),
        'city' => nullable_string($project['city'] ?? null),
        'district' => nullable_string($project['district'] ?? null),
        'start_year' => nullable_string($project['start_year'] ?? null),
        'delivery_year' => nullable_string($project['delivery_year'] ?? null),
        'land_area' => nullable_string($project['land_area'] ?? null),
        'construction_area' => nullable_string($project['construction_area'] ?? null),
        'apartment_count' => nullable_string($project['apartment_count'] ?? null),
        'floor_count' => nullable_string($project['floor_count'] ?? null),
        'block_count' => nullable_string($project['block_count'] ?? null),
        'cover_image_url' => $coverImageUrl,
        'is_featured' => bool_to_int($project['is_featured'] ?? false),
        'is_published' => bool_to_int($project['is_published'] ?? false),
        'sort_order' => (int) ($project['sort_order'] ?? 0),
        'seo_title' => nullable_string($project['seo_title'] ?? null),
        'seo_description' => nullable_string($project['seo_description'] ?? null),
        'created_at' => mysql_datetime($project['created_at'] ?? null),
        'updated_at' => mysql_datetime($project['updated_at'] ?? null),
    ];
}

function normalize_project_image_row(array $image, string $projectId, array &$warnings): ?array
{
    $imageUrl = nullable_string($image['image_url'] ?? $image['url'] ?? null);
    if ($imageUrl === null) {
        $warnings[] = 'Skipped a project image because image_url was missing.';
        return null;
    }

    if (starts_with($imageUrl, '/src/assets/')) {
        $warnings[] = 'Skipped project image "' . $imageUrl . '" because /src/assets does not exist in production.';
        return null;
    }

    $thumbnailUrl = nullable_string($image['thumbnail_url'] ?? null);
    if ($thumbnailUrl !== null && starts_with($thumbnailUrl, '/src/assets/')) {
        $warnings[] = 'Image thumbnail "' . $thumbnailUrl . '" points to /src/assets; imported thumbnail_url as NULL.';
        $thumbnailUrl = null;
    }

    return [
        'id' => nullable_string($image['id'] ?? null) ?: uuidv4_import(),
        'project_id' => $projectId,
        'image_url' => $imageUrl,
        'thumbnail_url' => $thumbnailUrl,
        'title' => nullable_string($image['title'] ?? null),
        'alt_text' => nullable_string($image['alt_text'] ?? null),
        'sort_order' => (int) ($image['sort_order'] ?? 0),
        'created_at' => mysql_datetime($image['created_at'] ?? null),
    ];
}

function project_insert_sql(): string
{
    return 'INSERT INTO ak_projects (
        id, title, slug, short_description, detailed_description, project_type, project_status,
        location, city, district, start_year, delivery_year, land_area, construction_area,
        apartment_count, floor_count, block_count, cover_image_url, is_featured, is_published,
        sort_order, seo_title, seo_description, created_at, updated_at
    ) VALUES (
        :id, :title, :slug, :short_description, :detailed_description, :project_type, :project_status,
        :location, :city, :district, :start_year, :delivery_year, :land_area, :construction_area,
        :apartment_count, :floor_count, :block_count, :cover_image_url, :is_featured, :is_published,
        :sort_order, :seo_title, :seo_description, :created_at, :updated_at
    )';
}

function project_update_sql(): string
{
    return 'UPDATE ak_projects SET
        id = :id,
        title = :title,
        slug = :slug,
        short_description = :short_description,
        detailed_description = :detailed_description,
        project_type = :project_type,
        project_status = :project_status,
        location = :location,
        city = :city,
        district = :district,
        start_year = :start_year,
        delivery_year = :delivery_year,
        land_area = :land_area,
        construction_area = :construction_area,
        apartment_count = :apartment_count,
        floor_count = :floor_count,
        block_count = :block_count,
        cover_image_url = :cover_image_url,
        is_featured = :is_featured,
        is_published = :is_published,
        sort_order = :sort_order,
        seo_title = :seo_title,
        seo_description = :seo_description,
        created_at = :created_at,
        updated_at = :updated_at
        WHERE id = :where_id';
}

function project_image_insert_sql(): string
{
    return 'INSERT INTO ak_project_images (
        id, project_id, image_url, thumbnail_url, title, alt_text, sort_order, created_at
    ) VALUES (
        :id, :project_id, :image_url, :thumbnail_url, :title, :alt_text, :sort_order, :created_at
    )';
}

function project_image_update_sql(): string
{
    return 'UPDATE ak_project_images SET
        project_id = :project_id,
        image_url = :image_url,
        thumbnail_url = :thumbnail_url,
        title = :title,
        alt_text = :alt_text,
        sort_order = :sort_order,
        created_at = :created_at
        WHERE id = :where_id';
}

function required_string(array $row, string $key): string
{
    $value = nullable_string($row[$key] ?? null);
    if ($value === null) {
        throw new RuntimeException('Required field "' . $key . '" is missing.');
    }

    return $value;
}

function nullable_string($value): ?string
{
    if ($value === null) {
        return null;
    }

    $string = trim((string) $value);
    return $string === '' ? null : $string;
}

function bool_to_int($value): int
{
    if (is_bool($value)) {
        return $value ? 1 : 0;
    }

    if (is_numeric($value)) {
        return ((int) $value) === 1 ? 1 : 0;
    }

    return in_array(strtolower((string) $value), ['1', 'true', 'yes', 'evet'], true) ? 1 : 0;
}

function mysql_datetime($value): string
{
    if ($value === null || $value === '') {
        return date('Y-m-d H:i:s');
    }

    try {
        $date = new DateTimeImmutable((string) $value);
        return $date->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
    } catch (Throwable $exception) {
        return date('Y-m-d H:i:s');
    }
}

function uuidv4_import(): string
{
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);

    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function array_is_list_compat(array $array): bool
{
    $expected = 0;
    foreach ($array as $key => $_value) {
        if ($key !== $expected++) {
            return false;
        }
    }

    return true;
}

function starts_with(string $value, string $prefix): bool
{
    return substr($value, 0, strlen($prefix)) === $prefix;
}

function output_import_report(array $report, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: text/plain; charset=utf-8');
    header('X-Content-Type-Options: nosniff');

    echo "Akinal project import report\n";
    echo "============================\n\n";
    foreach ($report as $key => $value) {
        if (is_array($value)) {
            echo $key . ":\n";
            if ($value === []) {
                echo "  - none\n";
                continue;
            }
            foreach ($value as $item) {
                echo "  - " . (is_scalar($item) ? (string) $item : json_encode($item, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)) . "\n";
            }
            continue;
        }

        echo $key . ': ' . (string) $value . "\n";
    }
    exit;
}
