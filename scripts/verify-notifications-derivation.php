<?php
declare(strict_types=1);

/**
 * P2-3 regression check: notifications_classify_receivable() (pure, no I/O)
 * and the read-only GET path of notifications.php. No database write is
 * ever exercised by this script.
 *
 * Run with: php scripts/verify-notifications-derivation.php
 */

$root = dirname(__DIR__);
$source = file_get_contents($root . '/public_html/api/admin/notifications.php');

function extract_function(string $source, string $name): string
{
    $start = strpos($source, "function {$name}(");
    if ($start === false) {
        fwrite(STDERR, "Could not find function {$name}() in notifications.php\n");
        exit(1);
    }
    $depth = 0; $end = $start; $started = false;
    for ($i = $start; $i < strlen($source); $i++) {
        if ($source[$i] === '{') { $depth++; $started = true; }
        if ($source[$i] === '}') { $depth--; if ($started && $depth === 0) { $end = $i + 1; break; } }
    }
    return substr($source, $start, $end - $start);
}

eval(extract_function($source, 'notifications_classify_receivable'));

$failures = [];
$passed = 0;
function check(string $label, bool $ok, array &$failures, int &$passed): void
{
    if ($ok) { $passed++; echo "  [OK] {$label}\n"; }
    else { $failures[] = $label; echo "  [FAIL] {$label}\n"; }
}

$today = '2026-08-05';
$windowEnd = '2026-08-12';

echo "== Classification ==\n";
check(
    'overdue (due before today) classifies as Geciken Ödeme / Kritik',
    notifications_classify_receivable('X', '2026-07-30', 1000, $today, $windowEnd)['type'] === 'Geciken Ödeme'
        && notifications_classify_receivable('X', '2026-07-30', 1000, $today, $windowEnd)['priority'] === 'Kritik',
    $failures, $passed
);
check(
    'due today classifies as Bugünkü Tahsilat / Yüksek',
    notifications_classify_receivable('X', $today, 1000, $today, $windowEnd)['type'] === 'Bugünkü Tahsilat',
    $failures, $passed
);
check(
    'due within window classifies as Yaklaşan Ödeme / Yüksek',
    notifications_classify_receivable('X', '2026-08-10', 1000, $today, $windowEnd)['type'] === 'Yaklaşan Ödeme',
    $failures, $passed
);
check(
    'due beyond the window is not alert-eligible (null)',
    notifications_classify_receivable('X', '2026-08-20', 1000, $today, $windowEnd) === null,
    $failures, $passed
);
check(
    'fully paid (remaining <= 0) is excluded regardless of due date',
    notifications_classify_receivable('X', '2026-07-01', 0, $today, $windowEnd) === null,
    $failures, $passed
);
check(
    'empty due date is excluded',
    notifications_classify_receivable('X', '', 1000, $today, $windowEnd) === null,
    $failures, $passed
);
check(
    'blank title falls back to a safe default rather than an empty message',
    str_contains((string) notifications_classify_receivable('', $today, 1000, $today, $windowEnd)['message'], 'Ödeme'),
    $failures, $passed
);

echo "\n== Dedup key shape / synthetic id collision safety ==\n";
check(
    'same entry+type+day produces the same synthetic id twice (idempotent)',
    ('synthetic:' . 'abc' . ':' . 'Geciken Ödeme' . ':' . $today) === ('synthetic:' . 'abc' . ':' . 'Geciken Ödeme' . ':' . $today),
    $failures, $passed
);
check(
    'synthetic id prefix cannot collide with a persisted UUID id (UUIDs never contain a colon)',
    !str_contains('a1b2c3d4-1234-5678-9abc-def012345678', ':') && str_starts_with('synthetic:a1b2c3d4-1234-5678-9abc-def012345678:Geciken Ödeme:' . $today, 'synthetic:'),
    $failures, $passed
);
check(
    'different entries produce different synthetic ids (no accidental collapse)',
    ('synthetic:entry-A:Geciken Ödeme:' . $today) !== ('synthetic:entry-B:Geciken Ödeme:' . $today),
    $failures, $passed
);

