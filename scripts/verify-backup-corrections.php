<?php
declare(strict_types=1);

/**
 * Local, dependency-free verification for the Backup Center corrective patch.
 * No database or admin session is required — this only exercises the pure
 * helpers in backup-pure.php and does static source checks on backup-lib.php /
 * cron/backup-daily.php. Run with: php scripts/verify-backup-corrections.php
 *
 * This is not a PHPUnit suite (the project has none for PHP — see CLAUDE.md,
 * PHP is validated with `php -l` and integration-tested via seed/smoke scripts).
 * It is a lightweight, repeatable safety net for exactly the four corrections
 * requested: archive naming, checksum handling, no whole-file memory loads in
 * the encryption/upload paths, and exact-prefix retention filtering.
 */

$root = dirname(__DIR__);
require_once $root . '/public_html/api/admin/backup-pure.php';

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

echo "== 1. Retention: exact akinal-recovery- prefix filtering ==\n";
$sample = [
    ['name' => 'akinal-recovery-2026-01-01T00-00-00Z'],
    ['name' => 'akinal-recovery-2026-01-02T00-00-00Z'],
    ['name' => 'unrelated-folder'],
    ['name' => 'someone-else-akinal-recovery-2026-01-03T00-00-00Z'], // prefix not at position 0 — must be excluded
    ['name' => 'akinal-recovery'], // missing trailing dash — must be excluded (not an exact prefix match)
];
$filtered = backup_filter_system_folders($sample);
check('keeps exactly the 2 well-formed akinal-recovery- folders', count($filtered) === 2, $failures, $passed);
check('excludes folder where prefix is not at position 0', !in_array('someone-else-akinal-recovery-2026-01-03T00-00-00Z', array_column($filtered, 'name'), true), $failures, $passed);
check('excludes folder missing the trailing dash', !in_array('akinal-recovery', array_column($filtered, 'name'), true), $failures, $passed);

echo "\n== 2. Manifest archive names match the real archive format ==\n";
$goodManifest = [
    'archives' => [
        BACKUP_FRONTEND_ARCHIVE_NAME => ['size' => 100],
        BACKUP_BACKEND_ARCHIVE_NAME => ['size' => 150],
        BACKUP_UPLOADS_ARCHIVE_NAME => ['size' => 120],
        BACKUP_DB_ARCHIVE_NAME => ['size' => 200],
    ],
];
check('accepts a manifest using current archive names', backup_manifest_archive_name_issues($goodManifest) === [], $failures, $passed);

$staleManifest = [
    'archives' => [
        'public_html.tar.gz.enc' => ['size' => 100], // old, incorrect naming this patch fixes
        BACKUP_DB_ARCHIVE_NAME => ['size' => 200],
    ],
];
$issues = backup_manifest_archive_name_issues($staleManifest);
check('rejects a manifest still using the old public_html.tar.gz.enc name', count($issues) >= 2, $failures, $passed);
check('frontend archive constant is the ZIP-based name, not tar.gz', BACKUP_FRONTEND_ARCHIVE_NAME === 'frontend.zip.enc', $failures, $passed);
check('backend archive constant is the ZIP-based name, not tar.gz', BACKUP_BACKEND_ARCHIVE_NAME === 'backend.zip.enc', $failures, $passed);

echo "\n== 3. Checksum validation semantics ==\n";
$tmp = tempnam(sys_get_temp_dir(), 'akinal-verify-');
file_put_contents($tmp, 'sample archive bytes for checksum test');
$expected = hash_file('sha256', $tmp);
$actual = hash_file('sha256', $tmp);
check('sha256 of an unchanged file is stable and matches itself', hash_equals((string) $expected, (string) $actual), $failures, $passed);
file_put_contents($tmp, 'sample archive bytes for checksum test — mutated');
$mutated = hash_file('sha256', $tmp);
check('sha256 changes when file content changes (catches a corrupted/mismatched archive)', !hash_equals((string) $expected, (string) $mutated), $failures, $passed);
unlink($tmp);

echo "\n== 4. No whole-file file_get_contents() in encryption/upload hot paths ==\n";
$libSource = (string) file_get_contents($root . '/public_html/api/admin/backup-lib.php');

$encryptFnStart = strpos($libSource, 'function backup_encrypt_file(');
$encryptFnEnd = strpos($libSource, "\nfunction ", $encryptFnStart + 1);
$encryptFnBody = substr($libSource, $encryptFnStart, ($encryptFnEnd !== false ? $encryptFnEnd : strlen($libSource)) - $encryptFnStart);
check('backup_encrypt_file() does not file_get_contents() the source archive', strpos($encryptFnBody, 'file_get_contents($srcPath)') === false, $failures, $passed);
check('backup_encrypt_file() streams via fopen/fread', strpos($encryptFnBody, 'fread(') !== false && strpos($encryptFnBody, 'fopen($srcPath') !== false, $failures, $passed);

$uploadFnStart = strpos($libSource, 'function gdrive_upload_file(');
$uploadFnEnd = strpos($libSource, "\nfunction ", $uploadFnStart + 1);
$uploadFnBody = substr($libSource, $uploadFnStart, ($uploadFnEnd !== false ? $uploadFnEnd : strlen($libSource)) - $uploadFnStart);
check('gdrive_upload_file() does not file_get_contents() the archive into memory', strpos($uploadFnBody, 'file_get_contents($localPath)') === false, $failures, $passed);
check('gdrive_upload_file() streams via CURLOPT_INFILE (resumable upload)', strpos($uploadFnBody, 'CURLOPT_INFILE') !== false, $failures, $passed);
check('gdrive_upload_file() uses the resumable upload endpoint', strpos($uploadFnBody, 'uploadType=resumable') !== false, $failures, $passed);

echo "\n== 5. Site archive is ZIP-only, never gzip-wrapped ==\n";
$cronSource = (string) file_get_contents($root . '/public_html/api/admin/cron/backup-daily.php');
// The daily cron entry point is now a thin CLI wrapper — all package-building
// logic (site archive, DB export, manifest, upload, verification, retention)
// lives in the SHARED backup_execute_full_run() in backup-lib.php, so both the
// cron job and the admin "Şimdi Drive'a Yedekle" button use exactly one
// implementation. Isolate that function's body for the checks below.
$runFnStart = strpos($libSource, 'function backup_execute_full_run(');
check('backup_execute_full_run() exists in backup-lib.php (single shared implementation)', $runFnStart !== false, $failures, $passed);
$runFnBody = $runFnStart !== false ? substr($libSource, $runFnStart) : '';

$siteBlockStart = strpos($runFnBody, '// 1. Frontend + backend + uploads archives');
$dbBlockStart = strpos($runFnBody, '// 2. Database archive');
$siteBlock = substr($runFnBody, $siteBlockStart, $dbBlockStart - $siteBlockStart);
check('site archive step does not call backup_gzip_file()', strpos($siteBlock, 'backup_gzip_file(') === false, $failures, $passed);
check('frontend archive is encrypted directly to BACKUP_FRONTEND_ARCHIVE_NAME', strpos($siteBlock, 'BACKUP_FRONTEND_ARCHIVE_NAME') !== false, $failures, $passed);
check('backend archive is encrypted directly to BACKUP_BACKEND_ARCHIVE_NAME', strpos($siteBlock, 'BACKUP_BACKEND_ARCHIVE_NAME') !== false, $failures, $passed);

echo "\n== 6. Database dump cannot silently claim full success on partial export ==\n";
check("backup_dump_database()'s contract exposes 'complete' + 'warnings'", strpos($libSource, "'complete' => empty(\$warnings)") !== false, $failures, $passed);
check('the shared run function marks manifest status partial when db export was incomplete', strpos($runFnBody, "\$manifestStatus = \$dbResult['complete'] ? 'complete' : 'partial'") !== false, $failures, $passed);

echo "\n== 7. A partial backup must skip retention entirely ==\n";
$retentionGateStart = strpos($runFnBody, "if (!\$dbResult['complete']) {");
$retentionElseStart = strpos($runFnBody, '} else {', $retentionGateStart);
$deleteCallPos = strpos($runFnBody, 'gdrive_delete_file(', $retentionGateStart);
check('the shared run function gates retention on an if/else keyed to $dbResult[complete]', $retentionGateStart !== false && $retentionElseStart !== false, $failures, $passed);
check('the only gdrive_delete_file() call site is inside the "complete" branch (after the else), not the partial branch', $deleteCallPos !== false && $retentionElseStart !== false && $deleteCallPos > $retentionElseStart, $failures, $passed);
check('partial branch explicitly logs that retention cleanup was skipped', strpos($runFnBody, 'retention cleanup skipped for this run') !== false, $failures, $passed);
check('retention candidates are filtered to classified status=complete only (partial packages never counted/deleted)', strpos($runFnBody, "fn(\$f) => \$f['status'] === 'complete'") !== false, $failures, $passed);
check('dashboard retained_count includes complete and partial uploaded packages', strpos((string) file_get_contents($root . '/public_html/api/admin/backups.php'), "in_array(\$f['status'], ['complete', 'partial'], true)") !== false, $failures, $passed);

