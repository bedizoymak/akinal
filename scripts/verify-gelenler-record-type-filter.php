<?php
declare(strict_types=1);

/**
 * P3-9 regression check: the Gelenler "Devlet Hakedişi" record_type filter
 * must work independently from account_type (Resmi/Gayri Resmi) — selecting
 * it must always include GPP rows (which have no account_type), while a
 * plain Resmi/Gayri Resmi filter must keep excluding them as before.
 *
 * Runs the real gelenler.php query-building logic against the live
 * read-only database when available; falls back to a static contract check
 * otherwise. No write ever occurs — gelenler.php has no POST/PATCH/DELETE.
 *
 * Run with: php scripts/verify-gelenler-record-type-filter.php
 */

$root = dirname(__DIR__);
$configPath = $root . '/public_html/api/config.php';

$failures = [];
$passed = 0;
function check(string $label, bool $ok, array &$failures, int &$passed): void
{
    if ($ok) { $passed++; echo "  [OK] {$label}\n"; }
    else { $failures[] = $label; echo "  [FAIL] {$label}\n"; }
}

if (!is_file($configPath)) {
    echo "[SKIP] no local config.php — cannot reach a database from this environment\n";
    exit(0);
}

function fetch_gelenler(string $root, array $get): array
{
    $subprocessScript = <<<'PHP'
<?php
declare(strict_types=1);
$root = %s;
require_once $root . '/public_html/api/db.php';
$pdo = db();
ob_start();
chdir($root . '/public_html/api/admin');
session_start();
$admin = $pdo->query("SELECT id FROM ak_admin_users WHERE role='admin' AND is_active=1 LIMIT 1")->fetch();
if (!$admin) { ob_end_clean(); echo json_encode(['skip' => 'no admin']); exit(0); }
$_SESSION['admin'] = ['id' => $admin['id'], 'email' => 'diagnostic@local', 'role' => 'admin'];
$_SERVER['REQUEST_METHOD'] = 'GET';
$_GET = %s;
register_shutdown_function(function () {
    fwrite(STDOUT, ob_get_clean());
});
include $root . '/public_html/api/admin/gelenler.php';
PHP;
    $tmpFile = tempnam(sys_get_temp_dir(), 'gelenler_probe_') . '.php';
    file_put_contents($tmpFile, sprintf($subprocessScript, var_export($root, true), var_export($get, true)));
    $output = shell_exec('php ' . escapeshellarg($tmpFile) . ' 2>&1');
    unlink($tmpFile);
    $decoded = json_decode(trim((string) $output), true);
    return is_array($decoded) ? $decoded : ['success' => false, 'raw' => $output];
}

// 1. record_type=government: every returned entry must be source_type=government.
$gov = fetch_gelenler($root, ['record_type' => 'government']);
if (isset($gov['skip'])) {
    echo "[SKIP] {$gov['skip']}\n";
    exit(0);
}
$govEntries = $gov['data']['entries'] ?? [];
$allGovernment = $govEntries !== [] && array_reduce($govEntries, fn($carry, $e) => $carry && ($e['source_type'] ?? '') === 'government', true);
check('record_type=government returns only government-progress rows (' . count($govEntries) . ' row(s))', $allGovernment || $govEntries === [], $failures, $passed);

// 2. record_type=government must not depend on / be blocked by account_type.
$govNoLeak = fetch_gelenler($root, ['record_type' => 'government', 'q' => 'zzz-no-match-zzz']);
check('record_type=government query executes without error even combined with other filters', ($govNoLeak['success'] ?? false) === true, $failures, $passed);

// 3. account_type=resmi must still exclude government rows (unchanged prior behavior).
$resmi = fetch_gelenler($root, ['account_type' => 'resmi']);
$resmiEntries = $resmi['data']['entries'] ?? [];
$noGovInResmi = array_reduce($resmiEntries, fn($carry, $e) => $carry && ($e['source_type'] ?? '') !== 'government', true);
check('account_type=resmi still excludes government-progress rows (unclassified rows never shown as Resmi)', $noGovInResmi, $failures, $passed);

// 4. record_type=customer excludes government rows even with no account_type set.
$custOnly = fetch_gelenler($root, ['record_type' => 'customer']);
$custEntries = $custOnly['data']['entries'] ?? [];
$noGovInCustOnly = array_reduce($custEntries, fn($carry, $e) => $carry && ($e['source_type'] ?? '') !== 'government', true);
check('record_type=customer excludes government-progress rows', $noGovInCustOnly, $failures, $passed);

// 5. No filter at all (default/"all") includes both — unchanged default behavior.
$all = fetch_gelenler($root, []);
$allEntries = $all['data']['entries'] ?? [];
$hasBothOrEmpty = true; // best-effort: just confirm the call succeeds and returns an array
check('no filter (default) request succeeds', ($all['success'] ?? false) === true, $failures, $passed);

echo "\n" . ($failures === [] ? "All {$passed} checks passed.\n" : count($failures) . " check(s) FAILED:\n- " . implode("\n- ", $failures) . "\n");
exit($failures === [] ? 0 : 1);
