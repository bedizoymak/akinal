<?php
declare(strict_types=1);

// Regression coverage for BUG-01 (AKINAL_ADMIN_FULL_E2E_QA_REPORT_2026-08-06_C.md):
// roles.php, employee-roles.php, employee-cost-periods.php,
// employee-project-assignments.php and employee-project-allocations.php must:
//   (a) return a real, machine-readable error (success:false, HTTP 503,
//       details.code === 'TABLE_MISSING') from every method — not the previous
//       success:true + table_missing:true shape — when the personnel-tables
//       migration (employee-personnel-tables-apply.php) hasn't been applied yet;
//   (b) support a full CRUD round trip once the schema exists, including the
//       cross-record business rules (auto-close prior open cost period, days-
//       worked ceiling, snapshot-based calculated_cost recompute on PATCH,
//       bidirectional employee<->project assignment visibility).
//
// Part (a) is verified directly against helpers.php's admin_table_exists() /
// require_admin_tables() — the single shared guard now used by all five
// endpoints — using a table name that provably does not exist, without
// touching the real schema (renaming/dropping a live table was intentionally
// avoided; this DB is local-only but the guard logic itself doesn't care which
// table name it's checking).
//
// Part (b) drives the real endpoints over genuine HTTP against a throwaway
// `php -S` server bound to config.local.php (see db.php — never production).
// PHP CLI's php://input does not reliably receive piped stdin in this
// environment, which rules out the subprocess-include-with-stdin pattern used
// elsewhere in tools/ for endpoints that need a JSON body, hence the real
// HTTP server instead.
//
// All rows created here are deleted again at the end via the same DELETE
// endpoints already under test. The one intentional exception is the test
// role, which the API only supports soft-deleting (is_active=0) by design —
// left behind deactivated, exactly like any other role a real admin retires.

$root = dirname(__DIR__);

$configPath = $root . '/public_html/api/config.local.php';
if (!is_file($configPath)) {
    echo "  [SKIP] no config.local.php — cannot reach a local database from this environment\n";
    exit(0);
}

$failures = [];
$passed = 0;
function check(string $label, bool $ok, array &$failures, int &$passed): void
{
    if ($ok) { $passed++; return; }
    $failures[] = $label;
}

// ── Part (a): shared guard, in-process, no schema mutation ─────────────────
define('AK_API_INTERNAL', true);
require_once $root . '/public_html/api/response.php';
require_once $root . '/public_html/api/db.php';
require_once $root . '/public_html/api/admin/helpers.php';

check('admin_table_exists() is true for a table that really exists (ak_employees)', admin_table_exists('ak_employees') === true, $failures, $passed);
check('admin_table_exists() is false for a table that does not exist', admin_table_exists('ak_table_definitely_missing_' . bin2hex(random_bytes(4))) === false, $failures, $passed);

// ── Part (b): full HTTP round trip against a throwaway local server ────────
$pdo = db();
$employee = $pdo->query('SELECT id FROM ak_employees LIMIT 1')->fetch();
$project  = $pdo->query('SELECT id FROM ak_projects LIMIT 1')->fetch();
$admin    = $pdo->query("SELECT id, email, role FROM ak_admin_users WHERE role = 'admin' AND is_active = 1 LIMIT 1")->fetch();

if (!$employee || !$project || !$admin) {
    echo "  [SKIP] no employee/project/active admin row to anchor disposable test data\n";
    exit(0);
}

$port = 8000 + random_int(100, 999);
$sessionDir = sys_get_temp_dir() . '/bug01_sess_' . bin2hex(random_bytes(4));
mkdir($sessionDir);
$sessionId = bin2hex(random_bytes(16));

// Pre-seed a real admin session file so the test can authenticate without a password.
session_save_path($sessionDir);
session_id($sessionId);
session_start();
$_SESSION['admin'] = ['id' => (string) $admin['id'], 'email' => (string) $admin['email'], 'full_name' => null, 'role' => (string) $admin['role']];
session_write_close();

// php -S logs one access line per request to stdout/stderr. A 'pipe' descriptor here would
// block the server once the OS pipe buffer fills (observed after ~20 requests on Windows),
// silently hanging every subsequent request — route to log files instead, which never block.
$accessLog = sys_get_temp_dir() . '/bug01_access_' . bin2hex(random_bytes(4)) . '.log';
$descriptors = [1 => ['file', $accessLog, 'a'], 2 => ['file', $accessLog, 'a']];
$server = proc_open(
    ['php', '-d', 'session.save_path=' . $sessionDir, '-S', '127.0.0.1:' . $port, '-t', $root . '/public_html'],
    $descriptors,
    $pipes
);
if (!is_resource($server)) {
    echo "  [SKIP] could not start local php -S test server\n";
    exit(0);
}