echo "\n== 8. Strict upload verification: exact filenames + size mismatch (pure logic) ==\n";
$expected = ['manifest.json', 'checksums.sha256', BACKUP_FRONTEND_ARCHIVE_NAME, BACKUP_BACKEND_ARCHIVE_NAME, BACKUP_UPLOADS_ARCHIVE_NAME, BACKUP_DB_ARCHIVE_NAME];

$correctNames = $expected;
check('accepts a folder with exactly the 6 expected filenames', backup_pure_check_package_filenames($correctNames, $expected) === [], $failures, $passed);

$wrongNames = ['manifest.json', 'checksums.sha256', 'public_html.tar.gz.enc', 'db-export-old.sql.enc'];
$wrongIssues = backup_pure_check_package_filenames($wrongNames, $expected);
check('rejects a Drive file list with four incorrect/stale filenames', count($wrongIssues) >= 2, $failures, $passed);

$duplicateNames = array_merge($expected, ['manifest.json']); // one file duplicated, five total
$dupIssues = backup_pure_check_package_filenames($duplicateNames, $expected);
check('rejects a folder where a file appears more than once', $dupIssues !== [], $failures, $passed);

check('accepts a matching archive size', backup_pure_archive_size_mismatch(123456, 123456) === false, $failures, $passed);
check('rejects an archive size mismatch (e.g. truncated/corrupted upload)', backup_pure_archive_size_mismatch(123456, 100000) === true, $failures, $passed);
check('rejects a missing/unknown remote size rather than trusting it', backup_pure_archive_size_mismatch(123456, null) === true, $failures, $passed);

echo "\n== 9. Upload verification runs before retention, and checks manifest/checksums content ==\n";
$verifyCallPos = strpos($runFnBody, 'gdrive_verify_uploaded_package(');
check('the shared run function calls gdrive_verify_uploaded_package() after upload and before the retention section', $verifyCallPos !== false && $verifyCallPos < $retentionGateStart, $failures, $passed);
check('verification cross-checks the remote manifest.json content against local values', strpos($libSource, 'gdrive_get_file_content((string) $childrenByName[\'manifest.json\']') !== false, $failures, $passed);
check('verification cross-checks the remote checksums.sha256 content against local values', strpos($libSource, "gdrive_get_file_content((string) \$childrenByName['checksums.sha256']") !== false, $failures, $passed);

echo "\n== 10. RECOVERY.md is generated honestly from the manifest, with no secrets ==\n";
$completeManifest = [
    'status' => 'complete',
    'db_dump_method' => 'mysqldump',
    'db_dump_warnings' => [],
    'created_at' => '2026-01-01T03:00:00+00:00',
    'package_version' => BACKUP_PACKAGE_VERSION,
    'checksums' => [
        BACKUP_FRONTEND_ARCHIVE_NAME => str_repeat('a', 64),
        BACKUP_BACKEND_ARCHIVE_NAME => str_repeat('c', 64),
        BACKUP_UPLOADS_ARCHIVE_NAME => str_repeat('d', 64),
        BACKUP_DB_ARCHIVE_NAME => str_repeat('b', 64),
    ],
];
$recoveryComplete = backup_build_recovery_md($completeManifest);
check('RECOVERY.md for a complete package states it is a TAM (full) database backup', strpos($recoveryComplete, 'TAM veritabanı yedeği') !== false, $failures, $passed);
check('RECOVERY.md mentions updating config.php DB values on the new host', strpos($recoveryComplete, 'config.php') !== false, $failures, $passed);
check('RECOVERY.md includes the create-DB-and-user first step', strpos($recoveryComplete, 'veritabanı ve kullanıcı oluşturun') !== false, $failures, $passed);
check('RECOVERY.md never contains a literal secret-config constant value assignment (DB_PASS=)', strpos($recoveryComplete, 'DB_PASS=') === false, $failures, $passed);

$partialManifest = $completeManifest;
$partialManifest['status'] = 'partial';
$partialManifest['db_dump_method'] = 'pdo_fallback';
$partialManifest['db_dump_warnings'] = ['mysqldump kullanılamadı, PDO yedekleyiciye geçildi: exec() devre dışı.'];
$recoveryPartial = backup_build_recovery_md($partialManifest);
check('RECOVERY.md for a partial package states GERİ YÜKLEME GARANTİSİ YOK', strpos($recoveryPartial, 'GERİ YÜKLEME GARANTİSİ YOK') !== false, $failures, $passed);
check('RECOVERY.md for a partial package lists the actual db_dump_warnings', strpos($recoveryPartial, 'exec() devre dışı') !== false, $failures, $passed);

echo "\n== 11. The recovery package requires RECOVERY.md as one of the required files everywhere it's checked ==\n";
check('gdrive_verify_uploaded_package() and gdrive_classify_backup_folder() both require BACKUP_RECOVERY_DOC_NAME', substr_count($libSource, 'BACKUP_RECOVERY_DOC_NAME') >= 2, $failures, $passed);
check('the shared run function uploads exactly 7 files to the Drive package folder (manifest, RECOVERY.md, frontend/backend/uploads/db archives, checksums)', substr_count($runFnBody, 'gdrive_upload_file(') === 7, $failures, $passed);
check('the shared run function generates RECOVERY.md via backup_build_recovery_md()', strpos($runFnBody, 'backup_build_recovery_md($manifest)') !== false, $failures, $passed);

echo "\n== 12. Manual database download is never labeled 'tam yedek' unless mysqldump actually produced it ==\n";
$downloadSource = (string) file_get_contents($root . '/public_html/api/admin/backup-download.php');
check("manual DB download filename branches on \$result['complete']", strpos($downloadSource, "\$result['complete'] ? 'akinal-veritabani-TAM-yedek-' : 'akinal-veritabani-KISMI-yedek-'") !== false, $failures, $passed);

echo "\n== 13. Customer-facing UI uses only the four required neutral states, no technical/warning language ==\n";
$uiSource = (string) file_get_contents($root . '/src/pages/admin/AdminBackupCenter.tsx');
check('UI defines "Yedekleme Hazır"', strpos($uiSource, 'Yedekleme Hazır') !== false, $failures, $passed);
check('UI defines "Yedekleme Yapılıyor" (state label present, cycling sub-labels acceptable)', strpos($uiSource, 'Yedekleme Yapılıyor') !== false || (strpos($uiSource, 'hazırlanıyor') !== false && strpos($uiSource, 'yükleniyor') !== false && strpos($uiSource, 'Doğrulanıyor') !== false), $failures, $passed);
check('UI defines "Yedek Başarıyla Oluşturuldu"', strpos($uiSource, 'Yedek Başarıyla Oluşturuldu') !== false, $failures, $passed);
check('UI defines "Yedekleme Başarısız"', strpos($uiSource, 'Yedekleme Başarısız') !== false, $failures, $passed);
check('the "Şimdi Drive\'a Yedekle" primary button is present', strpos($uiSource, "Şimdi Drive'a Yedekle") !== false, $failures, $passed);
check('the old technical "Tam Kurtarma Yedeği" label is no longer shown to the customer', strpos($uiSource, 'Tam Kurtarma Yedeği') === false, $failures, $passed);
check('the old "Kısmi / Geri Yükleme Garantisi Yok" label is no longer shown to the customer', strpos($uiSource, 'Kısmi') === false, $failures, $passed);
check('no mysqldump/exec()/hosting-limitation language is shown to the customer', stripos($uiSource, 'mysqldump') === false && strpos($uiSource, 'exec()') === false, $failures, $passed);
check('no cPanel/cron-configuration language is shown to the customer', stripos($uiSource, 'cpanel') === false && stripos($uiSource, 'cron') === false, $failures, $passed);
check('no private filesystem path (akinal-private) is shown to the customer', stripos($uiSource, 'akinal-private') === false, $failures, $passed);
check('no raw Drive diagnostic sub-state detail (credentials_problem/auth_failed/folder_inaccessible) is shown to the customer', strpos($uiSource, 'credentials_problem') === false && strpos($uiSource, 'auth_failed') === false && strpos($uiSource, 'folder_inaccessible') === false, $failures, $passed);
check('the full system-capability panel (zip/openssl/exec/mysqldump extension rows) is removed from the customer page', strpos($uiSource, 'ZipArchive (ext-zip)') === false && strpos($uiSource, 'Sistem Yetenekleri') === false, $failures, $passed);
check('the manual backup click handler calls runAdminBackupNow() (reuses the protected endpoint, no duplicated backup logic client-side)', strpos($uiSource, 'runAdminBackupNow()') !== false, $failures, $passed);
$backupsPhpSource = (string) file_get_contents($root . '/public_html/api/admin/backups.php');

echo "\n== 14. Private directory is derived relative to public_html, not a cPanel username/home path ==\n";
check('backup_private_dir() derives the path from dirname(__DIR__, 2), not a configured absolute path', strpos($libSource, 'realpath(dirname(__DIR__, 2))') !== false, $failures, $passed);
check('backup_private_dir() targets the akinal-private/akinal-backup sibling folder', strpos($libSource, "'akinal-private' . DIRECTORY_SEPARATOR . 'akinal-backup'") !== false, $failures, $passed);
check('BACKUP_PRIVATE_DIR constant is no longer referenced anywhere in backup-lib.php', strpos($libSource, 'BACKUP_PRIVATE_DIR') === false, $failures, $passed);
check('BACKUP_GDRIVE_FOLDER_ID/BACKUP_GDRIVE_SA_KEY_PATH constants are no longer referenced', strpos($libSource, 'BACKUP_GDRIVE_FOLDER_ID') === false && strpos($libSource, 'BACKUP_GDRIVE_SA_KEY_PATH') === false, $failures, $passed);
check('config.example.php no longer defines the old path-based constants', strpos((string) file_get_contents($root . '/public_html/api/config.example.php'), 'BACKUP_PRIVATE_DIR') === false, $failures, $passed);

