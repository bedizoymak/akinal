<?php
declare(strict_types=1);

// AKINAL-QA-C-001 / AKINAL-QA-C-002 regression coverage for the shared date
// contract used by all four financial-entry flows: customer income, supplier
// expense, expense-card expense (via fe_payload() in finance-entry-helpers.php)
// and government progress-payment collections/breakdowns (government-progress-
// payments.php). require_iso_date()/nullable_iso_date() must reject a missing
// or malformed date with an explicit validation error instead of silently
// defaulting to today's date, and fe_auto_status()/fe_is_overdue() must
// classify past/future entries correctly against the Europe/Istanbul-pinned
// server "today" (see date_default_timezone_set() in helpers.php).

$root = dirname(__DIR__);

require_once $root . '/public_html/api/admin/helpers.php';
require_once $root . '/public_html/api/admin/finance-entry-helpers.php';

$failures = [];
$passed = 0;

function check(string $label, bool $ok, array &$failures, int &$passed): void
{
    if ($ok) {
        $passed++;
        return;
    }
    $failures[] = $label;
}

// ── In-process: accept path (no exit) ───────────────────────────────────────

check(
    'require_iso_date accepts a valid YYYY-MM-DD value and returns it unchanged',
    require_iso_date(['entry_date' => '2026-07-15'], 'entry_date', 'x') === '2026-07-15',
    $failures, $passed
);
check(
    'nullable_iso_date returns null for a missing optional field (Vade Tarihi is optional)',
    nullable_iso_date([], 'due_date', 'x') === null,
    $failures, $passed
);
check(
    'nullable_iso_date accepts a valid YYYY-MM-DD value and returns it unchanged',
    nullable_iso_date(['due_date' => '2026-10-20'], 'due_date', 'x') === '2026-10-20',
    $failures, $passed
);

// fe_auto_status() / fe_is_overdue() past/future classification. These use
// date('Y-m-d') as "today" — pinned to Europe/Istanbul by helpers.php so the
// classification always matches the business's local calendar day regardless
// of the shared host's default php.ini timezone.
$today = date('Y-m-d');
$yesterday = date('Y-m-d', strtotime('-1 day'));
$tomorrow = date('Y-m-d', strtotime('+1 day'));

check('fe_auto_status: unpaid + future date => Planlanan', fe_auto_status(1000, 0, $tomorrow) === 'Planlanan', $failures, $passed);
check('fe_auto_status: unpaid + today => Planlanan (not yet overdue)', fe_auto_status(1000, 0, $today) === 'Planlanan', $failures, $passed);
check('fe_auto_status: unpaid + past date => Gecikmiş', fe_auto_status(1000, 0, $yesterday) === 'Gecikmiş', $failures, $passed);
check('fe_auto_status: fully paid => Gerçekleşti', fe_auto_status(1000, 1000, $yesterday) === 'Gerçekleşti', $failures, $passed);
check('fe_auto_status: partially paid => Kısmi Ödendi', fe_auto_status(1000, 400, $yesterday) === 'Kısmi Ödendi', $failures, $passed);
check('fe_auto_status: overpaid => Fazla Ödendi', fe_auto_status(1000, 1200, $yesterday) === 'Fazla Ödendi', $failures, $passed);
check('fe_is_overdue: unpaid + past date => 1', fe_is_overdue(1000, 0, $yesterday) === 1, $failures, $passed);
check('fe_is_overdue: unpaid + today => 0 (due today is not yet overdue)', fe_is_overdue(1000, 0, $today) === 0, $failures, $passed);
check('fe_is_overdue: fully paid + past date => 0', fe_is_overdue(1000, 1000, $yesterday) === 0, $failures, $passed);

