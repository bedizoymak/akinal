<?php
declare(strict_types=1);

// Regression coverage for QA-B/C BUG-02: dashboard.php's compute_finance_summary()
// (total_income_paid / month_income_paid / realized_profit, which feed the Genel Bakış
// "Toplam Tahsilat" / "Bu Ay Tahsilat" / "Net Durum" cards) previously summed
// paid_amount_try with NO entry_date upper bound, unlike /admin/net-durum
// (AdminNetDurum.tsx: `m.entry_date <= today`). A future-dated-but-already-paid customer
// row inflated Genel Bakış's realized totals by its full paid amount while Net Durum
// correctly excluded it, producing a real cross-screen discrepancy for the exact same
// claimed metric ("gerçekleşen gelir eksi gider").
//
// dashboard.php is a live endpoint file with top-level side effects — this spawns a real
// subprocess that fakes an admin session and includes the actual, unmodified file, exactly
// like tools/vadesi-gecen-alacak-overdue-test.php does. All inserted rows live inside one
// uncommitted transaction that a shutdown function always rolls back — zero permanent
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

$customer = $pdo->query('SELECT id FROM ak_customers LIMIT 1')->fetch();
$project  = $pdo->query('SELECT id FROM ak_projects LIMIT 1')->fetch();
if (!$customer || !$project) {
    echo json_encode(['skip' => 'no customer/project row to anchor disposable test entries']);
    exit(0);
}

function insertEntry(PDO $pdo, string $customerId, string $projectId, string $entryDate, float $amount, float $paid, string $marker): void
{
    $id = bin2hex(random_bytes(16));
    $pdo->prepare('
        INSERT INTO ak_customer_financial_entries
          (id, customer_id, project_id, title, entry_date, amount, paid_amount, currency,
           exchange_rate_to_try, amount_try, paid_amount_try, account_type, payment_method,
           status, is_overdue)
        VALUES
          (:id, :customer_id, :project_id, :title, :entry_date, :amount1, :paid1, \'TRY\',
           1, :amount2, :paid2, \'resmi\', \'Nakit\', \'Fazla Ödendi\', 0)
    ')->execute([
        'id' => $id, 'customer_id' => $customerId, 'project_id' => $projectId,
        'title' => 'TOOLS-TEST dashboard-date-cutoff ' . $marker . ' ' . $id, 'entry_date' => $entryDate,
        'amount1' => $amount, 'paid1' => $paid, 'amount2' => $amount, 'paid2' => $paid,
    ]);
}

$today  = date('Y-m-d');
$future = date('Y-m-d', strtotime('+4 days'));
// Month/year boundary probe: the last day of the *previous* calendar month (which, when
// today is in January, is December 31 of the *previous year* — the exact date-string
// comparison dashboard.php uses doesn't special-case the year rollover, so this single
// pair of dates exercises both the month and the year boundary at once) versus the first
// day of the *current* calendar month.
$firstOfThisMonth = (new DateTimeImmutable('first day of this month'))->format('Y-m-d');
$lastOfPrevMonth  = (new DateTimeImmutable('last day of previous month'))->format('Y-m-d');

// Baseline via the SAME cutoff rule Net Durum applies, before any test rows exist.
$baseStmt = $pdo->prepare("SELECT COALESCE(SUM(paid_amount_try),0) AS p FROM ak_customer_financial_entries WHERE entry_date <= :t AND title NOT LIKE '%Hakediş%'");
$baseStmt->execute(['t' => $today]);
$baseline = (float) $baseStmt->fetchColumn();

$baseMonthStmt = $pdo->prepare("SELECT COALESCE(SUM(paid_amount_try),0) AS p FROM ak_customer_financial_entries WHERE entry_date >= :m AND entry_date <= :t AND title NOT LIKE '%Hakediş%'");
$baseMonthStmt->execute(['m' => $firstOfThisMonth, 't' => $today]);
$baselineMonth = (float) $baseMonthStmt->fetchColumn();

$pdo->beginTransaction();
// QA-B/C's exact repro shape: planned 100000, paid 120000 (overpaid), dated in the future.
insertEntry($pdo, $customer['id'], $project['id'], $future, 100000.0, 120000.0, 'future-overpaid');
// Control row: same amount, but due today — must be counted.
insertEntry($pdo, $customer['id'], $project['id'], $today, 100000.0, 120000.0, 'today-overpaid');
// Month boundary: dated the last day of the previous month — must NOT count toward "Bu Ay Tahsilat".
insertEntry($pdo, $customer['id'], $project['id'], $lastOfPrevMonth, 50000.0, 50000.0, 'prev-month-last-day');
// Month boundary: dated the first day of the current month — MUST count toward "Bu Ay Tahsilat".
insertEntry($pdo, $customer['id'], $project['id'], $firstOfThisMonth, 30000.0, 30000.0, 'this-month-first-day');

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
register_shutdown_function(function () use ($pdo, $baseline, $baselineMonth) {
    $out = ob_get_clean();
    $decoded = json_decode($out, true);
    $summary = $decoded['data']['summary'] ?? [];
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    fwrite(STDOUT, json_encode([
        'success' => is_array($decoded) && ($decoded['success'] ?? false) === true,
        'baseline_paid' => $baseline,
        'after_paid' => (float) ($summary['total_payments'] ?? -1),
        'baseline_month_paid' => $baselineMonth,
        'after_month_paid' => (float) ($summary['month_income'] ?? -1),
    ]));
});
include $root . '/public_html/api/admin/dashboard.php';
PHP;

$tmpFile = tempnam(sys_get_temp_dir(), 'dashboard_cutoff_probe_') . '.php';
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
    check('dashboard.php GET returned a successful envelope', $result['success'] === true, $failures, $passed);
    $delta = round($result['after_paid'] - $result['baseline_paid'], 2);
    check(
        'total_payments delta is exactly 200000 (today + prev-month-last-day + this-month-first-day rows count; the future-dated row — matching QA-B/C\'s exact ₺100.000/₺120.000 repro — must be excluded)',
        abs($delta - 200000.0) < 0.005,
        $failures, $passed
    );
    $monthDelta = round($result['after_month_paid'] - $result['baseline_month_paid'], 2);
    check(
        'month_income delta is exactly 150000 (today + this-month-first-day rows count; the future-dated row AND the previous-month-last-day row must both be excluded — month/year boundary)',
        abs($monthDelta - 150000.0) < 0.005,
        $failures, $passed
    );
}

echo "\n" . ($failures === [] ? "All {$passed} checks passed (transaction rolled back, zero footprint).\n" : count($failures) . " check(s) FAILED:\n- " . implode("\n- ", $failures) . "\n");
exit($failures === [] ? 0 : 1);