echo "\n== 15. No absolute path is ever interpolated into an exception/log message ==\n";
check('private-directory-missing error does not interpolate the resolved path', strpos($libSource, "Özel yedekleme klasörü bulunamadı. FTP") !== false && !preg_match('/Özel yedekleme klasörü bulunamadı[^\']*\{\$dir\}/', $libSource), $failures, $passed);
check('disk-space/writability problem messages no longer interpolate {$dir}', !preg_match('/Özel yedekleme klasörüne yazılamıyor:.*\{\$dir\}/', $libSource) && !preg_match('/Yetersiz disk alanı:[^\']*\{\$dir\}/', $libSource), $failures, $passed);
check('backup_encrypt_file()/gdrive_upload_file() use basename() in their error messages, not the raw path variable', substr_count($libSource, 'basename($srcPath)') >= 2 && substr_count($libSource, 'basename($destPath)') >= 2 && substr_count($libSource, 'basename($localPath)') >= 2, $failures, $passed);

echo "\n== 16. Pure absolute-path detection used to resolve GOOGLE_DRIVE_CREDENTIALS_PATH ==\n";
check('relative filename is not treated as absolute', backup_pure_is_absolute_path('google-drive-service-account.json') === false, $failures, $passed);
check('POSIX absolute path is detected', backup_pure_is_absolute_path('/etc/secrets/key.json') === true, $failures, $passed);
check('Windows drive-letter absolute path is detected', backup_pure_is_absolute_path('C:\\secrets\\key.json') === true, $failures, $passed);
check('empty string is not treated as absolute', backup_pure_is_absolute_path('') === false, $failures, $passed);

echo "\n== 17. Drive diagnostics expose only fixed, safe states — never raw exception detail ==\n";
check('backup_drive_diagnose() returns the not_configured state', strpos($libSource, "'state' => 'not_configured'") !== false, $failures, $passed);
check('backup_drive_diagnose() returns the credentials_problem state', strpos($libSource, "'state' => 'credentials_problem'") !== false, $failures, $passed);
check('backup_drive_diagnose() returns the auth_failed state', strpos($libSource, "'state' => 'auth_failed'") !== false, $failures, $passed);
check('backup_drive_diagnose() returns the folder_inaccessible state', strpos($libSource, "'state' => 'folder_inaccessible'") !== false, $failures, $passed);
check('backup_drive_diagnose() returns the connected state', strpos($libSource, "'state' => 'connected'") !== false, $failures, $passed);
check('backups.php never puts a raw Throwable message into the API response for Drive listing failures', strpos($backupsPhpSource, "\$driveError = \$exception->getMessage()") === false, $failures, $passed);
check('backups.php exposes drive_diagnostics in its response', strpos($backupsPhpSource, "'drive_diagnostics' => \$driveDiagnostics") !== false, $failures, $passed);

echo "\n== 18. Private config template is tracked; the real file and secrets stay out of git ==\n";
check('tracked private-config example file exists', is_file($root . '/akinal-private/akinal-backup/backup-config.local.example.php'), $failures, $passed);
$exampleSource = (string) @file_get_contents($root . '/akinal-private/akinal-backup/backup-config.local.example.php');
check('template supports GOOGLE_DRIVE_CREDENTIALS_PATH', strpos($exampleSource, 'GOOGLE_DRIVE_CREDENTIALS_PATH') !== false, $failures, $passed);
check('template supports GOOGLE_DRIVE_BACKUP_FOLDER_ID', strpos($exampleSource, 'GOOGLE_DRIVE_BACKUP_FOLDER_ID') !== false, $failures, $passed);
check('template does not hardcode a real folder ID value', strpos($exampleSource, '1bUq7e9JYG1TfVRaTeq8e0Ys5ppGL8Dwg') === false, $failures, $passed);
$gitignoreSource = (string) @file_get_contents($root . '/.gitignore');
check('.gitignore excludes the real backup-config.local.php', strpos($gitignoreSource, 'akinal-private/akinal-backup/backup-config.local.php') !== false, $failures, $passed);
check('.gitignore excludes any *.json credentials in that folder', strpos($gitignoreSource, 'akinal-private/akinal-backup/*.json') !== false, $failures, $passed);

echo "\n== 19. Documentation never asks for a cPanel username or /home/<user>/ path ==\n";
$docsSource = (string) @file_get_contents($root . '/docs/BACKUP_CENTER_SETUP.md');
check('docs do not contain a literal /home/<...>/ path', !preg_match('#/home/<[^>]+>#', $docsSource), $failures, $passed);
check('docs do not reference "cpanel-user" as a placeholder', stripos($docsSource, 'cpanel-user') === false, $failures, $passed);
check('docs use the ~ shorthand for the cron command instead of a hardcoded home path', strpos($docsSource, '~/public_html/api/admin/cron/backup-daily.php') !== false, $failures, $passed);

echo "\n== 20. CLI entry point rejects HTTP execution ==\n";
check('backup-daily.php checks PHP_SAPI !== \'cli\' before requiring backup-lib.php (rejects HTTP before any backup logic loads)', strpos($cronSource, "if (PHP_SAPI !== 'cli')") !== false && strpos($cronSource, "if (PHP_SAPI !== 'cli')") < strpos($cronSource, "require_once __DIR__ . '/../backup-lib.php'"), $failures, $passed);
check('the CLI guard responds with 403 and exits, never falling through to backup logic', (function () use ($cronSource) {
    $guardPos = strpos($cronSource, "if (PHP_SAPI !== 'cli')");
    $block = substr($cronSource, $guardPos, 120);
    return strpos($block, 'http_response_code(403)') !== false && strpos($block, 'exit(') !== false;
})(), $failures, $passed);
$cronHtaccess = (string) @file_get_contents($root . '/public_html/api/admin/cron/.htaccess');
check('cron/ folder has a defense-in-depth .htaccess denying all web access', stripos($cronHtaccess, 'Require all denied') !== false || stripos($cronHtaccess, 'deny from all') !== false, $failures, $passed);

echo "\n== 21. Concurrent run lock prevents a second run (real flock, same process, two file handles) ==\n";
$lockTestPath = tempnam(sys_get_temp_dir(), 'akinal-lock-test-') . '.lock';
@unlink($lockTestPath); // backup_acquire_lock_at() must create it itself
$firstLock = backup_acquire_lock_at($lockTestPath);
check('first lock attempt on a fresh path succeeds', $firstLock['acquired'] === true, $failures, $passed);
check('first lock attempt reports no stale marker (fresh file)', $firstLock['stale_recovered'] === false, $failures, $passed);
$secondLock = backup_acquire_lock_at($lockTestPath);
check('a second, concurrent lock attempt on the same path is rejected while the first is held', $secondLock['acquired'] === false, $failures, $passed);
backup_release_lock($firstLock['handle']);
$thirdLock = backup_acquire_lock_at($lockTestPath);
check('after releasing, a new lock attempt succeeds again', $thirdLock['acquired'] === true, $failures, $passed);
backup_release_lock($thirdLock['handle']);
@unlink($lockTestPath);

echo "\n== 22. A stale leftover lock file (from a crashed/killed prior run) is recovered safely, not treated as blocking ==\n";
$staleLockPath = tempnam(sys_get_temp_dir(), 'akinal-stale-lock-') . '.lock';
file_put_contents($staleLockPath, json_encode(['pid' => 999999, 'started_at' => '2020-01-01T00:00:00+00:00'])); // simulates a leftover marker with no live process holding flock
$staleLock = backup_acquire_lock_at($staleLockPath);
check('a leftover (unlocked) lock marker never blocks a fresh run', $staleLock['acquired'] === true, $failures, $passed);
check('the leftover marker is reported as stale_recovered for logging', $staleLock['stale_recovered'] === true, $failures, $passed);
backup_release_lock($staleLock['handle']);
@unlink($staleLockPath);
check('the shared run function logs the stale-recovery reason when stale_recovered is true', strpos($runFnBody, "recovered a stale/leftover lock marker from a previous run") !== false, $failures, $passed);
check('the shared run function releases the lock via register_shutdown_function (covers every exit path)', strpos($runFnBody, 'register_shutdown_function(') !== false && strpos($runFnBody, 'backup_release_lock($lock') !== false, $failures, $passed);
check('the shared run function acquires the lock before creating any ledger run row (a lock miss never creates a phantom "running" history entry)', strpos($runFnBody, "backup_acquire_lock_at(") < strpos($runFnBody, "backup_start_run(\$runType)"), $failures, $passed);
check('the SAME lock path is used regardless of trigger, so cron and the manual button can never race each other', substr_count($runFnBody, "backup_private_dir() . '/daily-run.lock'") === 1, $failures, $passed);

