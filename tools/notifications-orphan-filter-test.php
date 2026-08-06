<?php
declare(strict_types=1);

// Regression coverage for QA-B/C BUG-07: a persisted payment-reminder notification
// (type Yaklaşan Ödeme/Bugünkü Tahsilat/Geciken Ödeme) whose source ak_customer_financial_entries
// row was deleted (or paid off) had nothing that ever removed it — the only cleanup path
// (notifications_sync_payment_notifications()) is an opt-in POST nothing calls automatically.
// GET now filters these out at read time (filter_out_orphan_payment_notifications()) without
// performing any write, so an orphaned reminder stops appearing/counting immediately.
//
// notifications.php is a live endpoint file with top-level side effects — this spawns a real
// subprocess that fakes an admin session and includes the actual, unmodified file, exactly like
// tools/vadesi-gecen-alacak-overdue-test.php does. The persisted notification row this test
// inserts is deleted again in a finally-style cleanup at the end regardless of outcome — GET
// itself never writes, so there's nothing to roll back for that half of the test.

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

// A persisted reminder row with no resolvable source record. related_payment_plan_id has an FK
// to the legacy ak_payment_plans table (ON DELETE SET NULL) — a random non-existent UUID would
// violate it, so NULL is used to represent "the source is gone", exactly what that FK's own
// ON DELETE SET NULL clause produces when the referenced legacy row is actually deleted. Either
// way the notification's related_payment_plan_id ends up empty, which is exactly the case
// filter_out_orphan_payment_notifications() must treat as orphaned.
$notificationId = bin2hex(random_bytes(16));
$pdo->prepare('
    INSERT INTO ak_notifications (id, title, message, type, priority, related_payment_plan_id, is_read)
    VALUES (:id, :title, :message, \'Geciken Ödeme\', \'Kritik\', NULL, 0)
')->execute([
    'id' => $notificationId,
    'title' => 'TOOLS-TEST bug07 orphan reminder',
    'message' => 'TOOLS-TEST bug07 — source record does not exist',
]);

$cleanup = function () use ($pdo, $notificationId) {
    $pdo->prepare('DELETE FROM ak_notifications WHERE id = :id')->execute(['id' => $notificationId]);
};

ob_start();
chdir($root . '/public_html/api/admin');
session_start();
$admin = $pdo->query("SELECT id FROM ak_admin_users WHERE role='admin' AND is_active=1 LIMIT 1")->fetch();
if (!$admin) {
    ob_end_clean();
    $cleanup();
    echo json_encode(['skip' => 'no active admin user']);
    exit(0);
}
$_SESSION['admin'] = ['id' => $admin['id'], 'email' => 'diagnostic@local', 'role' => 'admin'];
$_SERVER['REQUEST_METHOD'] = 'GET';
register_shutdown_function(function () use ($pdo, $notificationId, $cleanup) {
    $out = ob_get_clean();
    $decoded = json_decode($out, true);
    $cleanup();
    $ids = array_column($decoded['data']['notifications'] ?? [], 'id');
    fwrite(STDOUT, json_encode([
        'success' => is_array($decoded) && ($decoded['success'] ?? false) === true,
        'orphan_present_in_response' => in_array($notificationId, $ids, true),
    ]));
});
include $root . '/public_html/api/admin/notifications.php';
PHP;

$tmpFile = tempnam(sys_get_temp_dir(), 'notifications_orphan_probe_') . '.php';
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
    check('notifications.php GET returned a successful envelope', $result['success'] === true, $failures, $passed);
    check(
        'the orphaned reminder (pointing at a non-existent source record) is excluded from the GET response',
        $result['orphan_present_in_response'] === false,
        $failures, $passed
    );
}

echo "\n" . ($failures === [] ? "All {$passed} checks passed (disposable notification row cleaned up).\n" : count($failures) . " check(s) FAILED:\n- " . implode("\n- ", $failures) . "\n");
exit($failures === [] ? 0 : 1);
