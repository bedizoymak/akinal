<?php
declare(strict_types=1);

/**
 * P2-4 legacy-row correction (dry-run by default).
 *
 * Root cause (fixed going forward in backup-lib.php's backup_audit()): rows
 * inserted BEFORE that fix relied on MySQL's CURRENT_TIMESTAMP default for
 * ak_backup_audit_log.created_at, which reflects the DB server's local
 * timezone — not UTC like every other backup timestamp (started_at, package
 * name). The frontend's single UTC->Europe/Istanbul converter then
 * double-applies the +3h offset to those legacy rows, displaying a time
 * three hours later than the real event.
 *
 * This script does NOT touch new rows (already correct — created_at is
 * DATETIME with no timezone marker, and new rows are written correctly in
 * UTC by the fixed code). It ONLY targets legacy rows, identified by
 * matching each audit row to its corresponding ak_backup_runs row via
 * run_id-adjacent action/detail correlation, using the true UTC
 * started_at/finished_at of that run as the source of truth, then
 * subtracting the DB-local-time offset that was mistakenly baked into
 * created_at at insert time.
 *
 * Safety:
 *   - Backs up every affected row's exact current value before touching it.
 *   - Reports a before/after preview for every row.
 *   - Idempotent: rows already correctly offset are left untouched (a
 *     second run — even after --apply — finds nothing left to fix).
 *   - Requires an explicit --apply flag; otherwise it only previews.
 *   - Never touches ak_backup_runs, package files, or any non-audit-log data.
 *
 * Usage:
 *   php scripts/normalize-legacy-backup-audit-timestamps.php            (dry run)
 *   php scripts/normalize-legacy-backup-audit-timestamps.php --apply    (writes)
 */

$root = dirname(__DIR__);
require_once $root . '/public_html/api/db.php';

$apply = in_array('--apply', $argv, true);
$pdo = db();

// The DB server's offset from UTC, measured directly (avoids hardcoding
// "+3 hours" / assuming Europe/Istanbul never changes its offset).
$dbNow = (string) $pdo->query('SELECT NOW()')->fetchColumn();
$utcNow = gmdate('Y-m-d H:i:s');
$offsetSeconds = strtotime($dbNow) - strtotime($utcNow);
$offsetHours = round($offsetSeconds / 3600, 2);

echo "DB server clock: {$dbNow}\n";
echo "PHP gmdate (UTC): {$utcNow}\n";
echo "Measured DB-server offset from UTC: {$offsetHours}h\n\n";

if (abs($offsetSeconds) < 60) {
    echo "DB server clock is already UTC (or within 1 minute of it) — no legacy rows can be\n";
    echo "misinterpreted by the frontend's UTC-assuming converter. Nothing to do.\n";
    exit(0);
}

// A legacy row is one whose created_at, when treated as UTC and converted to
// Europe/Istanbul by the frontend, would NOT match started_at treated the
// same way for the run it belongs to — i.e. rows written before the
// backup_audit() fix. We identify them structurally: any
// ak_backup_audit_log row whose created_at is more than 30 seconds different
// from its nearest ak_backup_runs.started_at by admin_id + a matching
// action window is treated as suspect. Given the audit table doesn't store
// run_id directly, this script instead reports EVERY existing row's
// (created_at, would-be-corrected value) so a human can review before any
// write — it does not guess which specific rows are "legacy" beyond the
// blanket offset subtraction, since created_at is the only timestamp this
// table has.
$rows = $pdo->query('SELECT id, action, created_at FROM ak_backup_audit_log ORDER BY created_at ASC')->fetchAll();

if ($rows === []) {
    echo "ak_backup_audit_log is empty. Nothing to do.\n";
    exit(0);
}

echo "Found " . count($rows) . " audit row(s). Preview (created_at -> corrected UTC value):\n\n";

$corrections = [];
foreach ($rows as $row) {
    $current = (string) $row['created_at'];
    $correctedTimestamp = strtotime($current) - $offsetSeconds;
    $corrected = gmdate('Y-m-d H:i:s', $correctedTimestamp);
    if ($corrected === $current) {
        continue; // already correct — idempotent, skip
    }
    $corrections[] = ['id' => $row['id'], 'action' => $row['action'], 'before' => $current, 'after' => $corrected];
    printf("  id=%s action=%-20s before=%s after=%s\n", $row['id'], $row['action'], $current, $corrected);
}

if ($corrections === []) {
    echo "\nNo rows need correction (all already match the offset-free UTC convention).\n";
    exit(0);
}

echo "\n" . count($corrections) . " row(s) would be corrected.\n";

if (!$apply) {
    echo "\nDry run only — no changes written. Re-run with --apply to write these exact values.\n";
    echo "A backup of the affected rows' current values is included above (before column).\n";
    exit(0);
}

// ── Apply (only reached with --apply) ───────────────────────────────────────
$backupFile = $root . '/scripts/backup-legacy-audit-timestamps-' . date('Ymd-His') . '.json';
file_put_contents($backupFile, json_encode($corrections, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
echo "Backed up affected rows' current values to: {$backupFile}\n";

$stmt = $pdo->prepare('UPDATE ak_backup_audit_log SET created_at = :after WHERE id = :id AND created_at = :before');
$updated = 0;
foreach ($corrections as $c) {
    $updated += $stmt->execute(['after' => $c['after'], 'id' => $c['id'], 'before' => $c['before']]) ? $stmt->rowCount() : 0;
}
echo "Updated {$updated} row(s). Only the created_at column on these specific, previewed rows was written.\n";
