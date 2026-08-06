<?php
declare(strict_types=1);

// Regression coverage for the "Vadesi Geçen Alacak" dashboard card fix:
// dashboard.php's compute_finance_summary() (overdue_remaining/overdue_count)
// must recompute overdue status live from entry_date/amount_try/paid_amount_try
// instead of trusting the stored is_overdue column, which goes stale as soon as
// "today" advances past a row's entry_date without that row being re-saved
// (see finance-entry-helpers.php fe_is_overdue(), written only at create/update
// time).
//
// dashboard.php is a live endpoint file with top-level side effects
// (require_admin(), json_success()/exit()) — it can't be require_once'd as a
// plain function library. This spawns a real subprocess that fakes an admin
// session and includes the actual, unmodified dashboard.php, exactly like
// scripts/verify-notifications-derivation.php does for notifications.php. All
// inserted rows live inside one uncommitted transaction that a shutdown
// function always rolls back — zero permanent footprint regardless of outcome.

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

$customer = $pdo->query('SELECT id FROM ak_customers LIMIT 1')->fetch();
$project  = $pdo->query('SELECT id FROM ak_projects LIMIT 1')->fetch();
if (!$customer || !$project) {
    echo json_encode(['skip' => 'no customer/project row to anchor disposable test entries']);
    exit(0);
}

// Baseline BEFORE any test rows exist, using the identical live date/balance rule
// dashboard.php now applies (see compute_finance_summary()).
$today = date('Y-m-d');
$baseStmt = $pdo->prepare("
    SELECT
      COALESCE(SUM(CASE WHEN entry_date < :t1 AND amount_try > paid_amount_try THEN GREATEST(amount_try - paid_amount_try, 0) ELSE 0 END), 0) AS r,
      SUM(CASE WHEN entry_date < :t2 AND amount_try > paid_amount_try THEN 1 ELSE 0 END) AS c
    FROM ak_customer_financial_entries WHERE title NOT LIKE '%Hakediş%'
");
$baseStmt->execute(['t1' => $today, 't2' => $today]);
$baseline = $baseStmt->fetch();

$yesterday = date('Y-m-d', strtotime('-1 day'));
$tomorrow  = date('Y-m-d', strtotime('+1 day'));

function insertEntry(PDO $pdo, string $customerId, string $projectId, string $entryDate, float $amount, float $paid): void
{
    $id = bin2hex(random_bytes(16));
    // Deliberately write STALE classification (opposite of what's actually true) to prove
    // the dashboard recomputes live rather than trusting these columns.
    $pdo->prepare('
        INSERT INTO ak_customer_financial_entries
          (id, customer_id, project_id, title, entry_date, amount, paid_amount, currency,
           exchange_rate_to_try, amount_try, paid_amount_try, account_type, payment_method,
           status, is_overdue)
        VALUES
          (:id, :customer_id, :project_id, :title, :entry_date, :amount1, :paid1, \'TRY\',
           1, :amount2, :paid2, \'resmi\', \'Nakit\', \'Planlanan\', 0)
    ')->execute([
        'id' => $id, 'customer_id' => $customerId, 'project_id' => $projectId,
        'title' => 'TOOLS-TEST vadesi-gecen-alacak ' . $id, 'entry_date' => $entryDate,
        'amount1' => $amount, 'paid1' => $paid, 'amount2' => $amount, 'paid2' => $paid,
    ]);
}

$pdo->beginTransaction();
insertEntry($pdo, $customer['id'], $project['id'], $yesterday, 10000.0, 0.0);      // unpaid overdue: 10000
insertEntry($pdo, $customer['id'], $project['id'], $yesterday, 10000.0, 4000.0);   // partial overdue: 6000
insertEntry($pdo, $customer['id'], $project['id'], $yesterday, 10000.0, 10000.0);  // fully paid overdue: excluded
insertEntry($pdo, $customer['id'], $project['id'], $today, 5000.0, 0.0);           // due today: excluded
insertEntry($pdo, $customer['id'], $project['id'], $tomorrow, 5000.0, 0.0);        // future: excluded

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
$_SERVER['REQUEST_METHOD'] = 'GET';
register_shutdown_function(function () use ($pdo, $baseline) {
    $out = ob_get_clean();
    $decoded = json_decode($out, true);
    $summary = $decoded['data']['summary'] ?? [];
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    fwrite(STDOUT, json_encode([
        'success' => is_array($decoded) && ($decoded['success'] ?? false) === true,
        'baseline_remaining' => (float) ($baseline['r'] ?? 0),
        'baseline_count' => (int) ($baseline['c'] ?? 0),
        'after_remaining' => (float) ($summary['overdue_collections'] ?? -1),
        'after_count' => (int) ($summary['overdue_plan_count'] ?? -1),
    ]));
});
include $root . '/public_html/api/admin/dashboard.php';
PHP;

$tmpFile = tempnam(sys_get_temp_dir(), 'vadesi_gecen_probe_') . '.php';
file_put_contents($tmpFile, str_replace('__ROOT_PLACEHOLDER__', var_export($root, true), $subprocessScript));
$output = shell_exec('php ' . escapeshellarg($tmpFile) . ' 2>&1');
unlink($tmpFile);

$lines = explode("\n", trim((string) $output));
$jsonLine = end($lines);
$result = json_decode($jsonLine, true);

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
    check('dashboard.php GET returned a successful envelope', $result['success'] === true, $failures, $passed);

    $deltaRemaining = round($result['after_remaining'] - $result['baseline_remaining'], 2);
    $deltaCount     = $result['after_count'] - $result['baseline_count'];

    check(
        'overdue_collections delta is exactly 16000 (10000 unpaid + 6000 remaining of the partial) despite both rows being stale-flagged is_overdue=0/status=Planlanan',
        abs($deltaRemaining - 16000.0) < 0.005,
        $failures, $passed
    );
    check(
        'overdue_plan_count delta is exactly 2 (fully-paid/today/future rows correctly excluded)',
        $deltaCount === 2,
        $failures, $passed
    );
}

