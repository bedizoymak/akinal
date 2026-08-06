<?php
declare(strict_types=1);

// Regression coverage for QA-B/C BUG-01's error-contract fix: roles.php, employee-roles.php,
// employee-cost-periods.php, employee-project-assignments.php, employee-project-allocations.php
// previously returned HTTP 200 + success:true + table_missing:true for GET when their backing
// table doesn't exist (a silent-success shape indistinguishable from a legitimately empty list),
// while POST/PATCH/DELETE fell through to a generic 500. Both now go through the shared
// require_admin_tables() helper (helpers.php), which fails every method with a consistent
// 503 + success:false + details.code=TABLE_MISSING contract.
//
// This test does NOT run the employee-personnel-tables-apply.php migration — per the explicit
// constraint against executing any production migration, it only verifies the CURRENT error
// contract of these endpoints (whatever their current schema state happens to be) is
// internally consistent and machine-readable, never a bare HTTP 500 or a silently-empty 200.

$root = dirname(__DIR__);

$configPath = $root . '/public_html/api/config.local.php';
if (!is_file($configPath)) {
    $configPath = $root . '/public_html/api/config.php';
}
if (!is_file($configPath)) {
    echo "  [SKIP] no local config.php — cannot reach a database from this environment\n";
    exit(0);
}

function probe(string $root, string $endpoint, string $method, array $get = []): array
{
    $subprocessScript = <<<'PHP'
<?php
declare(strict_types=1);
$root = __ROOT_PLACEHOLDER__;
require_once $root . '/public_html/api/admin/helpers.php';
$pdo = db();
ob_start();
chdir($root . '/public_html/api/admin');
session_start();
$admin = $pdo->query("SELECT id FROM ak_admin_users WHERE role='admin' AND is_active=1 LIMIT 1")->fetch();
if (!$admin) { ob_end_clean(); echo json_encode(['skip' => 'no admin']); exit(0); }
$_SESSION['admin'] = ['id' => $admin['id'], 'email' => 'diagnostic@local', 'role' => 'admin'];
$_SERVER['REQUEST_METHOD'] = __METHOD_PLACEHOLDER__;
$_GET = __GET_PLACEHOLDER__;
register_shutdown_function(function () {
    fwrite(STDOUT, json_encode(['http_status' => http_response_code(), 'body' => ob_get_clean()]));
});
include $root . '/public_html/api/admin/' . __ENDPOINT_PLACEHOLDER__;
PHP;
    $script = str_replace(
        ['__ROOT_PLACEHOLDER__', '__METHOD_PLACEHOLDER__', '__GET_PLACEHOLDER__', '__ENDPOINT_PLACEHOLDER__'],
        [var_export($root, true), var_export($method, true), var_export($get, true), var_export($endpoint, true)],
        $subprocessScript
    );
    $tmpFile = tempnam(sys_get_temp_dir(), 'bug01_probe_') . '.php';
    file_put_contents($tmpFile, $script);
    $output = shell_exec('php ' . escapeshellarg($tmpFile) . ' 2>&1');
    unlink($tmpFile);
    $lines = explode("\n", trim((string) $output));
    $result = json_decode(end($lines), true);
    return is_array($result) ? $result : ['parse_error' => $output];
}

$endpoints = [
    'roles.php' => ['employee_id' => null],
    'employee-roles.php' => ['employee_id' => 'nonexistent'],
    'employee-cost-periods.php' => ['employee_id' => 'nonexistent'],
    'employee-project-assignments.php' => ['employee_id' => 'nonexistent'],
    'employee-project-allocations.php' => ['employee_id' => 'nonexistent'],
];

$failures = [];
$passed = 0;
function check(string $label, bool $ok, array &$failures, int &$passed): void
{
    if ($ok) { $passed++; return; }
    $failures[] = $label;
}

$anySkip = false;
foreach ($endpoints as $endpoint => $get) {
    $get = array_filter($get, fn($v) => $v !== null);
    $result = probe($root, $endpoint, 'GET', $get);
    if (isset($result['skip'])) { $anySkip = true; continue; }
    if (isset($result['parse_error'])) {
        check("{$endpoint}: subprocess produced parseable output", false, $failures, $passed);
        continue;
    }
    $body = json_decode($result['body'] ?? '', true);
    $status = (int) ($result['http_status'] ?? 0);

    if (is_array($body) && ($body['success'] ?? null) === true && !array_key_exists('table_missing', $body['data'] ?? [])) {
        // Table exists on this environment (migration already applied) — endpoint returned real
        // data normally. Nothing to assert about the missing-table contract here.
        check("{$endpoint}: table exists, GET succeeds normally (no assertion needed)", true, $failures, $passed);
        continue;
    }

    check(
        "{$endpoint}: never returns the old silent-success shape (200 + success:true + table_missing:true)",
        !(is_array($body) && ($body['success'] ?? null) === true && ($body['data']['table_missing'] ?? false) === true),
        $failures, $passed
    );
    check("{$endpoint}: missing-schema response uses HTTP 503, not a bare 500", $status === 503, $failures, $passed);
    check("{$endpoint}: missing-schema response has success:false", is_array($body) && ($body['success'] ?? null) === false, $failures, $passed);
    check(
        "{$endpoint}: missing-schema response has a machine-readable details.code=TABLE_MISSING",
        is_array($body) && (($body['details']['code'] ?? null) === 'TABLE_MISSING'),
        $failures, $passed
    );
    check(
        "{$endpoint}: error message contains no raw SQL/file-path/credential leakage",
        is_array($body) && !preg_match('/SELECT |INSERT |password|config\.php/i', (string) ($body['message'] ?? '')),
        $failures, $passed
    );
}

if ($passed === 0 && $failures === [] && $anySkip) {
    echo "  [SKIP] no active admin user reachable\n";
    exit(0);
}

echo "\n" . ($failures === [] ? "All {$passed} checks passed.\n" : count($failures) . " check(s) FAILED:\n- " . implode("\n- ", $failures) . "\n");
exit($failures === [] ? 0 : 1);
