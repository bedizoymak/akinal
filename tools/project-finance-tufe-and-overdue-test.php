<?php
declare(strict_types=1);

// Regression coverage for QA-B/C BUG-04 (Proje Finans TÜFE KPI) and BUG-05 (Proje Finans
// gelir satırlarında gecikme hesaplanmıyor) — both live in project-statement.php's row
// mapping / compute_statement_summary().
//
// BUG-04: a still-open customer income row whose calculate_inflation_adjustment() call
// returns null (missing TCMB data for the period, or entry_date <= created_at so "inflation
// forward" has no defined target) previously fell back to summing its `paid_amount_try`
// (often 0 for a never-paid row) instead of its nominal `amount_try`, silently pulling the
// whole "TÜFE Güncelleme" KPI below the nominal planned total.
//
// BUG-05: income rows rendered their stored `status`/`is_overdue` columns, which are written
// once at create/update time and never refreshed — a row whose due date has since passed
// keeps a stale "Planlanan" forever. Gelenler already self-corrects via fe_enrich();
// project-statement.php's UNION query bypassed it entirely.
//
// project-statement.php is a live endpoint file with top-level side effects — this spawns a
// real subprocess that fakes an admin session and includes the actual, unmodified file,
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

$customer = $pdo->query('SELECT id FROM ak_customers LIMIT 1')->fetch();
if (!$customer) {
    echo json_encode(['skip' => 'no customer row to anchor a disposable test project/entries']);
    exit(0);
}

$projectId = bin2hex(random_bytes(16));
$yesterday = date('Y-m-d', strtotime('-1 day'));
$today = date('Y-m-d');

function insertCfe(PDO $pdo, string $customerId, string $projectId, string $entryDate, float $amount, float $paid, string $status, string $marker): string
{
    $id = bin2hex(random_bytes(16));
    $title = 'TOOLS-TEST project-statement ' . $marker . ' ' . $id;
    $pdo->prepare('
        INSERT INTO ak_customer_financial_entries
          (id, customer_id, project_id, title, entry_date, amount, paid_amount, currency,
           exchange_rate_to_try, amount_try, paid_amount_try, account_type, payment_method,
           status, is_overdue, created_at)
        VALUES
          (:id, :customer_id, :project_id, :title, :entry_date, :amount1, :paid1, \'TRY\',
           1, :amount2, :paid2, \'resmi\', \'Nakit\', :status, 0, NOW())
    ')->execute([
        'id' => $id, 'customer_id' => $customerId, 'project_id' => $projectId,
        'title' => $title, 'entry_date' => $entryDate,
        'amount1' => $amount, 'paid1' => $paid, 'amount2' => $amount, 'paid2' => $paid,
        'status' => $status,
    ]);
    return $id;
}

$pdo->beginTransaction();
$pdo->prepare('INSERT INTO ak_projects (id, title, slug, short_description, project_type, project_status, location, is_published, sort_order, created_at) VALUES (:id, :title, :slug, \'\', \'Konut Projesi\', \'Planlama Aşamasında\', \'TOOLS-TEST\', 0, 999, NOW())')
    ->execute(['id' => $projectId, 'title' => 'TOOLS-TEST project-statement project', 'slug' => 'tools-test-project-statement-' . $projectId]);

// BUG-04 case A: still-open (Planlanan), unpaid, entry_date backdated BEFORE created_at (=NOW()),
// so calculate_inflation_adjustment() must return null (target period <= base period) — this is
// exactly the QA-B/C repro shape (a demo row entered today with an earlier due date).
$openRowId = insertCfe($pdo, $customer['id'], $projectId, $yesterday, 200000.0, 0.0, 'Planlanan', 'open-null-inflation');

// BUG-04 case B: overpaid (Fazla Ödendi) — must contribute its real paid amount, unaffected by
// the BUG-04 fix (this is the explicitly-correct existing behavior, not the bug).
insertCfe($pdo, $customer['id'], $projectId, $yesterday, 100000.0, 120000.0, 'Fazla Ödendi', 'overpaid');

// BUG-05 case: stale stored status/is_overdue (deliberately wrong — "Planlanan"/0 — even
// though entry_date is in the past and unpaid) proves the screen recomputes live.
$overdueRowId = insertCfe($pdo, $customer['id'], $projectId, $yesterday, 50000.0, 0.0, 'Planlanan', 'stale-overdue');

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
$_GET['project_id'] = $projectId;
register_shutdown_function(function () use ($pdo, $openRowId, $overdueRowId) {
    $out = ob_get_clean();
    $decoded = json_decode($out, true);
    $rows = $decoded['data']['rows'] ?? [];
    $summary = $decoded['data']['summary'] ?? [];
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    $openRow = null;
    $overdueRow = null;
    foreach ($rows as $r) {
        if (($r['id'] ?? '') === $openRowId) $openRow = $r;
        if (($r['id'] ?? '') === $overdueRowId) $overdueRow = $r;
    }

    fwrite(STDOUT, json_encode([
        'success' => is_array($decoded) && ($decoded['success'] ?? false) === true,
        // BUG-04: total_income_planned = 200000 + 100000 = 300000, so the TÜFE KPI's floor
        // (with the open row's null-inflation nominal fallback + overpaid row's real paid)
        // must be >= 300000 - 100000 (i.e. never lose the open row's 200000 nominal value).
        'customer_income_inflation_adjusted' => $summary['customer_income_inflation_adjusted'] ?? null,
        'customer_income_planned' => $summary['customer_income_planned'] ?? null,
        // BUG-05: the stale-flagged row must show is_overdue=1 / status='Gecikmiş' live.
        'overdue_row_found' => $overdueRow !== null,
        'overdue_row_is_overdue' => $overdueRow['is_overdue'] ?? null,
        'overdue_row_status' => $overdueRow['status'] ?? null,
        'open_row_found' => $openRow !== null,
    ]));
});
include $root . '/public_html/api/admin/project-statement.php';
PHP;

$tmpFile = tempnam(sys_get_temp_dir(), 'project_statement_probe_') . '.php';
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
    check('project-statement.php GET returned a successful envelope', $result['success'] === true, $failures, $passed);

    // BUG-04 — three rows inserted: open/unpaid 200000, overpaid 100000 (paid 120000), stale-overdue 50000.
    $planned = (float) ($result['customer_income_planned'] ?? -1);
    $adj = $result['customer_income_inflation_adjusted'] ?? null;
    check('customer_income_planned includes all three test rows (350000)', abs($planned - 350000.0) < 0.005, $failures, $passed);
    check(
        'customer_income_inflation_adjusted is not null and is at least the nominal planned total (never collapses the open row\'s null-inflation contribution to 0/paid)',
        $adj !== null && (float) $adj >= $planned - 0.005,
        $failures, $passed
    );

    // BUG-05
    check('the stale-flagged overdue test row was found in the response', $result['overdue_row_found'] === true, $failures, $passed);
    check('its is_overdue is recomputed live to 1 despite the stored column being 0', (int) ($result['overdue_row_is_overdue'] ?? 0) === 1, $failures, $passed);
    check('its status is recomputed live to "Gecikmiş" despite the stored column being "Planlanan"', ($result['overdue_row_status'] ?? '') === 'Gecikmiş', $failures, $passed);
}

echo "\n" . ($failures === [] ? "All {$passed} checks passed (transaction rolled back, zero footprint).\n" : count($failures) . " check(s) FAILED:\n- " . implode("\n- ", $failures) . "\n");
exit($failures === [] ? 0 : 1);