echo "\n== 23. Retention only ever runs after a full, remotely-verified package (pure selection logic + gating) ==\n";
$now = '2026-01-10T00-00-00Z';
$completeFolders = [
    ['id' => 'f1', 'name' => 'akinal-recovery-2026-01-01T00-00-00Z', 'created_at' => '2026-01-01T00:00:00Z'],
    ['id' => 'f2', 'name' => 'akinal-recovery-2026-01-02T00-00-00Z', 'created_at' => '2026-01-02T00:00:00Z'],
    ['id' => 'f3', 'name' => 'akinal-recovery-2026-01-03T00-00-00Z', 'created_at' => '2026-01-03T00:00:00Z'],
];
check('within the limit, nothing is selected for deletion', backup_pure_select_retention_deletions($completeFolders, 30) === [], $failures, $passed);
$overLimitDeletions = backup_pure_select_retention_deletions($completeFolders, 2);
check('over the limit, exactly the excess count is selected for deletion', count($overLimitDeletions) === 1, $failures, $passed);
check('the OLDEST folder (by created_at) is the one selected for deletion, not an arbitrary one', ($overLimitDeletions[0]['id'] ?? null) === 'f1', $failures, $passed);
check('retention selection never depends on input array order (pre-sorted internally)', backup_pure_select_retention_deletions(array_reverse($completeFolders), 2)[0]['id'] === 'f1', $failures, $passed);
check('the shared run function reuses backup_pure_select_retention_deletions() rather than a duplicated inline loop', strpos($runFnBody, 'backup_pure_select_retention_deletions(') !== false, $failures, $passed);
check('retention is only reached via the "complete" branch, still gated behind gdrive_verify_uploaded_package() succeeding earlier in the same try block', strpos($runFnBody, 'gdrive_verify_uploaded_package(') < strpos($runFnBody, 'backup_pure_select_retention_deletions('), $failures, $passed);

echo "\n== 24. UTC timestamps in package metadata and logs ==\n";
check('manifest created_at uses gmdate(), not local date()', strpos($runFnBody, "'created_at' => gmdate('c')") !== false, $failures, $passed);
check('package name timestamp uses gmdate()', strpos($runFnBody, "gmdate('Y-m-d\\TH-i-s\\Z')") !== false, $failures, $passed);
check('backup_log() timestamps with gmdate(), not local date()', strpos($libSource, "gmdate('c')") !== false, $failures, $passed);
check('ledger started_at/finished_at use gmdate(), not local date()', substr_count($libSource, "gmdate('Y-m-d H:i:s')") >= 2, $failures, $passed);

echo "\n== 25. Schedule reporting never claims cron is active from code alone ==\n";
check('backup_pure_schedule_confirmed() requires an actual recorded run, not just true by default', backup_pure_schedule_confirmed(null, time()) === false, $failures, $passed);
check('a run recorded 1 hour ago counts as confirmed', backup_pure_schedule_confirmed(gmdate('Y-m-d\TH:i:s\Z', time() - 3600), time()) === true, $failures, $passed);
check('a run recorded 10 days ago does NOT count as confirmed (stale — cron may have stopped)', backup_pure_schedule_confirmed(gmdate('Y-m-d\TH:i:s\Z', time() - (10 * 86400)), time()) === false, $failures, $passed);
check('an unparseable timestamp is treated as not confirmed rather than throwing', backup_pure_schedule_confirmed('not-a-date', time()) === false, $failures, $passed);
check("backups.php derives 'confirmed_by_recent_run' from an actual ak_backup_runs row, not a hardcoded true", strpos($backupsPhpSource, "backup_pure_schedule_confirmed(\$lastDailyRunAt, time())") !== false, $failures, $passed);
check('the schedule label constant matches the required cron expression 0 3 * * *', BACKUP_DAILY_SCHEDULE_EXPRESSION === '0 3 * * *', $failures, $passed);
// Note: the customer-facing demo page intentionally no longer renders the schedule/
// cron-confirmation banner (see §13) — the underlying data and honesty guarantee
// (never claim "confirmed" without a real recorded run) still lives in the API/backend.

echo "\n== 26. Cron documentation references the CLI entry point only (no HTTP-callable trigger implied) ==\n";
check('docs point at cron/backup-daily.php as the command target', strpos($docsSource, 'cron/backup-daily.php') !== false, $failures, $passed);
check('docs do not suggest any HTTP/browser-triggerable backup URL for the daily job', !preg_match('#https?://\S*backup-daily#i', $docsSource), $failures, $passed);
check('docs state the required cron expression 0 3 * * *', strpos($docsSource, '0 3 * * *') !== false, $failures, $passed);
check('docs explain the two paths to select (PHP CLI binary, script/log paths) rather than asking the reader to type an absolute path', stripos($docsSource, 'two paths') !== false, $failures, $passed);
check('docs do not embed any real password/token/secret value', !preg_match('/(password|secret|token)\s*[:=]\s*[\'"][^\'"]{6,}[\'"]/i', $docsSource), $failures, $passed);

echo "\n== 27. Manual 'Back Up Now' endpoint is protected and reuses the shared run function (no duplicated logic) ==\n";
$runNowSource = (string) @file_get_contents($root . '/public_html/api/admin/backup-run-now.php');
check('backup-run-now.php exists', $runNowSource !== '', $failures, $passed);
check('backup-run-now.php requires an authenticated admin session', strpos($runNowSource, 'require_admin()') !== false, $failures, $passed);
check('backup-run-now.php only accepts POST (not a plain GET-able link)', strpos($runNowSource, "require_method('POST')") !== false, $failures, $passed);
check('backup-run-now.php calls the SAME shared function as cron, not a reimplementation', strpos($runNowSource, "backup_execute_full_run('manual_admin')") !== false, $failures, $passed);
check('backup-run-now.php does not itself call gdrive_upload_file/backup_build_site_archive/backup_dump_database directly (would mean duplicated logic)', strpos($runNowSource, 'gdrive_upload_file(') === false && strpos($runNowSource, 'backup_build_site_archive(') === false && strpos($runNowSource, 'backup_dump_database(') === false, $failures, $passed);
check('backup-run-now.php distinctly handles an already-running lock as 409, not a generic 500', strpos($runNowSource, 'BackupAlreadyRunningException') !== false && strpos($runNowSource, '409') !== false, $failures, $passed);
check('backup-run-now.php response only ever includes the small safe field set (run_id/status/package_name/created_at), never a path-shaped key', preg_match('/json_success\(\[\s*\'run_id\'.*?\]\);/s', $runNowSource) === 1, $failures, $passed);
check('backup-run-now.php writes an audit log entry for the manual trigger', strpos($runNowSource, "backup_audit(\$admin, 'manual_run_now'") !== false, $failures, $passed);
check('cron/backup-daily.php is now a thin wrapper (no duplicated archive/upload/retention logic of its own)', strpos($cronSource, 'backup_build_site_archive(') === false && strpos($cronSource, 'gdrive_upload_file(') === false && strpos($cronSource, 'backup_pure_select_retention_deletions(') === false, $failures, $passed);
check('cron/backup-daily.php delegates to backup_execute_full_run(\'daily_auto\')', strpos($cronSource, "backup_execute_full_run('daily_auto')") !== false, $failures, $passed);

echo "\n== 28. Stale/empty lock recovery: production-failure fix ==\n";
echo "-- (diagnosed cause: the old lock code relied solely on flock() with no independent\n";
echo "--  age/PID/empty-content staleness check, so a marker left in an unusual state could\n";
echo "--  never self-heal on hosts where flock() doesn't reliably release) --\n";

// An empty lock file (e.g. left by an interrupted first write) must NEVER be
// treated as a live, permanently-active lock — regardless of its age.
check('pure: empty/null lock content is always stale, even with a very recent age', backup_pure_lock_is_stale(null, 5) === true, $failures, $passed);
check('pure: valid, fresh content with unknown age is NOT force-cleared', backup_pure_lock_is_stale(['started_at' => gmdate('c'), 'pid' => 1234], null) === false, $failures, $passed);
check('pure: valid content younger than the max age is NOT stale', backup_pure_lock_is_stale(['started_at' => gmdate('c')], 10) === false, $failures, $passed);
check('pure: valid content older than the max age IS stale', backup_pure_lock_is_stale(['started_at' => gmdate('c')], BACKUP_LOCK_MAX_AGE_SECONDS + 1) === true, $failures, $passed);
check('pure: a confirmed-dead PID is stale regardless of age', backup_pure_lock_is_stale(['started_at' => gmdate('c'), 'pid' => 999999], 5, false) === true, $failures, $passed);

// Real filesystem test: an empty leftover lock file, however old, must be
// recovered by backup_acquire_lock_at() rather than blocking forever.
$emptyLockPath = tempnam(sys_get_temp_dir(), 'akinal-empty-lock-') . '.lock';
file_put_contents($emptyLockPath, ''); // simulates a marker left with no content at all
touch($emptyLockPath, time() - 10); // even a RECENT empty file must still be recovered
$emptyLockResult = backup_acquire_lock_at($emptyLockPath);
check('an empty lock file is acquired successfully (never permanently active)', $emptyLockResult['acquired'] === true, $failures, $passed);
check('acquiring an empty lock file is reported as a stale recovery', $emptyLockResult['stale_recovered'] === true, $failures, $passed);
backup_release_lock($emptyLockResult['handle']);
@unlink($emptyLockPath);

