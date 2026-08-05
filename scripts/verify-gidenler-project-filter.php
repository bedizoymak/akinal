<?php
declare(strict_types=1);

/**
 * QA-B BUG-05 regression check: filtering Gidenler by project_id (or any other
 * shared filter — currency/account_type/status/date range) must not throw.
 *
 * Root cause: gidenler.php's fetch_gidenler_rows() built ONE shared WHERE clause
 * with named placeholders (:project_id, :currency, ...) and reused the same SQL
 * text across all three UNION ALL branches (employee/supplier/expense_card),
 * binding each placeholder only once. db() connects with
 * PDO::ATTR_EMULATE_PREPARES = false (see public_html/api/db.php), so MySQL's
 * native prepared-statement protocol is used — it does not support the same
 * named placeholder appearing more than once, and throws
 * "SQLSTATE[HY093]: Invalid parameter number" as soon as any shared filter is
 * combined with more than one included source table. The exception was caught
 * by the endpoint's generic handler and surfaced to the admin as an empty
 * "Kayıt bulunamadı" result with no visible error.
 *
 * Fix: each UNION branch now gets its own uniquely-suffixed placeholders
 * (:project_id_emp, :project_id_sup, :project_id_exp, ...), and only the
 * placeholders for branches actually included by source_type are bound.
 *
 * Runs the real gidenler.php against the live database when reachable from
 * this environment; skips gracefully otherwise. Read-only — gidenler.php has
 * no POST/PATCH/DELETE.
 *
 * Run with: php scripts/verify-gidenler-project-filter.php
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

function fetch_gidenler2(string $root, array $get): array
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
include $root . '/public_html/api/admin/gidenler.php';
PHP;
    $tmpFile = tempnam(sys_get_temp_dir(), 'gidenler_probe_') . '.php';
    file_put_contents($tmpFile, sprintf($subprocessScript, var_export($root, true), var_export($get, true)));
    $output = shell_exec('php ' . escapeshellarg($tmpFile) . ' 2>&1');
    unlink($tmpFile);
    $decoded = json_decode(trim((string) $output), true);
    return is_array($decoded) ? $decoded : ['success' => false, 'raw' => $output];
}

// Pick any real project to filter by, so the query actually has a value to bind.
$anyProject = fetch_gidenler2($root, []);
if (isset($anyProject['skip'])) {
    echo "[SKIP] {$anyProject['skip']}\n";
    exit(0);
}
$projects = $anyProject['data']['projects'] ?? [];
if ($projects === []) {
    echo "[SKIP] no projects in database to filter by\n";
    exit(0);
}
$projectId = $projects[0]['id'];

// 1. project_id alone (all 3 source types unioned) — the exact QA-B repro.
$r1 = fetch_gidenler2($root, ['project_id' => $projectId]);
check('project_id filter alone succeeds (no Invalid parameter number)', ($r1['success'] ?? false) === true, $failures, $passed);
$rows1 = $r1['data']['entries'] ?? [];
$allMatchProject = array_reduce($rows1, fn($c, $e) => $c && ($e['project_id'] ?? null) === $projectId, true);
check('every returned row belongs to the filtered project', $allMatchProject, $failures, $passed);

// 2. project_id + currency + account_type + date range together (max param-reuse stress).
$today = date('Y-m-d');
$r2 = fetch_gidenler2($root, ['project_id' => $projectId, 'currency' => 'TRY', 'account_type' => 'resmi', 'date_from' => '2020-01-01', 'date_to' => $today]);
check('project_id + currency + account_type + date range together succeeds', ($r2['success'] ?? false) === true, $failures, $passed);

// 3. project_id + a single source_type (previously worked; must keep working).
$r3 = fetch_gidenler2($root, ['project_id' => $projectId, 'source_type' => 'supplier']);
check('project_id + source_type=supplier succeeds', ($r3['success'] ?? false) === true, $failures, $passed);

echo "\n" . ($failures === [] ? "All {$passed} checks passed.\n" : count($failures) . " check(s) FAILED:\n- " . implode("\n- ", $failures) . "\n");
exit($failures === [] ? 0 : 1);
