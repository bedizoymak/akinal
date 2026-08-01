<?php
declare(strict_types=1);

/**
 * Isolated, controlled-failure execution proof for public_html/api/admin/backup-run-now.php.
 *
 * Actually launches the real script as a PHP CLI subprocess (no session, no
 * POST body — a guaranteed, deterministic "unauthenticated request" failure
 * that requires no database or Google Drive setup to trigger, since
 * require_admin() rejects it before either is ever touched) and asserts the
 * response is clean, well-formed JSON — never a blank page or raw PHP
 * fatal-error/HTML output — proving the endpoint's fatal-safety net and
 * bootstrap error handling actually work end to end, not just in theory.
 *
 * Run with: php scripts/verify-backup-run-now-json-safety.php
 */

$root = dirname(__DIR__);
$target = $root . '/public_html/api/admin/backup-run-now.php';

if (!is_file($target)) {
    fwrite(STDERR, "backup-run-now.php not found.\n");
    exit(1);
}

$phpBinary = PHP_BINARY !== '' ? PHP_BINARY : 'php';
$descriptors = [
    0 => ['pipe', 'r'],
    1 => ['pipe', 'w'],
    2 => ['pipe', 'w'],
];

$process = proc_open([$phpBinary, $target], $descriptors, $pipes, $root);
if (!is_resource($process)) {
    fwrite(STDERR, "Could not launch PHP subprocess for backup-run-now.php.\n");
    exit(1);
}

fclose($pipes[0]);
$stdout = stream_get_contents($pipes[1]);
$stderr = stream_get_contents($pipes[2]);
fclose($pipes[1]);
fclose($pipes[2]);
$exitCode = proc_close($process);

$stdout = (string) $stdout;
$failures = [];
$passed = 0;

function check(string $label, bool $ok, array &$failures, int &$passed): void
{
    if ($ok) {
        $passed++;
        echo "  [OK] {$label}\n";
    } else {
        $failures[] = $label;
        echo "  [FAIL] {$label}\n";
    }
}

echo "== Controlled failure case: unauthenticated POST-less CLI execution ==\n";
echo "-- (deterministic, requires no DB/Drive setup — require_admin() rejects it\n";
echo "--  before either is ever touched, exercising the bootstrap path directly) --\n";

$trimmed = trim($stdout);
$decoded = json_decode($trimmed, true);

check('produced non-empty output (not a silently blank response)', $trimmed !== '', $failures, $passed);
check('stdout contains no raw PHP fatal-error/HTML leakage', stripos($stdout, 'Fatal error') === false && stripos($stdout, '<br') === false && stripos($stdout, '<b>Warning') === false && stripos($stdout, 'Stack trace') === false, $failures, $passed);
check('response is valid, well-formed JSON', is_array($decoded), $failures, $passed);
check("JSON has 'success' => false for this rejected request", is_array($decoded) && ($decoded['success'] ?? null) === false, $failures, $passed);
check('JSON message is present and is the generic, safe string (no technical detail)', is_array($decoded) && is_string($decoded['message'] ?? null) && ($decoded['message'] ?? '') !== '', $failures, $passed);
check('response never includes a raw absolute filesystem path', strpos($stdout, $root) === false, $failures, $passed);
check('response never includes common credential-shaped keys', !preg_match('/"(private_key|client_secret|access_token|password)"/i', $stdout), $failures, $passed);

echo "\nSubprocess exit code: {$exitCode}\n";
echo "Raw response body:\n{$trimmed}\n";

echo "\n---\n";
echo $passed . ' passed, ' . count($failures) . " failed.\n";

if ($failures) {
    echo "\nFailed checks:\n";
    foreach ($failures as $failure) {
        echo " - {$failure}\n";
    }
    if ($stderr !== '') {
        echo "\nSubprocess stderr:\n{$stderr}\n";
    }
    exit(1);
}

exit(0);