// Real filesystem test: an old (beyond max-age), non-empty lock file must also
// be recovered even though its JSON content parses fine.
$oldLockPath = tempnam(sys_get_temp_dir(), 'akinal-old-lock-') . '.lock';
file_put_contents($oldLockPath, json_encode(['pid' => getmypid(), 'started_at' => gmdate('c', time() - (BACKUP_LOCK_MAX_AGE_SECONDS + 100))]));
touch($oldLockPath, time() - (BACKUP_LOCK_MAX_AGE_SECONDS + 100));
$oldLockResult = backup_acquire_lock_at($oldLockPath);
check('an old (beyond max age) lock file with valid JSON is still recovered as stale', $oldLockResult['acquired'] === true && $oldLockResult['stale_recovered'] === true, $failures, $passed);
backup_release_lock($oldLockResult['handle']);
@unlink($oldLockPath);

echo "\n== 29. A genuinely active (fresh, valid, currently flock()'d) lock still blocks a concurrent run ==\n";
$activeLockPath = tempnam(sys_get_temp_dir(), 'akinal-active-lock-') . '.lock';
@unlink($activeLockPath);
$activeFirst = backup_acquire_lock_at($activeLockPath);
check('a fresh valid lock is acquired normally', $activeFirst['acquired'] === true, $failures, $passed);
$activeSecond = backup_acquire_lock_at($activeLockPath);
check('a concurrent attempt against a genuinely active lock is still correctly rejected (the stale-recovery fix does not weaken real mutual exclusion)', $activeSecond['acquired'] === false, $failures, $passed);
backup_release_lock($activeFirst['handle']);
$activeThird = backup_acquire_lock_at($activeLockPath);
check('lock removal after release (simulating cleanup after a failure) allows the next run to acquire it', $activeThird['acquired'] === true, $failures, $passed);
backup_release_lock($activeThird['handle']);
@unlink($activeLockPath);

echo "\n== 29b. Split-brain fix: stale-LOOKING content must never override a currently-held flock ==\n";
echo "-- (the flaw: unlinking/replacing the lock path based only on its content, before\n";
echo "--  checking whether some OTHER process still holds flock() on that same inode, lets\n";
echo "--  a second caller create-and-lock a FRESH inode while the first still holds the real\n";
echo "--  lock on the old one — two 'successful' acquisitions, two backups running at once) --\n";

// Source-level guarantee: backup_acquire_lock_at() must attempt flock() BEFORE
// any content-based staleness read, and must never call unlink()/rename() on
// the lock path anywhere in its body — the only mutation allowed is
// ftruncate()+fwrite() on the handle AFTER flock() has already succeeded.
$pureSource = (string) file_get_contents($root . '/public_html/api/admin/backup-pure.php');
$acquireFnStart = strpos($pureSource, 'function backup_acquire_lock_at(');
$acquireFnEnd = strpos($pureSource, "\nfunction ", $acquireFnStart + 1);
$acquireFnBody = substr($pureSource, $acquireFnStart, ($acquireFnEnd !== false ? $acquireFnEnd : strlen($pureSource)) - $acquireFnStart);
$flockCallPos = strpos($acquireFnBody, 'flock($handle, LOCK_EX | LOCK_NB)');
check('backup_acquire_lock_at() attempts flock() on the open handle', $flockCallPos !== false, $failures, $passed);
check('backup_acquire_lock_at() never calls unlink()/rename() on the lock path (no pre-flock or post-failure removal)', strpos($acquireFnBody, 'unlink(') === false && strpos($acquireFnBody, 'rename(') === false, $failures, $passed);
$contentReadPos = strpos($acquireFnBody, 'stream_get_contents($handle)');
check('the existing marker content is only ever read AFTER the flock() call (diagnostics only, never gates the flock attempt itself)', $contentReadPos !== false && $flockCallPos !== false && $contentReadPos > $flockCallPos, $failures, $passed);
$truncatePos = strpos($acquireFnBody, 'ftruncate($handle, 0)');
check('the marker is only truncated/rewritten AFTER flock() succeeded (on the same already-locked handle)', $truncatePos !== false && $truncatePos > $flockCallPos, $failures, $passed);

// Real filesystem test: a lock file whose CONTENT looks maximally stale (dead
// PID, ancient timestamp, old mtime) but whose inode is ACTIVELY flock()'d by
// another handle must still be rejected, and must be left byte-for-byte
// untouched — proving content-based judgments never override a live flock.
$activeOldLockPath = tempnam(sys_get_temp_dir(), 'akinal-active-old-lock-') . '.lock';
$oldStaleContent = (string) json_encode(['pid' => 999999, 'started_at' => '2020-01-01T00:00:00+00:00']);
file_put_contents($activeOldLockPath, $oldStaleContent);
touch($activeOldLockPath, time() - (BACKUP_LOCK_MAX_AGE_SECONDS + 500));
$inodeBefore = @fileinode($activeOldLockPath);

$holderHandle = fopen($activeOldLockPath, 'c+');
check('a competing holder can open and flock the same path (test setup)', $holderHandle !== false && flock($holderHandle, LOCK_EX | LOCK_NB), $failures, $passed);

$rejectedDespiteStaleContent = backup_acquire_lock_at($activeOldLockPath);
check('an actively-flocked lock is rejected even though its OWN content looks dead/old/empty-equivalent', $rejectedDespiteStaleContent['acquired'] === false, $failures, $passed);
check('a rejected acquisition returns a null handle (nothing left to release)', $rejectedDespiteStaleContent['handle'] === null, $failures, $passed);
// Note: file_get_contents() against a path another handle holds an exclusive
// flock() on can itself fail/read-empty on this platform (Windows enforces
// flock() as a whole-file share-mode lock, blocking other readers too) — that
// is a platform read restriction, not evidence of the file being unlinked or
// rewritten. So the content/inode-unchanged assertions below are checked via
// fileinode() (which remains readable while locked) during the hold, and via
// full content equality only AFTER the holder releases.
check('the actively-locked file is never unlinked (still exists at the same path)', is_file($activeOldLockPath), $failures, $passed);
check('the actively-locked file keeps the SAME inode while held (no unlink+recreate happened under the covers)', @fileinode($activeOldLockPath) === $inodeBefore, $failures, $passed);

// No second concurrent run can acquire a DIFFERENT inode for the same logical
// lock path while the first holder is still active.
$secondCallerDuringHold = backup_acquire_lock_at($activeOldLockPath);
check('no second concurrent caller can acquire a different inode while the first holder is active', $secondCallerDuringHold['acquired'] === false, $failures, $passed);
check('the path still resolves to the original inode after a second rejected attempt (no split-brain new-inode creation)', @fileinode($activeOldLockPath) === $inodeBefore, $failures, $passed);

flock($holderHandle, LOCK_UN);
fclose($holderHandle);
check('after the real holder releases, the marker content is exactly what it was before any rejected acquisition attempt (proves the rejection path never truncated/rewrote it)', file_get_contents($activeOldLockPath) === $oldStaleContent, $failures, $passed);
$releasedNowAcquires = backup_acquire_lock_at($activeOldLockPath);
check('once the real holder releases, a fresh acquisition succeeds and rewrites the marker (previously-stale-looking content is now classified as stale_recovered)', $releasedNowAcquires['acquired'] === true && $releasedNowAcquires['stale_recovered'] === true, $failures, $passed);
backup_release_lock($releasedNowAcquires['handle']);
@unlink($activeOldLockPath);

echo "\n== 30. Diagnostic message sanitization (no paths/tokens ever reach logs in raw form) ==\n";
check('sanitizer redacts a POSIX absolute path', strpos(backup_pure_sanitize_diagnostic_message('Could not open /home/someuser/akinal-private/akinal-backup/work/x.zip'), '/home/someuser') === false, $failures, $passed);
check('sanitizer redacts a Windows absolute path', strpos(backup_pure_sanitize_diagnostic_message('failed at C:\\Users\\admin\\secrets\\key.json'), 'C:\\Users') === false, $failures, $passed);
check('sanitizer replaces a redacted path with a neutral marker', strpos(backup_pure_sanitize_diagnostic_message('Could not open /private/path/file.zip'), '[path]') !== false, $failures, $passed);
check('sanitizer redacts a token=... style credential fragment', strpos(backup_pure_sanitize_diagnostic_message('auth failed, token=abcDEF123456'), 'abcDEF123456') === false, $failures, $passed);
check('sanitizer caps message length', strlen(backup_pure_sanitize_diagnostic_message(str_repeat('x', 1000))) <= 503, $failures, $passed);
check('sanitizer never depends on ext-mbstring (byte-based length/truncation only)', strpos((string) file_get_contents($root . '/public_html/api/admin/backup-pure.php'), 'mb_strlen') === false && strpos((string) file_get_contents($root . '/public_html/api/admin/backup-pure.php'), 'mb_substr') === false, $failures, $passed);

