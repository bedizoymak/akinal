<?php
declare(strict_types=1);

/**
 * Server-to-server daily backup trigger (e.g. for GitHub Actions). Calls the
 * EXACT SAME backup_execute_full_run() used by the admin "Şimdi Drive'a
 * Yedekle" button (backup-run-now.php) and the CLI cron entry point
 * (cron/backup-daily.php) — same locking, archive/checksum/Drive-upload
 * verification, retention, and success-notification logic. No backup logic
 * is duplicated here; this file only adds bearer-token authentication
 * suitable for a non-browser caller and a safe, minimal JSON contract.
 *
 * Auth: `Authorization: Bearer <BACKUP_CRON_TOKEN>`. The token's primary,
 * documented home is the private akinal-private/akinal-backup/
 * backup-config.local.php file (see backup-config.local.example.php) — never
 * committed, never returned, logged, or sent to any frontend code.
 * hash_equals() is used for the comparison (constant-time, avoids a timing
 * side-channel). Missing token, wrong token, and "no token configured at
 * all" all produce the exact same generic 401 — never revealing which
 * condition applied. This endpoint intentionally requires NO browser session
 * (require_admin() is never called here) and sends NO CORS headers — it is
 * for direct server-to-server calls only, never a browser fetch().
 *
 * Every failure path — including ones before backup-lib.php has even
 * finished loading — still produces clean JSON, never a blank/HTML PHP
 * fatal-error page, via the same two-layer safety net backup-run-now.php
 * uses (shutdown-function fatal handler + bootstrap try/catch).
 *
 * Never returns credentials, private filesystem paths, Drive tokens, the
 * cron token itself, or raw exception text — only a generic message plus a
 * short machine-readable `code`.
 */

/**
 * Last-resort JSON emitter that assumes NOTHING beyond core PHP — no
 * response.php, no backup-lib.php — because it must still work even if those
 * failed to load. Deliberately sets no CORS header (server-to-server only)
 * and adds a few restrictive headers beyond the shared send_json_headers().
 */
function backup_cron_send_json(int $status, array $payload): void
{
    if (!headers_sent()) {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: DENY');
        header('Cache-Control: no-store');
        header('Referrer-Policy: no-referrer');
        // No Access-Control-Allow-Origin (or any other CORS header) is ever
        // sent from this file — cross-origin browser access is not a
        // supported use case for this endpoint.
    }
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// Installed first, before any require — protects against a truly
// uncatchable fatal (a broken/missing required file, memory exhaustion,
// etc.) anywhere below, including inside backup-lib.php's own require chain.
register_shutdown_function(static function (): void {
    $error = error_get_last();
    if ($error === null || !in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        return; // normal completion (including an already-sent JSON response) — nothing to do
    }
    backup_cron_send_json(500, ['success' => false, 'code' => 'bootstrap_error']);
});

// Method check first, before touching any backup/config code — a non-POST
// request never needs to reach the token check at all.
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    header('Allow: POST');
    backup_cron_send_json(405, ['success' => false, 'code' => 'method_not_allowed']);
}

try {
    require_once __DIR__ . '/backup-lib.php';
    backup_ensure_tables();
} catch (Throwable $exception) {
    backup_cron_send_json(500, ['success' => false, 'code' => 'bootstrap_error']);
}

// Token check — after backup-lib.php loads (needs backup_cron_token_source()
// and hash_equals()'s own timing-safety), but still before any backup work.
// A caller who presents nothing, presents the wrong value, or hits a server
// where the token was never configured all get the identical response.
$providedHeader = (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? '');
if ($providedHeader === '' && function_exists('apache_request_headers')) {
    // Some SAPIs/proxies don't populate $_SERVER['HTTP_AUTHORIZATION'] even
    // when the header was actually sent — read-only fallback, never part of
    // the authorization decision logic itself.
    $headers = @apache_request_headers();
    if (is_array($headers)) {
        foreach ($headers as $name => $value) {
            if (strcasecmp((string) $name, 'Authorization') === 0) {
                $providedHeader = (string) $value;
                break;
            }
        }
    }
}

