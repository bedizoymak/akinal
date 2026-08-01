<?php
declare(strict_types=1);

/**
 * Local, dependency-free verification for public_html/api/admin/backup-cron.php
 * (the GitHub Actions / server-to-server daily backup trigger). Covers both
 * static source guarantees and real HTTP behavior via PHP's built-in web
 * server — no production backup is ever run: this environment's
 * config.local.php has no BACKUP_CRON_TOKEN configured, so
 * backup_cron_token_source() always returns null here and every request,
 * even with a token supplied, is correctly rejected before
 * backup_execute_full_run() could ever be reached.
 *
 * Run with: php scripts/verify-backup-cron-endpoint.php
 */

$root = dirname(__DIR__);
$target = $root . '/public_html/api/admin/backup-cron.php';

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

echo "== 1. Static source checks ==\n";
$src = (string) @file_get_contents($target);
check('backup-cron.php exists', $src !== '', $failures, $passed);
check('rejects non-POST before touching backup-lib.php (method check precedes the require)', strpos($src, "!== 'POST'") !== false && strpos($src, "!== 'POST'") < strpos($src, "require_once __DIR__ . '/backup-lib.php'"), $failures, $passed);
check('uses hash_equals() for the token comparison (constant-time)', strpos($src, 'hash_equals($configuredToken, $providedToken)') !== false, $failures, $passed);
check('missing/invalid/unconfigured token all produce the exact same generic 401 payload', substr_count($src, "backup_cron_send_json(401, ['success' => false, 'code' => 'unauthorized'])") === 1, $failures, $passed);
check('never calls require_admin() (no browser session required)', !preg_match('/(?<!\.\s)\brequire_admin\(\)\s*;/', $src) && strpos($src, '= require_admin(') === false, $failures, $passed);
check('never sends an Access-Control-Allow-Origin or other CORS header', !preg_match("/header\\(\\s*['\"]Access-Control-Allow/i", $src), $failures, $passed);
check('calls the canonical backup_execute_full_run() — no reimplemented archive/upload logic', strpos($src, "backup_execute_full_run('daily_cron')") !== false, $failures, $passed);
check('does not call gdrive_upload_file/backup_build_frontend_archive/backup_dump_database directly (no duplicated logic)', strpos($src, 'gdrive_upload_file(') === false && strpos($src, 'backup_build_frontend_archive(') === false && strpos($src, 'backup_dump_database(') === false, $failures, $passed);
check('distinctly handles BackupAlreadyRunningException as a safe, non-error "locked" result', strpos($src, 'catch (BackupAlreadyRunningException $exception)') !== false && strpos($src, "'code' => 'already_running'") !== false && strpos($src, "'locked' => true") !== false, $failures, $passed);