// ── Destination-page consistency (AKINAL card task #7): the dashboard card
// links to /admin/gelenler?status=Gecikmiş. gelenler.php must return the same
// two rows (unpaid + partial) via that exact filter — including the partial
// row, which fe_auto_status() always stores as 'Kısmi Ödendi', never
// 'Gecikmiş', so a naive status-string match would silently exclude it even
// after the dashboard card itself is fixed. ──────────────────────────────────

$gelenlerSubprocess = <<<'PHP'
<?php
declare(strict_types=1);
$root = __ROOT_PLACEHOLDER__;
require_once $root . '/public_html/api/admin/helpers.php';
require_once $root . '/public_html/api/admin/finance-entry-helpers.php';
$pdo = db();

$customer = $pdo->query('SELECT id FROM ak_customers LIMIT 1')->fetch();
$project  = $pdo->query('SELECT id FROM ak_projects LIMIT 1')->fetch();
if (!$customer || !$project) {
    echo json_encode(['skip' => 'no customer/project row to anchor disposable test entries']);
    exit(0);
}

$yesterday = date('Y-m-d', strtotime('-1 day'));

function insertEntry(PDO $pdo, string $customerId, string $projectId, string $entryDate, float $amount, float $paid, string $marker): string
{
    $id = bin2hex(random_bytes(16));
    $title = 'TOOLS-TEST gelenler-gecikmis ' . $marker . ' ' . $id;
    $pdo->prepare('
        INSERT INTO ak_customer_financial_entries
          (id, customer_id, project_id, title, entry_date, amount, paid_amount, currency,
           exchange_rate_to_try, amount_try, paid_amount_try, account_type, payment_method,
           status, is_overdue)
        VALUES
          (:id, :customer_id, :project_id, :title, :entry_date, :amount1, :paid1, \'TRY\',
           1, :amount2, :paid2, \'resmi\', \'Nakit\', \'Planlanan\', 0)
    ')->execute([
        'id' => $id, 'customer_id' => $customerId, 'project_id' => $projectId,
        'title' => $title, 'entry_date' => $entryDate,
        'amount1' => $amount, 'paid1' => $paid, 'amount2' => $amount, 'paid2' => $paid,
    ]);
    return $title;
}

$pdo->beginTransaction();
$unpaidTitle  = insertEntry($pdo, $customer['id'], $project['id'], $yesterday, 10000.0, 0.0, 'unpaid');
$partialTitle = insertEntry($pdo, $customer['id'], $project['id'], $yesterday, 10000.0, 4000.0, 'partial');

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
$_SERVER['REQUEST_METHOD'] = 'GET';
$_GET['status'] = 'Gecikmiş';
$_GET['q'] = 'TOOLS-TEST gelenler-gecikmis';
register_shutdown_function(function () use ($pdo, $unpaidTitle, $partialTitle) {
    $out = ob_get_clean();
    $decoded = json_decode($out, true);
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    $titles = array_column($decoded['data']['entries'] ?? [], 'title');
    fwrite(STDOUT, json_encode([
        'success' => is_array($decoded) && ($decoded['success'] ?? false) === true,
        'has_unpaid' => in_array($unpaidTitle, $titles, true),
        'has_partial' => in_array($partialTitle, $titles, true),
        'count' => count($titles),
    ]));
});
include $root . '/public_html/api/admin/gelenler.php';
PHP;

$tmpFile2 = tempnam(sys_get_temp_dir(), 'gelenler_gecikmis_probe_') . '.php';
file_put_contents($tmpFile2, str_replace('__ROOT_PLACEHOLDER__', var_export($root, true), $gelenlerSubprocess));
$output2 = shell_exec('php ' . escapeshellarg($tmpFile2) . ' 2>&1');
unlink($tmpFile2);

$lines2 = explode("\n", trim((string) $output2));
$result2 = json_decode(end($lines2), true);

if (!is_array($result2)) {
    check('gelenler.php subprocess produced parseable output (' . substr((string) $output2, 0, 400) . ')', false, $failures, $passed);
} elseif (isset($result2['skip'])) {
    echo "  [SKIP] {$result2['skip']}\n";
} else {
    check('gelenler.php?status=Gecikmiş returned a successful envelope', $result2['success'] === true, $failures, $passed);
    check('gelenler.php?status=Gecikmiş includes the unpaid overdue row', $result2['has_unpaid'] === true, $failures, $passed);
    check(
        'gelenler.php?status=Gecikmiş includes the PARTIALLY PAID overdue row (stored status is Kısmi Ödendi, never literally Gecikmiş)',
        $result2['has_partial'] === true,
        $failures, $passed
    );
    check('gelenler.php?status=Gecikmiş returns exactly the 2 disposable test rows for this scoped query, matching the dashboard card delta', $result2['count'] === 2, $failures, $passed);
}

echo "\n" . ($failures === [] ? "All {$passed} checks passed (transactions rolled back, zero footprint).\n" : count($failures) . " check(s) FAILED:\n- " . implode("\n- ", $failures) . "\n");
exit($failures === [] ? 0 : 1);
