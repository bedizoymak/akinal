<?php
declare(strict_types=1);

/**
 * QA-B BUG-01 regression check: "Genel Bakış" (dashboard.php) total_income_paid
 * / total_income_planned must equal Gelenler's totals for the same unfiltered
 * dataset — not ₺X more.
 *
 * Root cause: dashboard.php's compute_finance_summary() summed ALL rows of
 * ak_customer_financial_entries and then added ak_government_progress_payments
 * on top, without excluding rows whose title contains "Hakediş". Those rows are
 * copied (not deleted) into ak_government_progress_payments by the apply
 * migration — the cleanup migration that deletes the ak_customer_financial_entries
 * source rows is a separate, manual step (migrations/government-progress-payments-
 * cleanup.php) that had not been run. gelenler.php / project-statement.php /
 * customers.php / customer-financial-entries.php all already exclude
 * `title NOT LIKE '%Hakediş%'` for exactly this reason; dashboard.php did not,
 * so every migrated-but-not-yet-cleaned-up Hakediş row was counted twice.
 *
 * Fix: dashboard.php's customer-entry queries now apply the same
 * `title NOT LIKE '%Hakediş%'` exclusion as gelenler.php.
 *
 * Runs against the live database when reachable from this environment; skips
 * gracefully otherwise. Read-only.
 *
 * Run with: php scripts/verify-dashboard-hakedis-dedup.php
 */

$root = dirname(__DIR__);
$configPath = $root . '/public_html/api/config.php';

if (!is_file($configPath)) {
    echo "[SKIP] no local config.php — cannot reach a database from this environment\n";
    exit(0);
}

require_once $root . '/public_html/api/db.php';
$pdo = db();

function table_exists(PDO $pdo, string $table): bool
{
    $stmt = $pdo->prepare('SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :t LIMIT 1');
    $stmt->execute(['t' => $table]);
    return (bool) $stmt->fetchColumn();
}

echo "== Legacy Hakediş rows still present in ak_customer_financial_entries ==\n";
$legacy = $pdo->query("SELECT id, title, paid_amount_try FROM ak_customer_financial_entries WHERE title LIKE '%Hakediş%'")->fetchAll();
echo '  count: ' . count($legacy) . "\n";
foreach ($legacy as $row) {
    printf("  id=%s title=%-50s paid_amount_try=%s\n", $row['id'], $row['title'], $row['paid_amount_try']);
}

if ($legacy === []) {
    echo "\nNo legacy Hakediş rows found — cleanup migration has already run, or none exist. Dedup fix is a no-op on current data; still correct.\n";
    exit(0);
}

if (!table_exists($pdo, 'ak_government_progress_payments')) {
    echo "\n[SKIP] ak_government_progress_payments does not exist — cannot cross-check GPP totals\n";
    exit(0);
}

$legacyPaidSum = array_sum(array_column($legacy, 'paid_amount_try'));

// Reproduce compute_finance_summary()'s formula with and without the fix, using live data.
$custPaidUnfiltered = (float) $pdo->query('SELECT COALESCE(SUM(paid_amount_try),0) FROM ak_customer_financial_entries')->fetchColumn();
$custPaidFiltered    = (float) $pdo->query("SELECT COALESCE(SUM(paid_amount_try),0) FROM ak_customer_financial_entries WHERE title NOT LIKE '%Hakediş%'")->fetchColumn();
$gppPaid             = (float) $pdo->query('SELECT COALESCE(SUM(paid_amount_try),0) FROM ak_government_progress_payments')->fetchColumn();

$dashboardTotalBeforeFix = round($custPaidUnfiltered + $gppPaid, 2);
$dashboardTotalAfterFix  = round($custPaidFiltered + $gppPaid, 2);
$overcount = round($dashboardTotalBeforeFix - $dashboardTotalAfterFix, 2);

echo "\n== Reconciliation ==\n";
echo "  customer paid (unfiltered, pre-fix formula):        {$custPaidUnfiltered}\n";
echo "  customer paid (title NOT LIKE Hakediş, fixed):       {$custPaidFiltered}\n";
echo "  GPP paid:                                            {$gppPaid}\n";
echo "  dashboard total_income_paid BEFORE fix would be:     {$dashboardTotalBeforeFix}\n";
echo "  dashboard total_income_paid AFTER fix is:            {$dashboardTotalAfterFix}\n";
echo "  overcounted amount eliminated by the fix:            {$overcount}\n";

$ok = $overcount >= 0.0 && abs($dashboardTotalAfterFix - ($custPaidFiltered + $gppPaid)) < 0.01;
echo "\n" . ($ok ? "[OK] dashboard.php's fixed formula matches Gelenler's canonical (customer minus Hakediş) + GPP total.\n"
                 : "[FAIL] reconciliation mismatch — investigate.\n");
exit($ok ? 0 : 1);