$providedToken = null;
if (preg_match('/^Bearer\s+(.+)$/i', trim($providedHeader), $matches)) {
    $providedToken = $matches[1];
}

$configuredToken = backup_cron_token_source();
$authorized = $configuredToken !== null
    && $providedToken !== null
    && hash_equals($configuredToken, $providedToken);

if (!$authorized) {
    backup_log('Cron backup trigger rejected: missing or invalid bearer token.');
    backup_cron_send_json(401, ['success' => false, 'code' => 'unauthorized']);
}

// A full site+DB archive/upload can legitimately take longer than PHP's
// default execution limit; this endpoint is only ever reached with a valid
// private bearer token, not a public route.
@set_time_limit(0);
@ignore_user_abort(true);

$cronAdmin = ['email' => 'github-actions-cron'];

try {
    $result = backup_execute_full_run('daily_cron');
} catch (BackupAlreadyRunningException $exception) {
    // Another run (manual or scheduled) already holds the lock — this is a
    // safe, expected outcome, never a duplicate archive/email. Reported as a
    // 200 with success=false and an explicit status="locked" rather than an
    // error status, since nothing actually failed — but callers (including
    // the GitHub Actions workflow) MUST check `success`/`status`, not just
    // the HTTP status code, or this looks identical to a real completion.
    backup_log('Cron backup trigger found a run already in progress; not starting a second one.');
    backup_audit($cronAdmin, 'cron_run_rejected', 'already_running');
    backup_cron_send_json(200, [
        'success' => false,
        'code' => 'already_running',
        'status' => 'locked',
        'locked' => true,
    ]);
    exit;
} catch (BackupStageException $exception) {
    // backup_execute_full_run() already recorded the failure (ledger +
    // private log) with this same sanitized message and stage before
    // throwing — nothing further to sanitize here.
    backup_audit($cronAdmin, 'cron_run_failed', 'stage=' . $exception->getStage());
    backup_cron_send_json(500, [
        'success' => false,
        'code' => 'backup_failed',
        'stage' => $exception->getStage(),
    ]);
    exit;
} catch (Throwable $exception) {
    // Should not normally happen (backup_execute_full_run stages everything
    // inside its own try/catch), but stays safe either way rather than ever
    // letting a raw exception escape as an uncaught fatal.
    $safeMessage = backup_pure_sanitize_diagnostic_message($exception->getMessage());
    backup_log('Cron backup failed with an unstaged exception: class=' . get_class($exception) . ' message=' . $safeMessage);
    backup_audit($cronAdmin, 'cron_run_failed', 'stage=unknown');
    backup_cron_send_json(500, ['success' => false, 'code' => 'backup_failed', 'stage' => 'bootstrap']);
    exit;
}

backup_audit($cronAdmin, 'cron_run', json_encode([
    'package_name' => $result['package_name'],
    'status' => $result['status'],
]));

// Best-effort read of a couple of already-recorded ledger fields for a
// richer response — a plain SELECT against the row backup_execute_full_run()
// already wrote, never a duplicate/second backup operation.
$totalSize = null;
$notificationStatus = null;
try {
    $stmt = db()->prepare('SELECT total_size, notification_status FROM ak_backup_runs WHERE id = :id');
    $stmt->execute(['id' => $result['run_id']]);
    $row = $stmt->fetch();
    if (is_array($row)) {
        $totalSize = isset($row['total_size']) ? (int) $row['total_size'] : null;
        $notificationStatus = $row['notification_status'] ?? null;
    }
} catch (Throwable $exception) {
    // Non-fatal — the backup itself already succeeded and was already
    // recorded; a failure here only means this response has fewer fields.
}

backup_cron_send_json(200, [
    'success' => true,
    'package_name' => $result['package_name'],
    'completed_at' => $result['created_at'],
    'status' => $result['status'],
    'total_size' => $totalSize,
    'notification_status' => $notificationStatus,
]);
