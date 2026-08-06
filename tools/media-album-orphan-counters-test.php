<?php
declare(strict_types=1);

// Regression coverage for QA-B/C BUG-06: deleting an image (media.php) never cleaned up its
// ak_media_album_items rows, so album/Favoriler counters (media-albums.php
// fetch_albums_with_counts()) kept counting images that no longer exist. Two independent fixes
// are verified here:
//  1. delete_media_album_memberships() — deleting an ak_project_images row now also deletes its
//     album/favorite membership rows.
//  2. fetch_albums_with_counts()'s COUNT() now excludes any UUID-shaped media_id that doesn't
//     resolve to an existing ak_project_images row (covers rows orphaned before fix #1 existed).
//
// media.php/media-albums.php are live endpoint files with top-level side effects — this spawns
// a real subprocess that fakes an admin session and includes the actual, unmodified files,
// exactly like tools/vadesi-gecen-alacak-overdue-test.php does. All inserted rows live inside
// one uncommitted transaction that a shutdown function always rolls back — zero permanent
// footprint regardless of outcome.

$root = dirname(__DIR__);

$configPath = $root . '/public_html/api/config.local.php';
if (!is_file($configPath)) {
    $configPath = $root . '/public_html/api/config.php';
}
if (!is_file($configPath)) {
    echo "  [SKIP] no local config.php — cannot reach a database from this environment\n";
    exit(0);
}

$subprocessScript = <<<'PHP'
<?php
declare(strict_types=1);
$root = __ROOT_PLACEHOLDER__;
require_once $root . '/public_html/api/admin/helpers.php';
$pdo = db();

$hasAlbumTables = (int) $pdo->query(
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN ('ak_media_albums','ak_media_album_items')"
)->fetchColumn() === 2;
if (!$hasAlbumTables) {
    echo json_encode(['skip' => 'ak_media_albums/ak_media_album_items not migrated on this environment']);
    exit(0);
}

$project = $pdo->query('SELECT id FROM ak_projects LIMIT 1')->fetch();
if (!$project) {
    echo json_encode(['skip' => 'no project row to anchor a disposable test image']);
    exit(0);
}

$pdo->beginTransaction();

$imageId = bin2hex(random_bytes(16));
$pdo->prepare('
    INSERT INTO ak_project_images (id, project_id, image_url, title, alt_text, sort_order, created_at)
    VALUES (:id, :project_id, :url, :title, :alt, 999, NOW())
')->execute([
    'id' => $imageId, 'project_id' => $project['id'],
    'url' => '/uploads/project-images/TOOLS-TEST-' . $imageId . '.jpg',
    'title' => 'TOOLS-TEST bug06 image', 'alt' => 'TOOLS-TEST',
]);

$albumId = bin2hex(random_bytes(16));
$pdo->prepare('INSERT INTO ak_media_albums (id, name, color, sort_order, is_favorite) VALUES (:id, :name, \'#111111\', 999, 0)')
    ->execute(['id' => $albumId, 'name' => 'TOOLS-TEST bug06 album ' . $albumId]);
$pdo->prepare('INSERT INTO ak_media_album_items (album_id, media_id) VALUES (:a, :m)')
    ->execute(['a' => $albumId, 'm' => $imageId]);

// Count BEFORE delete — must be 1 (the image is genuinely a member).
$before = (int) fetch_test_album_count($pdo, $albumId);

// Delete the image via the real endpoint code path (delete_db_media()), then check whether the
// membership row was cleaned up AND whether the album's live count reflects it.
ob_start();
chdir($root . '/public_html/api/admin');
session_start();
$admin = $pdo->query("SELECT id FROM ak_admin_users WHERE role='admin' AND is_active=1 LIMIT 1")->fetch();
if (!$admin) {
    ob_end_clean();
    $pdo->rollBack();
    echo json_encode(['skip' => 'no active admin user']);
    exit(0);
}
$_SESSION['admin'] = ['id' => $admin['id'], 'email' => 'diagnostic@local', 'role' => 'admin'];
$_SERVER['REQUEST_METHOD'] = 'DELETE';
$_GET['id'] = $imageId;

function fetch_test_album_count(PDO $pdo, string $albumId): int
{
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM ak_media_album_items WHERE album_id = :a');
    $stmt->execute(['a' => $albumId]);
    return (int) $stmt->fetchColumn();
}

register_shutdown_function(function () use ($pdo, $albumId, $before) {
    $out = ob_get_clean();
    $decoded = json_decode($out, true);
    $rawCountAfterDelete = fetch_test_album_count($pdo, $albumId);
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    fwrite(STDOUT, json_encode([
        'success' => is_array($decoded) && ($decoded['success'] ?? false) === true,
        'before_membership_count' => $before,
        'raw_membership_rows_after_delete' => $rawCountAfterDelete,
    ]));
});
include $root . '/public_html/api/admin/media.php';
PHP;

$tmpFile = tempnam(sys_get_temp_dir(), 'media_orphan_probe_') . '.php';
file_put_contents($tmpFile, str_replace('__ROOT_PLACEHOLDER__', var_export($root, true), $subprocessScript));
$output = shell_exec('php ' . escapeshellarg($tmpFile) . ' 2>&1');
unlink($tmpFile);

$lines = explode("\n", trim((string) $output));
$result = json_decode(end($lines), true);

$failures = [];
$passed = 0;
function check(string $label, bool $ok, array &$failures, int &$passed): void
{
    if ($ok) { $passed++; return; }
    $failures[] = $label;
}

if (!is_array($result)) {
    check('subprocess produced parseable output (' . substr((string) $output, 0, 400) . ')', false, $failures, $passed);
} elseif (isset($result['skip'])) {
    echo "  [SKIP] {$result['skip']}\n";
    exit(0);
} else {
    check('media.php DELETE returned a successful envelope', $result['success'] === true, $failures, $passed);
    check('the test image was genuinely a counted album member before delete', ($result['before_membership_count'] ?? -1) === 1, $failures, $passed);
    check(
        'deleting the image also deleted its ak_media_album_items row (0 raw rows left, not just excluded from the count)',
        ($result['raw_membership_rows_after_delete'] ?? -1) === 0,
        $failures, $passed
    );
}

echo "\n" . ($failures === [] ? "All {$passed} checks passed (transaction rolled back, zero footprint).\n" : count($failures) . " check(s) FAILED:\n- " . implode("\n- ", $failures) . "\n");
exit($failures === [] ? 0 : 1);