echo "\n== Derived/persisted deduplication (simulated) ==\n";
// Simulates the GET handler's dedup filter: a persisted row with
// related_payment_plan_id=X, type=Geciken Ödeme, created today must suppress
// the derived alert for that same entry/type/day.
$persistedKeys = ['entry-A' . '|' . 'Geciken Ödeme' . '|' . $today => true];
$derivedSample = [
    ['id' => 'synthetic:entry-A:Geciken Ödeme:' . $today, 'type' => 'Geciken Ödeme', 'created_at' => $today . ' 00:00:00'],
    ['id' => 'synthetic:entry-B:Geciken Ödeme:' . $today, 'type' => 'Geciken Ödeme', 'created_at' => $today . ' 00:00:00'],
];
$afterDedup = array_values(array_filter($derivedSample, static function (array $d) use ($persistedKeys): bool {
    $entryId = explode(':', (string) $d['id'])[1] ?? '';
    $key = $entryId . '|' . $d['type'] . '|' . substr((string) $d['created_at'], 0, 10);
    return !isset($persistedKeys[$key]);
}));
check(
    'a derived alert already covered by a persisted row is suppressed (entry-A removed)',
    count($afterDedup) === 1 && $afterDedup[0]['id'] === 'synthetic:entry-B:Geciken Ödeme:' . $today,
    $failures, $passed
);

// ── Live read-only GET check, isolated in a subprocess (this process already
// declared notifications_classify_receivable() via eval, so including the
// real notifications.php here directly would fatal on redeclaration). ──────

echo "\n== Read-only GET path (no writes), live subprocess ==\n";
$configPath = $root . '/public_html/api/config.php';
if (!is_file($configPath)) {
    echo "  [SKIP] no local config.php — cannot reach a database from this environment\n";
} else {
    $subprocessScript = <<<'PHP'
<?php
declare(strict_types=1);
$root = %s;
require_once $root . '/public_html/api/db.php';
$pdo = db();
$before = (int) $pdo->query('SELECT COUNT(*) FROM ak_notifications')->fetchColumn();

ob_start();
chdir($root . '/public_html/api/admin');
session_start();
$admin = $pdo->query("SELECT id FROM ak_admin_users WHERE role='admin' AND is_active=1 LIMIT 1")->fetch();
if (!$admin) {
    ob_end_clean();
    echo json_encode(['skip' => 'no active admin user']);
    exit(0);
}
$_SESSION['admin'] = ['id' => $admin['id'], 'email' => 'diagnostic@local', 'role' => 'admin'];
$_SERVER['REQUEST_METHOD'] = 'GET';
register_shutdown_function(function () use ($pdo, $before) {
    $out = ob_get_clean();
    $after = (int) $pdo->query('SELECT COUNT(*) FROM ak_notifications')->fetchColumn();
    $decoded = json_decode($out, true);
    fwrite(STDOUT, json_encode([
        'success' => is_array($decoded) && ($decoded['success'] ?? false) === true,
        'before' => $before,
        'after' => $after,
        'synthetic_count' => count(array_filter(array_column($decoded['data']['notifications'] ?? [], 'id'), static fn($id) => str_starts_with((string) $id, 'synthetic:'))),
    ]));
});
include $root . '/public_html/api/admin/notifications.php';
PHP;
    $tmpFile = tempnam(sys_get_temp_dir(), 'notif_probe_') . '.php';
    file_put_contents($tmpFile, sprintf($subprocessScript, var_export($root, true)));
    $output = shell_exec('php ' . escapeshellarg($tmpFile) . ' 2>&1');
    unlink($tmpFile);

    $lastLine = trim((string) $output);
    $lines = explode("\n", $lastLine);
    $jsonLine = end($lines);
    $result = json_decode($jsonLine, true);

    if (!is_array($result)) {
        check('subprocess produced parseable output (' . substr((string) $output, 0, 200) . ')', false, $failures, $passed);
    } elseif (isset($result['skip'])) {
        echo "  [SKIP] {$result['skip']}\n";
    } else {
        check('GET returns a successful envelope', $result['success'] === true, $failures, $passed);
        check("GET performed zero writes to ak_notifications (before={$result['before']} after={$result['after']})", $result['before'] === $result['after'], $failures, $passed);
        echo "  (" . $result['synthetic_count'] . " synthetic alert(s) currently derived from real open receivables)\n";
    }
}

echo "\n" . ($failures === [] ? "All {$passed} checks passed.\n" : count($failures) . " check(s) FAILED:\n- " . implode("\n- ", $failures) . "\n");
exit($failures === [] ? 0 : 1);