// Root-cause regression coverage: a GitHub Actions run reported HTTP 200 in
// ~1s with NO Drive package and NO email, because the workflow only checked
// the HTTP status code — and an already-running lock legitimately returns
// 200 (by design, "nothing failed") with success=false. The fix has two
// halves: this endpoint must expose an explicit, unambiguous machine-
// readable status for that case, and (checked further below) the workflow
// must actually look at it instead of trusting the status code alone.
echo "\n== 1b. Root-cause fix: locked/failed responses can never look like a real completion ==\n";
check('the locked response includes an explicit status: "locked" field (not just a boolean/code an integrator could miss)', strpos($src, "'status' => 'locked'") !== false, $failures, $passed);
check('the locked response sets success => false (never true) alongside status => locked', (bool) preg_match("/'success' => false,\\s*\\n\\s*'code' => 'already_running',\\s*\\n\\s*'status' => 'locked',/", $src), $failures, $passed);
check('a locked rejection is now also written to the private log (previously silent — the actual production incident left zero log trace of the cron attempt)', strpos($src, "backup_log('Cron backup trigger found a run already in progress") !== false, $failures, $passed);
check('the only place success => true is ever sent is the final response, built strictly AFTER backup_execute_full_run() returned without throwing', substr_count($src, "'success' => true") === 1 && strpos($src, "'success' => true") > strpos($src, "\$result = backup_execute_full_run('daily_cron')"), $failures, $passed);
check('every failure/locked JSON payload in this file explicitly sets success => false (no path can omit it and default ambiguously)', substr_count($src, "'success' => false") === 7, $failures, $passed);
check('audits with a synthetic github-actions-cron marker, never a real admin session object', strpos($src, "\$cronAdmin = ['email' => 'github-actions-cron']") !== false, $failures, $passed);
check('never echoes the provided Authorization header or token value into any response/log call', !preg_match('/(backup_cron_send_json|backup_log)\([^)]*\$provided(Header|Token)/', $src), $failures, $passed);
check('never echoes the configured token value into any response/log call', !preg_match('/(backup_cron_send_json|backup_log)\([^)]*\$configuredToken/', $src), $failures, $passed);
check('has a register_shutdown_function fatal-error safety net installed before the backup-lib.php require', strpos($src, 'register_shutdown_function(') < strpos($src, "require_once __DIR__ . '/backup-lib.php'"), $failures, $passed);
check('a stage-labeled BackupStageException failure never includes the raw exception message (already sanitized upstream)', strpos($src, "'stage' => \$exception->getStage()") !== false, $failures, $passed);

$exampleConfigSource = (string) @file_get_contents($root . '/akinal-private/akinal-backup/backup-config.local.example.php');
check('the tracked private-config example documents BACKUP_CRON_TOKEN', strpos($exampleConfigSource, "'BACKUP_CRON_TOKEN' =>") !== false, $failures, $passed);
check('the example does not contain a real-looking secret (only the documented placeholder text)', strpos($exampleConfigSource, 'generate-a-long-random-secret-and-set-it-only-in-private-config') !== false, $failures, $passed);

$workflowSource = (string) @file_get_contents($root . '/.github/workflows/daily-backup.yml');
check('.github/workflows/daily-backup.yml exists', $workflowSource !== '', $failures, $passed);
check('scheduled for 00:00 UTC daily', strpos($workflowSource, 'cron: "0 0 * * *"') !== false, $failures, $passed);
check('supports workflow_dispatch for manual testing', strpos($workflowSource, 'workflow_dispatch') !== false, $failures, $passed);
check('reads BACKUP_CRON_URL and BACKUP_CRON_TOKEN only from repository secrets', strpos($workflowSource, 'secrets.BACKUP_CRON_URL') !== false && strpos($workflowSource, 'secrets.BACKUP_CRON_TOKEN') !== false, $failures, $passed);
check('the workflow never echoes the token value itself (only ever used inside a curl --header argument)', !preg_match('/\becho\b[^\n]*\$\{?BACKUP_CRON_TOKEN\}?/', $workflowSource), $failures, $passed);
check('fails the job on a non-2xx response', strpos($workflowSource, 'exit 1') !== false, $failures, $passed);

echo "\n== 2b. Root-cause fix: the workflow validates the JSON body, not just the HTTP status code ==\n";
check('the workflow computes success strictly from `.success == true` in the JSON body (not merely "field present")', strpos($workflowSource, "jq -r 'if .success == true then \"true\" else \"false\" end'") !== false, $failures, $passed);
check('the workflow independently validates the response is parseable JSON before trusting any field from it', strpos($workflowSource, 'jq -e . "$response_file"') !== false, $failures, $passed);
check('an HTTP 2xx alone is no longer sufficient to pass the job — the case statement only breaks out of the non-2xx branch, it does not exit 0', !preg_match('/2\?\?\)\s*exit 0/', $workflowSource), $failures, $passed);
check('the job fails when success is not exactly "true" (covers locked, failed, and any unexpected shape)', strpos($workflowSource, 'if [ "$success" != "true" ]') !== false, $failures, $passed);
check('the job fails when package_name is empty even if success somehow said true', strpos($workflowSource, 'if [ -z "$package_name" ]') !== false, $failures, $passed);
check('the job fails outright on invalid/unparseable JSON rather than treating missing fields as passing', strpos($workflowSource, 'if [ "$is_valid_json" != "true" ]') !== false, $failures, $passed);
check('job timeout is at least 20 minutes (sufficient for the full synchronous backup run)', (bool) preg_match('/timeout-minutes:\s*(\d+)/', $workflowSource, $m) && (int) $m[1] >= 20, $failures, $passed);

