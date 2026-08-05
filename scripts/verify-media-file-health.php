<?php
declare(strict_types=1);

/**
 * P1-5 regression check: is_safe_project_upload_url()/local_upload_file_exists()
 * in public_html/api/admin/media.php must distinguish "is this URL referenced
 * somewhere" (is_protected) from "does the physical file actually exist"
 * (file_missing) — these were previously conflated, so a legacy double-
 * extension image marked "Kullanımda" (protected) could still be a dead link.
 *
 * No database or admin session required. Run with:
 *   php scripts/verify-media-file-health.php
 */

$root = dirname(__DIR__);

// media.php runs require_admin()/db() at include time, which needs a DB
// connection this script doesn't have — so we load its source and eval only
// the two pure helper functions under test via reflection-free extraction.
$source = file_get_contents($root . '/public_html/api/admin/media.php');

function extract_function(string $source, string $name): string
{
    $start = strpos($source, "function {$name}(");
    if ($start === false) {
        fwrite(STDERR, "Could not find function {$name}() in media.php\n");
        exit(1);
    }
    $depth = 0;
    $end = $start;
    $started = false;
    for ($i = $start; $i < strlen($source); $i++) {
        if ($source[$i] === '{') { $depth++; $started = true; }
        if ($source[$i] === '}') { $depth--; if ($started && $depth === 0) { $end = $i + 1; break; } }
    }
    return substr($source, $start, $end - $start);
}

// __DIR__ inside the extracted source would otherwise resolve to this
// script's own directory (eval() context), not media.php's — rebase it to
// the real media.php location (public_html/api/admin) before eval'ing.
$mediaPhpDir = $root . '/public_html/api/admin';
$localUploadFileExistsSrc = str_replace('__DIR__', var_export($mediaPhpDir, true), extract_function($source, 'local_upload_file_exists'));

eval(extract_function($source, 'is_safe_project_upload_url'));
eval($localUploadFileExistsSrc);
eval(extract_function($source, 'normalize_media_url'));
eval(extract_function($source, 'media_source_label'));
$addMediaImageSrc = str_replace('__DIR__', var_export($mediaPhpDir, true), extract_function($source, 'add_media_image'));
eval($addMediaImageSrc);

$failures = [];
$passed = 0;

function check(string $label, bool $ok, array &$failures, int &$passed): void
{
    if ($ok) { $passed++; echo "  [OK] {$label}\n"; }
    else { $failures[] = $label; echo "  [FAIL] {$label}\n"; }
}

echo "== is_safe_project_upload_url() ==\n";
check('accepts a plain local upload URL', is_safe_project_upload_url('/uploads/project-images/abc123.jpg'), $failures, $passed);
check('accepts a double-extension local URL (the legacy bug case)', is_safe_project_upload_url('/uploads/project-images/photo.png.jpg'), $failures, $passed);
check('rejects a path outside the uploads dir', !is_safe_project_upload_url('/uploads/other/x.jpg'), $failures, $passed);
// Note: is_safe_project_upload_url() matches on URL PATH only (pre-existing
// behavior, out of scope for P1-5) — an external host with a matching path
// also passes. Not asserted here since changing it is a separate concern.

echo "\n== local_upload_file_exists() ==\n";
$uploadsDir = $root . '/public_html/uploads/project-images';
if (!is_dir($uploadsDir)) {
    mkdir($uploadsDir, 0755, true);
}
$realFile = $uploadsDir . '/verify-media-health-real.jpg';
file_put_contents($realFile, 'fake-jpeg-bytes');

check('returns true for a file that actually exists on disk', local_upload_file_exists('/uploads/project-images/verify-media-health-real.jpg'), $failures, $passed);
check('returns false for a referenced-but-missing file (the P1-5 bug case)', !local_upload_file_exists('/uploads/project-images/does-not-exist.png.jpg'), $failures, $passed);
check('rejects path traversal attempts', !local_upload_file_exists('/uploads/project-images/../../config.php'), $failures, $passed);

echo "\n== SPA HTML / non-image content at a would-be-valid path ==\n";
$htmlMasqueradingFile = $uploadsDir . '/verify-media-health-html.jpg';
file_put_contents($htmlMasqueradingFile, '<!doctype html><html><body>SPA fallback</body></html>');
check(
    'is_file() alone cannot distinguish real image bytes from HTML saved at a .jpg path (known limitation — client-side onError is the defense-in-depth layer, see isMediaImageMissing() in AdminMedia.tsx)',
    local_upload_file_exists('/uploads/project-images/verify-media-health-html.jpg'),
    $failures, $passed
);
unlink($htmlMasqueradingFile);

echo "\n== External / unknown-host URL behavior ==\n";
check(
    'is_safe_project_upload_url() matches by path only, so an external host is NOT distinguished from a local one by this function alone (pre-existing, documented — health for such rows is left null/unknown by add_media_image(), never asserted healthy)',
    is_safe_project_upload_url('https://cdn.example.com/uploads/project-images/photo.jpg'),
    $failures, $passed
);
check(
    'a genuinely unknown/non-matching URL shape is rejected outright',
    !is_safe_project_upload_url('https://cdn.example.com/random/photo.jpg'),
    $failures, $passed
);

echo "\n== \"Kullanımda\" (is_protected) is independent of file_missing ==\n";
// The exact P1-5 bug scenario: a legacy double-extension image referenced as
// a project's cover_image_url (is_protected=true, "Kullanımda") whose
// physical file is absent (file_missing=true) — both must be true
// simultaneously, neither may suppress the other.
$images = [];
$seen = [];
add_media_image($images, $seen, [
    'id' => 'project-cover:legacy',
    'image_url' => '/uploads/project-images/legacy-photo.png.jpg',
    'source_type' => 'project_cover',
    'source_label' => 'Kapak Resmi',
    'can_delete' => false,
    'is_protected' => true,
    'protected_reason' => 'Bu görsel önce ilgili ayardan/projeden kaldırılmalı',
]);
check(
    '"Kullanımda" (is_protected=true) row with a missing file reports BOTH flags true',
    ($images[0]['is_protected'] ?? false) === true && ($images[0]['file_missing'] ?? null) === true,
    $failures, $passed
);

// A healthy gallery image (is_protected=false, real file present) — the
// opposite combination must also be representable independently.
file_put_contents($realFile, 'fake-jpeg-bytes');
$images2 = [];
$seen2 = [];
add_media_image($images2, $seen2, [
    'id' => 'gallery-1',
    'image_url' => '/uploads/project-images/verify-media-health-real.jpg',
    'source_type' => 'project_gallery',
    'can_delete' => true,
]);
check(
    'a healthy, unreferenced gallery image reports is_protected=false and file_missing=false',
    ($images2[0]['is_protected'] ?? true) === false && ($images2[0]['file_missing'] ?? true) === false,
    $failures, $passed
);
unlink($realFile);

echo "\n" . ($failures === [] ? "All {$passed} checks passed.\n" : count($failures) . " check(s) FAILED:\n- " . implode("\n- ", $failures) . "\n");
exit($failures === [] ? 0 : 1);
