<?php
declare(strict_types=1);

require_once __DIR__ . '/backup-lib.php';

$admin = require_admin();
require_method('GET');
backup_ensure_tables();

$capabilities = backup_capabilities();

// "Tam Kurtarma Yedeği" (last_full_success) requires status = 'success' exactly —
// success_with_warnings is always a partial/PDO-fallback run and is reported
// separately so the two are never conflated in the UI.
$lastFullSuccess = db()->query("SELECT * FROM ak_backup_runs WHERE run_type = 'daily_auto' AND status = 'success' ORDER BY started_at DESC LIMIT 1")->fetch();
$lastPartial = db()->query("SELECT * FROM ak_backup_runs WHERE run_type = 'daily_auto' AND status = 'success_with_warnings' ORDER BY started_at DESC LIMIT 1")->fetch();
$lastFailure = db()->query("SELECT * FROM ak_backup_runs WHERE run_type = 'daily_auto' AND status = 'failed' ORDER BY started_at DESC LIMIT 1")->fetch();

// Schedule status: the cron expression/label are always "configured in code"
// (this script and its docs exist unconditionally), but that must never be
// presented as proof the cron job actually exists on the server — only a real
// recorded daily_auto run within the last 48h counts as "confirmed".
$lastDailyRunAny = db()->query("SELECT started_at FROM ak_backup_runs WHERE run_type = 'daily_auto' ORDER BY started_at DESC LIMIT 1")->fetch();
$lastDailyRunAt = $lastDailyRunAny['started_at'] ?? null;
$schedule = [
    'configured_in_code' => true,
    'expression' => BACKUP_DAILY_SCHEDULE_EXPRESSION,
    'label' => BACKUP_DAILY_SCHEDULE_LABEL,
    'confirmed_by_recent_run' => backup_pure_schedule_confirmed($lastDailyRunAt, time()),
    'last_run_at' => $lastDailyRunAt,
];

$historyStmt = db()->query('SELECT * FROM ak_backup_runs ORDER BY started_at DESC LIMIT 5');
$history = $historyStmt->fetchAll();

$auditStmt = db()->query('SELECT * FROM ak_backup_audit_log ORDER BY created_at DESC LIMIT 5');
$audit = $auditStmt->fetchAll();

// Safe (path-free, exception-detail-free) five-state diagnostic: not_configured,
// credentials_problem, auth_failed, folder_inaccessible, connected. Drive listing
// below is only ever attempted once this confirms a working connection.
$driveDiagnostics = backup_drive_diagnose();

$driveFolders = [];
$driveError = null;
if ($driveDiagnostics['state'] === 'connected') {
    try {
        $folders = backup_filter_system_folders(gdrive_list_children(backup_drive_config()['folder_id'], 'application/vnd.google-apps.folder'));
        foreach ($folders as $folder) {
            $driveFolders[] = gdrive_classify_backup_folder($folder);
        }
        usort($driveFolders, fn($a, $b) => strcmp((string) $b['created_at'], (string) $a['created_at']));
    } catch (Throwable $exception) {
        // Never surface raw exception detail (it may include Drive response bodies) to the UI.
        $driveError = 'Drive klasör listesi alınamadı.';
    }
} elseif ($driveDiagnostics['state'] !== 'not_configured') {
    $driveError = $driveDiagnostics['message'];
}

json_success([
    'capabilities' => $capabilities,
    // Full disaster-recovery backups require mysqldump; without it every run is
    // structurally a partial/PDO-fallback export, no matter how well it goes.
    'full_recovery_available' => $capabilities['mysqldump_available'],
    'drive_diagnostics' => $driveDiagnostics,
    'schedule' => $schedule,
    'retention_limit' => backup_retention_count(),
    // This dashboard metric counts successfully uploaded packages still visible in Drive.
    // Keep the manifest classification intact: partial packages remain partial, while
    // incomplete/unknown folders are not counted. Retention deletion stays complete-only.
    // Computed from the FULL classified list — never from the truncated display slice
    // below — so this count always reflects true retained-package state.
    'retained_count' => count(array_filter($driveFolders, fn($f) => in_array($f['status'], ['complete', 'partial'], true))),
    'last_full_success' => $lastFullSuccess ?: null,
    'last_partial' => $lastPartial ?: null,
    'last_failure' => $lastFailure ?: null,
    'history' => $history,
    'audit_log' => $audit,
    // Display-only slice (newest-first, already sorted above) — Drive listing,
    // retention, and package contents are entirely unaffected by this limit.
    'drive_backups' => array_slice($driveFolders, 0, 5),
    'drive_error' => $driveError,
]);