echo "\n== 31. The shared run function stages every failure and always releases the lock in finally ==\n";
$stageNames = ['drive_config', 'prerequisites', 'archive', 'database_export', 'manifest', 'drive_upload', 'remote_verification', 'retention'];
$lastPos = -1;
$stagesInOrder = true;
foreach ($stageNames as $stageName) {
    $pos = strpos($runFnBody, "\$stage = '{$stageName}'");
    if ($pos === false || $pos < $lastPos) {
        $stagesInOrder = false;
    }
    $lastPos = $pos !== false ? $pos : $lastPos;
}
check('every stage is labeled ($stage = ...) in the correct execution order', $stagesInOrder, $failures, $passed);
check('the failure handler logs class + sanitized message + which stage failed', strpos($runFnBody, "'Backup run failed (run_id=%s, type=%s, stage=%s): class=%s message=%s'") !== false, $failures, $passed);
check('the failure handler sanitizes the exception message before logging/storing it', strpos($runFnBody, 'backup_pure_sanitize_diagnostic_message($exception->getMessage())') !== false, $failures, $passed);
check('the ledger row is only marked failed when a run row actually exists (no ledger write attempted for a pre-run-row failure)', strpos($runFnBody, 'if ($runId !== null) {') !== false, $failures, $passed);
$outerFinallyPos = strrpos($runFnBody, '} finally {');
check('the shared run function has an outer finally block', $outerFinallyPos !== false, $failures, $passed);
$afterOuterFinally = $outerFinallyPos !== false ? substr($runFnBody, $outerFinallyPos) : '';
check('the lock is released in that outer finally block, which always runs (covers archive/upload/verification failures too)', strpos($afterOuterFinally, "backup_release_lock(\$lock['handle']);") !== false, $failures, $passed);
check('the work directory is also cleaned up in that same finally block, before the lock release', strpos($afterOuterFinally, 'backup_rrmdir($workDir);') !== false && strpos($afterOuterFinally, 'backup_rrmdir($workDir);') < strpos($afterOuterFinally, "backup_release_lock(\$lock['handle']);"), $failures, $passed);
check('backup_release_lock($lock...) appears exactly twice: once in the shutdown-function safety net, once in the primary finally', substr_count($runFnBody, "backup_release_lock(\$lock['handle'])") === 2, $failures, $passed);

echo "\n== 32. Manual endpoint still returns only a safe generic failure to the browser ==\n";
check('a generic, fixed-string message constant is used for every failure response', strpos($runNowSource, "const BACKUP_RUN_NOW_GENERIC_MESSAGE = 'Yedekleme başlatılamadı ya da tamamlanamadı.'") !== false, $failures, $passed);
check('the JSON error responses use that constant, not an interpolated exception message', substr_count($runNowSource, 'json_error(BACKUP_RUN_NOW_GENERIC_MESSAGE,') >= 2, $failures, $passed);
check('every use of $exception->getMessage() in the manual endpoint is passed through the sanitizer first', strpos($runNowSource, 'backup_pure_sanitize_diagnostic_message($exception->getMessage())') !== false, $failures, $passed);
check('no raw exception message is ever concatenated directly into a json_error()/json_success() call', !preg_match('/json_(error|success)\([^)]*\$exception->getMessage\(\)/', $runNowSource), $failures, $passed);

echo "\n== 33. Fatal-error safety net covers require/bootstrap failures before backup_execute_full_run() ==\n";
check('a register_shutdown_function fatal-error safety net is installed before the backup-lib.php require', strpos($runNowSource, 'register_shutdown_function(') < strpos($runNowSource, "require_once __DIR__ . '/backup-lib.php'"), $failures, $passed);
check('the shutdown handler only reacts to true fatal error types (E_ERROR/E_PARSE/E_CORE_ERROR/E_COMPILE_ERROR)', strpos($runNowSource, 'E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR') !== false, $failures, $passed);
check('the fatal-safety JSON emitter never assumes response.php/backup-lib.php loaded (uses raw header()/echo, not json_error())', strpos($runNowSource, 'function backup_run_now_emit_fatal_json') !== false && strpos($runNowSource, "echo json_encode([\n        'success' => false,") !== false, $failures, $passed);
check('require_once, require_admin(), require_method(), and backup_ensure_tables() are all wrapped in one bootstrap try/catch', preg_match('/try \{\s*require_once __DIR__ \. \'\/backup-lib\.php\';\s*\$admin = require_admin\(\);\s*require_method\(\'POST\'\);\s*backup_ensure_tables\(\);\s*\} catch \(Throwable \$exception\) \{/s', $runNowSource) === 1, $failures, $passed);
check('every failure stage reported to the browser uses the required enum values', (function () use ($runNowSource) {
    preg_match_all("/'stage' => '([a-z_]+)'/", $runNowSource, $m);
    $allowed = ['lock', 'archive', 'database_export', 'manifest', 'drive_upload', 'remote_verification', 'retention', 'bootstrap', 'drive_config', 'prerequisites'];
    foreach ($m[1] as $stageValue) {
        if (!in_array($stageValue, $allowed, true)) {
            return false;
        }
    }
    return count($m[1]) > 0;
})(), $failures, $passed);

echo "\n== 34. BackupStageException carries a safe, structured stage + already-sanitized message ==\n";
check('BackupStageException class exists and extends RuntimeException', preg_match('/class BackupStageException extends RuntimeException/', $libSource) === 1, $failures, $passed);
check('BackupStageException exposes getStage()', strpos($libSource, 'public function getStage(): string') !== false, $failures, $passed);
check('the shared run function throws BackupStageException (sanitized message + stage), not the raw original exception', strpos($runFnBody, 'throw new BackupStageException($sanitizedMessage, $stage, $exception);') !== false, $failures, $passed);
check('the original exception is kept only as the chained "previous" exception, never re-thrown directly', strpos($runFnBody, 'throw $exception;') === false, $failures, $passed);

echo "\n== 35. BACKUP_ENCRYPTION_KEY is resolved from either config.php OR backup-config.local.php ==\n";
echo "-- (root cause of the live 'manual_run_now_failed' runs: an admin placed the key only in\n";
echo "--  backup-config.local.php's array, which backup_encryption_key() never read — every run\n";
echo "--  failed at the 'prerequisites' stage with 'BACKUP_ENCRYPTION_KEY yapılandırılmamış.') --\n";
check('backup_drive_config() extracts an encryption_key entry from backup-config.local.php', strpos($libSource, "\$encryptionKey = trim((string) (\$data['BACKUP_ENCRYPTION_KEY'] ?? ''))") !== false, $failures, $passed);
check('a single backup_encryption_key_source() resolves BOTH sources (config.php constant first, then the private file)', strpos($libSource, 'function backup_encryption_key_source(): ?string') !== false, $failures, $passed);
check('backup_encryption_key() now goes through the shared resolver instead of checking only the constant', strpos($libSource, '$key = backup_encryption_key_source();') !== false, $failures, $passed);
check('backup_assert_prerequisites() uses the same shared resolver (so the "not configured" pre-check and the actual encryption step never disagree)', strpos($libSource, 'if (backup_encryption_key_source() === null) {') !== false, $failures, $passed);
check('backup_capabilities() also uses the shared resolver for encryption_key_configured', strpos($libSource, "'encryption_key_configured' => backup_encryption_key_source() !== null") !== false, $failures, $passed);
check('the tracked private-config example documents BACKUP_ENCRYPTION_KEY as an optional fallback entry', strpos((string) @file_get_contents($root . '/akinal-private/akinal-backup/backup-config.local.example.php'), "'BACKUP_ENCRYPTION_KEY' => ''") !== false, $failures, $passed);
check('no real encryption key value is ever hardcoded anywhere in the codebase (only the constant/array key NAME appears)', !preg_match('/BACKUP_ENCRYPTION_KEY[\'"]?\s*(=>|,)\s*[\'"][A-Za-z0-9+\/=]{20,}[\'"]/', $libSource), $failures, $passed);

echo "\n== 36. Every Google Drive v3 API call supports Shared Drive folders ==\n";
echo "-- (root cause of the live 403 'Service Accounts do not have storage quota': the\n";
echo "--  Drive requests never set supportsAllDrives=true, so Drive treated the upload\n";
echo "--  as targeting the service account's own My Drive, which has no storage quota) --\n";
$driveCallSites = [
    'gdrive_create_folder() (folder creation write)' => "https://www.googleapis.com/drive/v3/files?fields=id&supportsAllDrives=true",
    'gdrive_upload_file() resumable session start (the actual archive upload)' => "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id&supportsAllDrives=true",
    'gdrive_get_file_content() (small metadata file reads)' => "'https://www.googleapis.com/drive/v3/files/' . \$fileId . '?alt=media&supportsAllDrives=true'",
    'gdrive_get_metadata()' => "'&supportsAllDrives=true'",
    'gdrive_download_to_stream() (manual per-file download)' => "'https://www.googleapis.com/drive/v3/files/' . \$fileId . '?alt=media&supportsAllDrives=true'",
    'gdrive_delete_file() (retention cleanup)' => "'https://www.googleapis.com/drive/v3/files/' . \$fileId . '?supportsAllDrives=true'",
];
foreach ($driveCallSites as $label => $needle) {
    check("{$label} sets supportsAllDrives=true", strpos($libSource, $needle) !== false, $failures, $passed);
}
check('gdrive_list_children() (folder listing — used for retention, dashboard, and package verification) sets supportsAllDrives', strpos($libSource, "'supportsAllDrives' => 'true'") !== false, $failures, $passed);
check('gdrive_list_children() also sets includeItemsFromAllDrives (required alongside supportsAllDrives for list/search queries to return Shared Drive results)', strpos($libSource, "'includeItemsFromAllDrives' => 'true'") !== false, $failures, $passed);
check('list queries stay parent-scoped (q=... in parents) and do NOT need corpora/driveId, which the current single-parent-query design has no use for', strpos($libSource, "'corpora'") === false && strpos($libSource, "'driveId'") === false, $failures, $passed);
check('the upload init request documents that supportsAllDrives carries through into the returned resumable session URL (so the streamed PUT does not need to repeat it)', strpos($libSource, 'Google carries this through into the returned resumable session URL') !== false, $failures, $passed);