function httpJson(int $port, string $sessionId, string $method, string $path, ?array $body = null): array
{
    $ctx = stream_context_create([
        'http' => [
            'method'  => $method,
            'header'  => "Cookie: PHPSESSID={$sessionId}\r\nContent-Type: application/json\r\nAccept: application/json\r\n",
            'content' => $body !== null ? json_encode($body) : '',
            'ignore_errors' => true,
        ],
    ]);
    $raw = file_get_contents("http://127.0.0.1:{$port}{$path}", false, $ctx);
    $decoded = json_decode((string) $raw, true);
    return is_array($decoded) ? $decoded : ['success' => false, 'message' => 'invalid JSON: ' . substr((string) $raw, 0, 200)];
}

// Wait for the server to accept connections (up to ~3s).
$ready = false;
for ($i = 0; $i < 30; $i++) {
    $conn = @fsockopen('127.0.0.1', $port, $errno, $errstr, 0.2);
    if ($conn) { fclose($conn); $ready = true; break; }
    usleep(100000);
}

try {
    if (!$ready) {
        check('local php -S test server became reachable', false, $failures, $passed);
    } else {
        $empId  = (string) $employee['id'];
        $projId = (string) $project['id'];
        $marker = 'TOOLS-TEST bug01 ' . bin2hex(random_bytes(4));

        // Role create + list
        $r = httpJson($port, $sessionId, 'POST', '/api/admin/roles.php', ['name' => $marker]);
        check('POST roles.php creates a role', ($r['success'] ?? false) === true, $failures, $passed);
        $roleId = $r['data']['role']['id'] ?? null;

        $r = httpJson($port, $sessionId, 'GET', '/api/admin/roles.php');
        $roleNames = array_column($r['data']['roles'] ?? [], 'name');
        check('GET roles.php lists the created role (not masked as empty)', in_array($marker, $roleNames, true), $failures, $passed);

        if ($roleId) {
            // Employee role assign / list / end / delete
            $r = httpJson($port, $sessionId, 'POST', '/api/admin/employee-roles.php', ['employee_id' => $empId, 'role_id' => $roleId, 'assigned_at' => '2026-01-01']);
            check('POST employee-roles.php assigns the role to the employee', ($r['success'] ?? false) === true, $failures, $passed);

            $r = httpJson($port, $sessionId, 'GET', '/api/admin/employee-roles.php?employee_id=' . urlencode($empId));
            $assignedRoleIds = array_column($r['data']['employee_roles'] ?? [], 'role_id');
            check('GET employee-roles.php shows the new assignment', in_array($roleId, $assignedRoleIds, true), $failures, $passed);

            $r = httpJson($port, $sessionId, 'DELETE', '/api/admin/employee-roles.php', ['employee_id' => $empId, 'role_id' => $roleId, 'assigned_at' => '2026-01-01']);
            check('DELETE employee-roles.php removes the assignment', ($r['success'] ?? false) === true, $failures, $passed);

            // Soft-delete the test role (API has no hard-delete by design)
            httpJson($port, $sessionId, 'DELETE', '/api/admin/roles.php?id=' . urlencode($roleId));
        }

        // Cost periods: create two, confirm the first auto-closes
        $r1 = httpJson($port, $sessionId, 'POST', '/api/admin/employee-cost-periods.php', [
            'employee_id' => $empId, 'effective_from' => '2031-01-01', 'salary' => 40000, 'sgk' => 8000, 'meal' => 3000, 'transportation' => 2000,
        ]);
        check('POST employee-cost-periods.php creates the first period', ($r1['success'] ?? false) === true, $failures, $passed);
        $period1Id = $r1['data']['cost_period']['id'] ?? null;

        $r2 = httpJson($port, $sessionId, 'POST', '/api/admin/employee-cost-periods.php', [
            'employee_id' => $empId, 'effective_from' => '2031-02-01', 'salary' => 45000, 'sgk' => 9000, 'meal' => 3000, 'transportation' => 2000,
        ]);
        check('POST employee-cost-periods.php creates the second period', ($r2['success'] ?? false) === true, $failures, $passed);
        $period2Id = $r2['data']['cost_period']['id'] ?? null;

        $r = httpJson($port, $sessionId, 'GET', '/api/admin/employee-cost-periods.php?employee_id=' . urlencode($empId));
        $periods = $r['data']['cost_periods'] ?? [];
        $first = null;
        foreach ($periods as $p) { if (($p['id'] ?? null) === $period1Id) { $first = $p; } }
        check('creating the 2031-02-01 period auto-closes the 2031-01-01 period to 2031-01-31', ($first['effective_to'] ?? null) === '2031-01-31', $failures, $passed);

        // Project assignment, bidirectional visibility
        $r = httpJson($port, $sessionId, 'POST', '/api/admin/employee-project-assignments.php', ['employee_id' => $empId, 'project_id' => $projId, 'start_date' => '2031-02-01']);
        check('POST employee-project-assignments.php creates an assignment', ($r['success'] ?? false) === true, $failures, $passed);
        $assignmentId = $r['data']['assignment']['id'] ?? null;

        $r = httpJson($port, $sessionId, 'GET', '/api/admin/employee-project-assignments.php?project_id=' . urlencode($projId));
        $byProject = array_column($r['data']['assignments'] ?? [], 'id');
        check('GET employee-project-assignments.php?project_id shows the assignment (project -> employee direction)', in_array($assignmentId, $byProject, true), $failures, $passed);

        // Allocation: snapshot from the active (2031-02) cost period, ceiling check, PATCH recompute
        $r = httpJson($port, $sessionId, 'POST', '/api/admin/employee-project-allocations.php', [
            'employee_id' => $empId, 'project_id' => $projId, 'allocation_year' => 2031, 'allocation_month' => 2, 'days_worked' => 15, 'working_days_base' => 22,
        ]);
        check('POST employee-project-allocations.php creates an allocation', ($r['success'] ?? false) === true, $failures, $passed);
        $allocationId = $r['data']['allocation']['id'] ?? null;
        $monthlyCost = (float) ($r['data']['allocation']['monthly_cost_snapshot'] ?? 0);
        check('allocation snapshots the ACTIVE cost period (45000+9000+3000+2000=59000), not the closed one', abs($monthlyCost - 59000.0) < 0.005, $failures, $passed);
        $expectedCost = round((15 / 22) * 59000, 2);
        check('calculated_cost = (days_worked / working_days_base) * monthly_cost_snapshot', abs((float) ($r['data']['allocation']['calculated_cost'] ?? -1) - $expectedCost) < 0.005, $failures, $passed);

        $r = httpJson($port, $sessionId, 'POST', '/api/admin/employee-project-allocations.php', [
            'employee_id' => $empId, 'project_id' => $projId, 'allocation_year' => 2031, 'allocation_month' => 2, 'days_worked' => 10, 'working_days_base' => 22,
        ]);
        check('a second allocation exceeding the 22-day ceiling (15+10=25) is rejected', ($r['success'] ?? true) === false, $failures, $passed);

        if ($allocationId) {
            $r = httpJson($port, $sessionId, 'PATCH', '/api/admin/employee-project-allocations.php', ['id' => $allocationId, 'days_worked' => 20]);
            $recomputed = round((20 / 22) * 59000, 2);
            check('PATCH recomputes calculated_cost from the stored snapshot (never re-reads cost periods)', abs((float) ($r['data']['allocation']['calculated_cost'] ?? -1) - $recomputed) < 0.005, $failures, $passed);

            $r = httpJson($port, $sessionId, 'DELETE', '/api/admin/employee-project-allocations.php?id=' . urlencode($allocationId));
            check('DELETE employee-project-allocations.php removes the allocation', ($r['success'] ?? false) === true, $failures, $passed);
        }

        // Cleanup: assignment, both cost periods (allowed now that the allocation is gone)
        if ($assignmentId) {
            $r = httpJson($port, $sessionId, 'DELETE', '/api/admin/employee-project-assignments.php?id=' . urlencode($assignmentId));
            check('DELETE employee-project-assignments.php removes the assignment', ($r['success'] ?? false) === true, $failures, $passed);
        }
        if ($period2Id) {
            $r = httpJson($port, $sessionId, 'DELETE', '/api/admin/employee-cost-periods.php?id=' . urlencode($period2Id));
            check('DELETE employee-cost-periods.php removes the second (now-unreferenced) period', ($r['success'] ?? false) === true, $failures, $passed);
        }
        if ($period1Id) {
            $r = httpJson($port, $sessionId, 'DELETE', '/api/admin/employee-cost-periods.php?id=' . urlencode($period1Id));
            check('DELETE employee-cost-periods.php removes the first period', ($r['success'] ?? false) === true, $failures, $passed);
        }
    }
} finally {
    if (is_resource($server)) {
        proc_terminate($server);
        proc_close($server);
    }
    @unlink($sessionDir . '/sess_' . $sessionId);
    @rmdir($sessionDir);
    @unlink($accessLog);
}

echo "\n" . ($failures === [] ? "All {$passed} checks passed.\n" : count($failures) . " check(s) FAILED:\n- " . implode("\n- ", $failures) . "\n");
exit($failures === [] ? 0 : 1);
