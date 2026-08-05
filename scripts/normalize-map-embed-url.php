<?php
declare(strict_types=1);

/**
 * P1-4 one-time safe normalization for ak_site_settings.map_embed_url.
 *
 * A pasted <iframe> snippet (or a bare URL with the iframe's other attributes
 * glued on after it) may have been stored verbatim instead of just the src
 * URL. This script extracts the same way the fixed admin Settings UI now
 * does (see extractMapEmbedSrc() in src/pages/admin/AdminSettings.tsx),
 * shows the exact before/after diff, and only writes when --apply is passed
 * AND the normalized value is a valid https://www.google.com (or
 * maps.google.com) embed URL. No other column is touched.
 *
 * Usage:
 *   php scripts/normalize-map-embed-url.php            (dry run — no writes)
 *   php scripts/normalize-map-embed-url.php --apply     (writes only if safe)
 */

$root = dirname(__DIR__);
require_once $root . '/public_html/api/db.php';

function extract_map_embed_src(string $raw): string
{
    $value = trim($raw);
    if ($value === '') return '';
    if (preg_match('/src\s*=\s*"([^"]+)"/i', $value, $m) || preg_match("/src\\s*=\\s*'([^']+)'/i", $value, $m)) {
        return trim($m[1]);
    }
    if (preg_match('/^https?:\/\/\S+/i', $value, $m)) {
        return preg_split('/["\'\s]/', $m[0])[0];
    }
    return $value;
}

function is_valid_google_maps_embed_url(string $value): bool
{
    if ($value === '') return true;
    if (preg_match('/<script|javascript:|on\w+\s*=/i', $value)) return false;
    $parts = parse_url($value);
    if (!$parts || ($parts['scheme'] ?? '') !== 'https') return false;
    $host = $parts['host'] ?? '';
    return $host === 'www.google.com' || $host === 'maps.google.com';
}

$apply = in_array('--apply', $argv, true);
$pdo = db();

$row = $pdo->query('SELECT id, map_embed_url FROM ak_site_settings LIMIT 1')->fetch();
if (!$row) {
    echo "No ak_site_settings row found. Nothing to do.\n";
    exit(0);
}

$current = (string) ($row['map_embed_url'] ?? '');
$normalized = extract_map_embed_src($current);

echo "Current value:\n  " . ($current === '' ? '(empty)' : $current) . "\n\n";
echo "Normalized value:\n  " . ($normalized === '' ? '(empty)' : $normalized) . "\n\n";

if ($current === $normalized) {
    echo "Already normalized. No change needed.\n";
    exit(0);
}

if (!is_valid_google_maps_embed_url($normalized)) {
    echo "Normalized value does not pass validation (not a clean https://www.google.com or maps.google.com embed URL).\n";
    echo "Refusing to write automatically — please review and correct the value manually via the admin Settings page.\n";
    exit(1);
}

if (!$apply) {
    echo "Dry run only — no changes written. Re-run with --apply to write this exact normalized value.\n";
    exit(0);
}

$stmt = $pdo->prepare('UPDATE ak_site_settings SET map_embed_url = :v WHERE id = :id');
$stmt->execute(['v' => $normalized, 'id' => $row['id']]);
echo "Updated ak_site_settings.map_embed_url for row id={$row['id']}.\n";
echo "Only this single column on this single row was written; no other setting was touched.\n";