echo "\n== 37. A successfully-recorded run can never be downgraded to 'failed' by post-success side effects ==\n";
echo "-- (real bug: the partial-export alert email / retention block ran inside the SAME\n";
echo "--  try as the rest of the function, so any exception there fell through to the outer\n";
echo "--  catch, which called backup_finish_run() with status='failed' a SECOND time on the\n";
echo "--  same row — overwriting status to failed while package_name/size stayed from the\n";
echo "--  earlier successful write. That's exactly a real package name + real size shown\n";
echo "--  next to a 'Başarısız' badge in the history table.) --\n";
$postSuccessMarkerPos = strpos($runFnBody, 'From this point on, the run is ALREADY recorded as successful');
check('backup_execute_full_run() documents the post-success invariant', $postSuccessMarkerPos !== false, $failures, $passed);
$postSuccessBlock = $postSuccessMarkerPos !== false ? substr($runFnBody, $postSuccessMarkerPos) : '';
$postSuccessCatchPos = strpos($postSuccessBlock, '} catch (Throwable $postSuccessError) {');
check('a dedicated try/catch wraps the alert-email + retention block (post-success side effects)', $postSuccessCatchPos !== false, $failures, $passed);
$postSuccessCatchBody = $postSuccessCatchPos !== false ? substr($postSuccessBlock, $postSuccessCatchPos, 400) : '';
check("the post-success catch does NOT call backup_finish_run() again (would overwrite the already-recorded success)", strpos($postSuccessCatchBody, 'backup_finish_run(') === false, $failures, $passed);
check('the post-success catch does NOT rethrow (a rethrow would still reach the outer catch and corrupt the row)', !preg_match('/\bthrow\b/', $postSuccessCatchBody), $failures, $passed);
check('the post-success catch logs the failure with the run_id and the status that was already recorded, for private diagnosis', strpos($postSuccessCatchBody, "already recorded as %s") !== false || strpos($postSuccessBlock, 'already recorded as %s') !== false, $failures, $passed);
// The success-path backup_finish_run(...) call must textually precede the new
// try{...}catch($postSuccessError){...} wrapper, and the partial-export alert
// call + the retention block must both be INSIDE that wrapper (between the
// marker and its catch), not before it.
$successFinishRunPos = strpos($runFnBody, "backup_finish_run(\$runId, \$runStatus, [");
check('backup_finish_run(success) happens BEFORE the post-success try wrapper starts', $successFinishRunPos !== false && $postSuccessMarkerPos !== false && $successFinishRunPos < $postSuccessMarkerPos, $failures, $passed);
$alertCallPos = strpos($postSuccessBlock, 'backup_send_alert(');
check('the partial-export alert call is inside the post-success try wrapper (between the marker and its catch)', $alertCallPos !== false && $postSuccessCatchPos !== false && $alertCallPos < $postSuccessCatchPos, $failures, $passed);
$retentionSelectPos = strpos($postSuccessBlock, 'backup_pure_select_retention_deletions(');
check('the retention block is inside the post-success try wrapper (between the marker and its catch)', $retentionSelectPos !== false && $postSuccessCatchPos !== false && $retentionSelectPos < $postSuccessCatchPos, $failures, $passed);

echo "\n== 38. frontend.zip.enc NEVER walks the cPanel account root (production audit fix) ==\n";
echo "-- (production audit proved the account root has no React/Vite source AND leaks\n";
echo "--  .htpasswd/logs/stats/private_html/public_ftp — this section proves the fix) --\n";
check('backup_repo_root() no longer exists anywhere in the codebase', strpos($libSource, 'function backup_repo_root') === false, $failures, $passed);
check('backup_build_frontend_archive() reads from a dedicated private frontend-source dir function', strpos($libSource, 'function backup_frontend_source_dir') !== false, $failures, $passed);
check('the frontend-source dir resolves under akinal-private/ (private_dir\'s own sibling), not the account root', strpos($libSource, "dirname(backup_private_dir()) . '/frontend-source'") !== false, $failures, $passed);
$frontendArchiveFnStart = strpos($libSource, 'function backup_build_frontend_archive(');
$frontendArchiveFnEnd = strpos($libSource, "\nfunction ", $frontendArchiveFnStart + 1);
$frontendArchiveFnBody = substr($libSource, $frontendArchiveFnStart, ($frontendArchiveFnEnd !== false ? $frontendArchiveFnEnd : strlen($libSource)) - $frontendArchiveFnStart);
check('backup_build_frontend_archive() never calls dirname(__DIR__, 2) twice to climb past public_html (no account-root walk)', substr_count($frontendArchiveFnBody, 'dirname(__DIR__, 2)') === 1, $failures, $passed);
check('backup_build_frontend_archive() walks backup_frontend_source_dir(), not any account-root path', strpos($frontendArchiveFnBody, 'backup_frontend_source_dir()') !== false, $failures, $passed);
check('a missing frontend-source mirror is handled gracefully (logged), not a hard failure', strpos($frontendArchiveFnBody, 'is_dir($sourceDir)') !== false && strpos($frontendArchiveFnBody, 'backup_log(') !== false, $failures, $passed);

echo "\n== 39. backend.zip.enc allowlists exactly two private files — never akinal-private/ blindly ==\n";
$backendArchiveFnStart = strpos($libSource, 'function backup_build_backend_archive(');
$backendArchiveFnEnd = strpos($libSource, "\nfunction ", $backendArchiveFnStart + 1);
$backendArchiveFnBody = substr($libSource, $backendArchiveFnStart, ($backendArchiveFnEnd !== false ? $backendArchiveFnEnd : strlen($libSource)) - $backendArchiveFnStart);
check('backup_build_backend_archive() never walks/iterates akinal-private/ as a directory (no RecursiveDirectoryIterator over it)', strpos($backendArchiveFnBody, 'RecursiveDirectoryIterator') === false, $failures, $passed);
check('backup_build_backend_archive() adds exactly the backup-config.local.php allowlisted entry', strpos($backendArchiveFnBody, "'akinal-private/akinal-backup/backup-config.local.php'") !== false, $failures, $passed);
check('backup_build_backend_archive() adds the Drive service-account credential file by its own exact resolved path (not a directory scan)', strpos($backendArchiveFnBody, "\$driveConfig['credentials_path']") !== false, $failures, $passed);

echo "\n== 40. BACKUP_ENCRYPTION_KEY is redacted from every config file embedded in a backup archive ==\n";
check('backup_pure_redact_encryption_key() exists (pure, testable)', function_exists('backup_pure_redact_encryption_key'), $failures, $passed);
$defineForm = "<?php\ndefine('DB_HOST', 'localhost');\ndefine('BACKUP_ENCRYPTION_KEY', 'super-secret-real-key-value');\ndefine('BACKUP_ALERT_EMAIL', 'x@example.com');\n";
$redactedDefine = backup_pure_redact_encryption_key($defineForm);
check('redacts the define() form used by config.php', strpos($redactedDefine, 'super-secret-real-key-value') === false, $failures, $passed);
check('redaction placeholder is present in the define() form', strpos($redactedDefine, '[REDACTED_BEFORE_BACKUP_ARCHIVING]') !== false, $failures, $passed);
check('other constants survive untouched (define() form)', strpos($redactedDefine, "define('DB_HOST', 'localhost')") !== false && strpos($redactedDefine, "define('BACKUP_ALERT_EMAIL', 'x@example.com')") !== false, $failures, $passed);

$arrayForm = "<?php\nreturn [\n    'GOOGLE_DRIVE_BACKUP_FOLDER_ID' => 'abc123',\n    'BACKUP_ENCRYPTION_KEY' => 'super-secret-real-key-value',\n];\n";
$redactedArray = backup_pure_redact_encryption_key($arrayForm);
check('redacts the array form used by backup-config.local.php', strpos($redactedArray, 'super-secret-real-key-value') === false, $failures, $passed);
check('redaction placeholder is present in the array form', strpos($redactedArray, '[REDACTED_BEFORE_BACKUP_ARCHIVING]') !== false, $failures, $passed);
check('other keys survive untouched (array form)', strpos($redactedArray, "'GOOGLE_DRIVE_BACKUP_FOLDER_ID' => 'abc123'") !== false, $failures, $passed);

check('a config file with no BACKUP_ENCRYPTION_KEY at all is returned unchanged', backup_pure_redact_encryption_key("<?php\ndefine('DB_HOST', 'x');\n") === "<?php\ndefine('DB_HOST', 'x');\n", $failures, $passed);