echo "\n== 3. Live HTTP checks via PHP's built-in server (no production backup ever reachable — no token configured locally) ==\n";

$phpBinary = PHP_BINARY !== '' ? PHP_BINARY : 'php';
$port = 8391;
$descriptors = [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
$process = proc_open([$phpBinary, '-S', "127.0.0.1:{$port}", '-t', $root . '/public_html'], $descriptors, $pipes, $root);

if (!is_resource($process)) {
    echo "  [SKIP] Could not launch PHP built-in server — skipping live HTTP checks.\n";
} else {
    fclose($pipes[0]);
    stream_set_blocking($pipes[1], false);
    stream_set_blocking($pipes[2], false);

    // Give the server a moment to start listening.
    usleep(400000);

    $url = "http://127.0.0.1:{$port}/api/admin/backup-cron.php";

    function http_call(string $url, string $method, ?string $bearer, array &$failures, int &$passed): array
    {
        $ch = curl_init($url);
        $headers = ['Accept: application/json'];
        if ($bearer !== null) {
            $headers[] = 'Authorization: Bearer ' . $bearer;
        }
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => 10,
        ]);
        $body = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return ['status' => $status, 'body' => (string) $body];
    }

    if (!extension_loaded('curl')) {
        echo "  [SKIP] ext-curl not available locally — skipping live HTTP checks.\n";
    } else {
        $getResp = http_call($url, 'GET', null, $failures, $passed);
        check('GET is rejected with 405', $getResp['status'] === 405, $failures, $passed);

        $noAuthResp = http_call($url, 'POST', null, $failures, $passed);
        check('POST with no Authorization header is rejected with 401', $noAuthResp['status'] === 401, $failures, $passed);
        check('the 401 body is generic JSON with no technical/path detail', strpos($noAuthResp['body'], $root) === false, $failures, $passed);

        $wrongAuthResp = http_call($url, 'POST', 'clearly-the-wrong-token-value', $failures, $passed);
        check('POST with an invalid bearer token is rejected with 401', $wrongAuthResp['status'] === 401, $failures, $passed);
        check('a wrong token produces the SAME response as no token at all (does not reveal which failed)', $wrongAuthResp['body'] === $noAuthResp['body'] && $wrongAuthResp['status'] === $noAuthResp['status'], $failures, $passed);
        check('the invalid-token attempt never echoes the submitted token value back', strpos($wrongAuthResp['body'], 'clearly-the-wrong-token-value') === false, $failures, $passed);

        $allBodies = $getResp['body'] . $noAuthResp['body'] . $wrongAuthResp['body'];
        check('no response body ever contains the literal string "BACKUP_CRON_TOKEN"', stripos($allBodies, 'BACKUP_CRON_TOKEN') === false, $failures, $passed);
        check('no response body ever contains a raw absolute filesystem path', strpos($allBodies, $root) === false, $failures, $passed);
        check('no response body ever contains common credential-shaped keys', !preg_match('/"(private_key|client_secret|access_token|password|authorization)"/i', $allBodies), $failures, $passed);
    }

    proc_terminate($process);
    proc_close($process);
}

echo "\n---\n";
echo $passed . ' passed, ' . count($failures) . " failed.\n";

if ($failures) {
    echo "\nFailed checks:\n";
    foreach ($failures as $failure) {
        echo " - {$failure}\n";
    }
    exit(1);
}

exit(0);