// EUR/TRY calculation regression via fe_payload() — locks in the demo
// reconciliation figures from the QA report (5,000 EUR planned / 2,000 EUR
// paid @ 1 EUR = 50 TRY => 250,000 / 100,000 TRY). fe_payload() needs a real
// project row for its FK check, so this only runs against a reachable local
// database; otherwise it's skipped rather than failed.
$configPath = $root . '/public_html/api/config.local.php';
if (!is_file($configPath)) {
    $configPath = $root . '/public_html/api/config.php';
}
$projectRow = null;
if (is_file($configPath)) {
    try {
        $projectRow = db()->query('SELECT id FROM ak_projects LIMIT 1')->fetch();
    } catch (Throwable $e) {
        $projectRow = null;
    }
}
if ($projectRow) {
    $payload = fe_payload([
        'project_id' => $projectRow['id'],
        'title' => 'EUR calc regression fixture',
        'entry_date' => $today,
        'amount' => 5000,
        'paid_amount' => 2000,
        'currency' => 'EUR',
        'account_type' => 'gayri_resmi',
        'payment_method' => 'Nakit',
        'exchange_rate_to_try' => 50,
    ], 'customer_id', 'fixture-customer-id');
    check('fe_payload: EUR planned amount_try = 5000 x 50 = 250000', abs($payload['amount_try'] - 250000.0) < 0.001, $failures, $passed);
    check('fe_payload: EUR realized paid_amount_try = 2000 x 50 = 100000', abs($payload['paid_amount_try'] - 100000.0) < 0.001, $failures, $passed);
} else {
    echo "  [SKIP] EUR/TRY fe_payload() regression check — no reachable local database\n";
}

// ── Subprocess: reject path ─────────────────────────────────────────────────
// require_iso_date()/nullable_iso_date() call json_error() on rejection, which
// exit()s the process — so the reject contract can only be observed from a
// separate PHP process (mirrors the shell_exec() pattern already used by
// scripts/verify-notifications-derivation.php and verify-gelenler-record-type-filter.php).
function assertRejects(string $label, string $callExpr, array &$failures, int &$passed, string $root): void
{
    $script = <<<PHP
<?php
declare(strict_types=1);
require_once '{$root}/public_html/api/admin/helpers.php';
{$callExpr}
echo 'NO_EXIT';
PHP;
    $tmpFile = tempnam(sys_get_temp_dir(), 'date_validation_') . '.php';
    file_put_contents($tmpFile, $script);
    $output = shell_exec('php ' . escapeshellarg($tmpFile) . ' 2>&1');
    unlink($tmpFile);

    $decoded = json_decode((string) $output, true);
    $ok = is_array($decoded) && ($decoded['success'] ?? null) === false;
    check($label . ' (output: ' . trim((string) $output) . ')', $ok, $failures, $passed);
}

assertRejects(
    'require_iso_date rejects a missing entry_date with an explicit error, not a silent CURDATE()',
    "require_iso_date([], 'entry_date', 'Gecerli bir tarih zorunludur.');",
    $failures, $passed, $root
);
assertRejects(
    'require_iso_date rejects an empty-string entry_date',
    "require_iso_date(['entry_date' => ''], 'entry_date', 'Gecerli bir tarih zorunludur.');",
    $failures, $passed, $root
);
assertRejects(
    'require_iso_date rejects a calendar-invalid date (2026-02-30)',
    "require_iso_date(['entry_date' => '2026-02-30'], 'entry_date', 'Gecerli bir tarih zorunludur.');",
    $failures, $passed, $root
);
assertRejects(
    'require_iso_date rejects a non-ISO format (15.07.2026)',
    "require_iso_date(['entry_date' => '15.07.2026'], 'entry_date', 'Gecerli bir tarih zorunludur.');",
    $failures, $passed, $root
);
assertRejects(
    'nullable_iso_date rejects a non-empty malformed due_date instead of silently storing it',
    "nullable_iso_date(['due_date' => '2026-13-40'], 'due_date', 'Gecerli bir vade tarihi girin.');",
    $failures, $passed, $root
);
assertRejects(
    'require_iso_date (used by government-progress-payments.php create_collection) rejects a missing collection_date',
    "require_iso_date([], 'collection_date', 'Gecerli bir tahsilat tarihi zorunludur.');",
    $failures, $passed, $root
);

echo "\n" . ($failures === [] ? "All {$passed} checks passed.\n" : count($failures) . " check(s) FAILED:\n- " . implode("\n- ", $failures) . "\n");
exit($failures === [] ? 0 : 1);