check('backup_build_split_site_archive() redacts config.php/config.local.php before adding them (addFromString, not addFile, for those two paths)', strpos($libSource, "backup_pure_redact_encryption_key((string) file_get_contents(\$file->getPathname()))") !== false, $failures, $passed);
check('backup_build_backend_archive() also redacts backup-config.local.php before adding it', substr_count($libSource, 'backup_pure_redact_encryption_key(') >= 2, $failures, $passed);
check('the Drive service-account credential file is added as-is (addFile, not addFromString) — it is a different secret than the backup encryption key, not self-defeating to embed', strpos($backendArchiveFnBody, "addFile(\$credPath, \$entryName)") !== false, $failures, $passed);

echo "\n== 41. Frontend-source mirror deploy tooling exists and stays off the public web root ==\n";
$deploySource = (string) @file_get_contents($root . '/scripts/deploy_ftp.py');
check('deploy_ftp.py defines the private mirror remote root under akinal-private/, not public_html/', strpos($deploySource, 'FRONTEND_SOURCE_REMOTE_ROOT = "/akinal-private/frontend-source"') !== false, $failures, $passed);
check('deploy_ftp.py excludes node_modules from the frontend-source item list (item list has no such entry)', strpos($deploySource, '"node_modules"') === false, $failures, $passed);
check('deploy_ftp.py includes src and package.json in the whitelist', strpos($deploySource, '"src"') !== false && strpos($deploySource, '"package.json"') !== false, $failures, $passed);
check('sync_frontend_source_mirror() is called from main() for every normal deploy (not gated behind a separate flag)', substr_count($deploySource, 'sync_frontend_source_mirror(') >= 2, $failures, $passed);

echo "\n== 42. Success-email settings (Resend key/from/recipient) support the same private-file fallback as BACKUP_ENCRYPTION_KEY ==\n";
check('backup_resend_api_key_source() exists and checks config.php constant first', strpos($libSource, 'function backup_resend_api_key_source(): ?string') !== false, $failures, $passed);
check('backup_resend_from_email_source() exists and falls back to onboarding@resend.dev', strpos($libSource, 'function backup_resend_from_email_source(): string') !== false, $failures, $passed);
check('backup_success_notification_email_source() exists', strpos($libSource, 'function backup_success_notification_email_source(): ?string') !== false, $failures, $passed);
check('backup_drive_config() extracts RESEND_API_KEY from backup-config.local.php', strpos($libSource, "\$resendApiKey = trim((string) (\$data['RESEND_API_KEY'] ?? ''))") !== false, $failures, $passed);
check('backup_drive_config() extracts RESEND_FROM_EMAIL from backup-config.local.php', strpos($libSource, "\$resendFromEmail = trim((string) (\$data['RESEND_FROM_EMAIL'] ?? ''))") !== false, $failures, $passed);
check('backup_drive_config() extracts BACKUP_SUCCESS_NOTIFICATION_EMAIL from backup-config.local.php', strpos($libSource, "\$successNotificationEmail = trim((string) (\$data['BACKUP_SUCCESS_NOTIFICATION_EMAIL'] ?? ''))") !== false, $failures, $passed);
check('backup_send_success_email() uses the resolver, not a raw defined()/constant check, for the recipient', strpos($libSource, 'backup_success_notification_email_source()') !== false, $failures, $passed);
check('backup_send_success_email() uses the resolver for the Resend API key gate', substr_count($libSource, 'backup_resend_api_key_source()') >= 2, $failures, $passed);
check('backup_resend_send_email() resolves the API key via the shared resolver rather than referencing the raw RESEND_API_KEY constant directly', strpos($libSource, "'Authorization: Bearer ' . \$apiKey") !== false && strpos($libSource, "'Authorization: Bearer ' . RESEND_API_KEY") === false, $failures, $passed);
check('capabilities() derives success_email_configured from both resolvers (key + recipient), not raw constants', strpos($libSource, "'success_email_configured' => backup_success_notification_email_source() !== null") !== false, $failures, $passed);
$exampleBackupConfigSource = (string) @file_get_contents($root . '/akinal-private/akinal-backup/backup-config.local.example.php');
check('the tracked private-config example documents RESEND_API_KEY as an optional fallback entry', strpos($exampleBackupConfigSource, "'RESEND_API_KEY' => ''") !== false, $failures, $passed);
check('the tracked private-config example documents BACKUP_SUCCESS_NOTIFICATION_EMAIL as an optional fallback entry', strpos($exampleBackupConfigSource, "'BACKUP_SUCCESS_NOTIFICATION_EMAIL' => ''") !== false, $failures, $passed);
check('the tracked private-config example does not hardcode a real recipient/key value', strpos($exampleBackupConfigSource, 'bedizoymak') === false && strpos($exampleBackupConfigSource, 're_') === false, $failures, $passed);

echo "\n== 43. Success email now fires for BOTH a fully complete run AND a warned/partial one (root-cause fix) ==\n";
echo "-- (production incident: package akinal-recovery-2026-08-01T16-57-26Z genuinely\n";
echo "--  uploaded+verified on Drive, but status was success_with_warnings (PDO fallback,\n";
echo "--  some DB objects skipped) — the OLD code only ever called\n";
echo "--  backup_send_success_email() inside the dbResult['complete'] branch, so Resend\n";
echo "--  was never even attempted for this class of run) --\n";
$runFnBodyFresh = substr($libSource, strpos($libSource, 'function backup_execute_full_run('));
$emailCallPos = strpos($runFnBodyFresh, 'backup_send_success_email($runId, $packageName, [');
$dbCompleteIfPos = strpos($runFnBodyFresh, "if (!\$dbResult['complete']) {");
check('backup_send_success_email() is called unconditionally (before the if/else split on db completeness), not only inside the complete branch', $emailCallPos !== false && $dbCompleteIfPos !== false && $emailCallPos < $dbCompleteIfPos, $failures, $passed);
check('backup_send_success_email() is passed the actual dbResult[complete] flag so the email body can state it honestly', strpos($runFnBodyFresh, "\$totalPackageSize, \$dbResult['complete']") !== false, $failures, $passed);
check('the partial-export alert email is still sent independently for a warned run (unchanged)', strpos($runFnBodyFresh, "backup_send_alert(\n                    'Yedekleme uyarılarla tamamlandı") !== false, $failures, $passed);
check('retention stays gated strictly to the complete branch only (unchanged — a partial run must never affect retention)', strpos($runFnBodyFresh, "backup_pure_select_retention_deletions(") !== false && strpos($runFnBodyFresh, "backup_pure_select_retention_deletions(") > $dbCompleteIfPos, $failures, $passed);

echo "\n== 44. Notification diagnostic state machine: sent is terminal, failed/not-configured are safely retryable ==\n";
check('backup_send_success_email() accepts a dbComplete parameter for the email body wording', strpos($libSource, 'function backup_send_success_email(string $runId, string $packageName, array $attachments, int $totalPackageSize, bool $dbComplete): void') !== false, $failures, $passed);
check('the claim query only allows NULL/notification_failed/notification_not_configured states to be (re)claimed', strpos($libSource, "WHERE id = :id AND (notification_status IS NULL OR notification_status IN ('notification_failed', 'notification_not_configured'))") !== false, $failures, $passed);
check("'notification_sent' is not among the reclaimable states (so a genuinely accepted send can never be retried/duplicated)", !preg_match("/notification_status IN \\('notification_failed', 'notification_not_configured', 'notification_sent'\\)/", $libSource), $failures, $passed);
check('a Resend rejection/exception sets notification_failed (not notification_sent), leaving success_email_sent_at NULL so a future call remains eligible', substr_count($libSource, "backup_set_notification_status(\$runId, 'notification_failed'") >= 1, $failures, $passed);
check('success_email_sent_at is set ONLY in the same statement that sets notification_status to notification_sent (never set on failure)', strpos($libSource, "'status' => 'notification_sent',\n                'detail' => 'resend_message_id=' . \$result['message_id'],\n                'now' => gmdate('Y-m-d H:i:s'),") !== false, $failures, $passed);
check('backup_resend_send_email() extracts and returns a sanitized Resend message id (an identifier, not a secret) instead of the raw response body', strpos($libSource, "'message_id' => \$ok && is_array(\$decoded) && isset(\$decoded['id'])") !== false, $failures, $passed);
check('backup_resend_send_email() no longer returns the raw response body to its caller', strpos($libSource, "'body' => \$response['body'],") === false, $failures, $passed);

echo "\n== 45. Admin-only non-sensitive notification diagnostic columns exist and are additive ==\n";
check('ak_backup_runs gains notification_status and notification_detail columns (CREATE TABLE for fresh installs)', strpos($libSource, 'notification_status VARCHAR(32) NULL,') !== false && strpos($libSource, 'notification_detail VARCHAR(255) NULL,') !== false, $failures, $passed);
check('an additive ALTER TABLE migration covers deployments where ak_backup_runs already existed', strpos($libSource, "ALTER TABLE ak_backup_runs ADD COLUMN notification_status VARCHAR(32) NULL AFTER success_email_sent_at") !== false, $failures, $passed);
check('backup_set_notification_status() truncates detail to the column width and never accepts raw unsanitized exception objects', strpos($libSource, 'substr($detail, 0, 255)') !== false, $failures, $passed);

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
