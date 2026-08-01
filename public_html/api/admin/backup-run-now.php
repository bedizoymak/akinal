<?php
declare(strict_types=1);

/**
 * Admin-triggered "Şimdi Drive'a Yedekle" (Back Up Now) endpoint. Runs the
 * exact same backup_execute_full_run() used by the daily cron job — same
 * locking, Drive upload, verification, ledger recording, and retention logic,
 * nothing duplicated. Synchronous: the HTTP request stays open for the whole
 * run (archive + upload can take a while for a real site), so the browser
 * shows a single in-flight state until this responds with the final result.
 *
 * Every failure path — including ones that occur before backup-lib.php has
 * even finished loading — must still produce a clean JSON response, never a
 * blank/HTML PHP fatal-error page. Two layers make that true:
 *   1. A register_shutdown_function fatal-error safety net, installed before
 *      anything else runs, that catches truly uncatchable PHP fatals (a
 *      missing/broken require, out-of-memory, etc.) and still emits JSON.
 *   2. A try/catch around the whole bootstrap sequence (require, admin/method
 *      checks, table setup) PLUS the existing try/catch around the run itself,
 *      covering every catchable Throwable in between.
 *
 * Never returns credentials, private filesystem paths, Drive tokens, or raw
 * exception text — only a generic message plus a safe `stage` label.
 */

const BACKUP_RUN_NOW_GENERIC_MESSAGE = 'Yedekleme başlatılamadı ya da tamamlanamadı.';

/**
 * Last-resort JSON emitter that assumes NOTHING beyond core PHP — no
 * response.php, no backup-lib.php — because it must still work even if those
 * failed to load. Used by both the fatal-error shutdown handler and the
 * bootstrap catch block below.
 */
function backup_run_now_emit_fatal_json(string $stage): void
{
    if (headers_sent()) {
        return;
    }
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    echo json_encode([
        'success' => false,
        'message' => BACKUP_RUN_NOW_GENERIC_MESSAGE,
        'details' => ['ok' => false, 'stage' => $stage],
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

// Installed first, before any require — this is what protects against a
// truly uncatchable fatal (e.g. a broken/missing required file, a syntax
// error surfaced only at require-time, or memory exhaustion) anywhere below,
// including inside backup-lib.php's own require chain.
register_shutdown_function(static function (): void {
    $error = error_get_last();
    if ($error === null || !in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        return; // normal completion (including an already-sent JSON response) — nothing to do
    }
    backup_run_now_emit_fatal_json('bootstrap');
});

try {
    require_once __DIR__ . '/backup-lib.php';

    $admin = require_admin();
    require_method('POST');
    backup_ensure_tables();
} catch (Throwable $exception) {
    // Best-effort private logging: only possible if backup-lib.php loaded far
    // enough to define these helpers. Guarded so a bootstrap failure can never
    // itself cause a second, unhandled error.
    if (function_exists('backup_log')) {
        $safeMessage = function_exists('backup_pure_sanitize_diagnostic_message')
            ? backup_pure_sanitize_diagnostic_message($exception->getMessage())
            : '[sanitizer unavailable]';
        backup_log('Manual backup bootstrap failed: class=' . get_class($exception) . ' message=' . $safeMessage);
    }
    backup_run_now_emit_fatal_json('bootstrap');
    exit;
}

// A full site+DB archive/upload can legitimately take longer than PHP's
// default execution limit on some hosts; this endpoint is only ever reached
// by an authenticated admin explicitly clicking the button, not a public route.
@set_time_limit(0);
@ignore_user_abort(true);

try {
    $result = backup_execute_full_run('manual_admin');
} catch (BackupAlreadyRunningException $exception) {
    backup_audit($admin, 'manual_run_now_rejected', 'already_running');
    json_error('Bir yedekleme işlemi zaten devam ediyor. Lütfen tamamlanmasını bekleyin.', 409, ['ok' => false, 'stage' => 'lock']);
} catch (BackupStageException $exception) {
    // backup_execute_full_run() already recorded the failure (ledger + private
    // log) with this same sanitized message and stage before throwing.
    backup_audit($admin, 'manual_run_now_failed', 'stage=' . $exception->getStage());
    json_error(BACKUP_RUN_NOW_GENERIC_MESSAGE, 500, ['ok' => false, 'stage' => $exception->getStage()]);
} catch (Throwable $exception) {
    // Should not normally happen (backup_execute_full_run stages everything
    // inside its own try/catch), but stays safe either way rather than ever
    // letting a raw exception escape as an uncaught fatal.
    $safeMessage = backup_pure_sanitize_diagnostic_message($exception->getMessage());
    backup_log('Manual backup failed with an unstaged exception: class=' . get_class($exception) . ' message=' . $safeMessage);
    backup_audit($admin, 'manual_run_now_failed', 'stage=unknown');
    json_error(BACKUP_RUN_NOW_GENERIC_MESSAGE, 500, ['ok' => false, 'stage' => 'bootstrap']);
}

backup_audit($admin, 'manual_run_now', json_encode([
    'package_name' => $result['package_name'],
    'status' => $result['status'],
]));

json_success([
    'run_id' => $result['run_id'],
    'status' => $result['status'],
    'package_name' => $result['package_name'],
    'created_at' => $result['created_at'],
]);
