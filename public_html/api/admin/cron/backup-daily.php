<?php
declare(strict_types=1);

/**
 * Daily automated recovery-package backup — the single CLI entry point for the
 * scheduled Google Drive backup. Intended to be invoked ONLY by a cPanel Cron
 * Job running PHP CLI (see docs/BACKUP_CENTER_SETUP.md for the exact schedule
 * and command). Guarded against web access below — this file must never be
 * reachable over HTTP, and the sibling .htaccess in this folder denies it
 * defense-in-depth as well.
 *
 * This is a thin wrapper only: all package creation, Drive upload,
 * verification, ledger recording, and retention logic lives in the shared
 * backup_execute_full_run() (backup-lib.php) — the exact same function the
 * admin "Şimdi Drive'a Yedekle" button calls (backup-run-now.php). Nothing is
 * duplicated between the two trigger paths.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('Forbidden.');
}

define('AK_API_INTERNAL', true);
require_once __DIR__ . '/../../db.php';
require_once __DIR__ . '/../backup-lib.php';

try {
    $result = backup_execute_full_run('daily_auto');
    backup_log('Daily backup finished with status=' . $result['status'] . ': ' . $result['package_name']);
    exit(0);
} catch (BackupAlreadyRunningException $exception) {
    backup_log('Daily backup skipped: ' . $exception->getMessage());
    exit(0);
} catch (Throwable $exception) {
    fwrite(STDERR, $exception->getMessage() . "\n");
    exit(1);
}
