<?php
declare(strict_types=1);

/**
 * Yedekleme Merkezi shared library: capability probing, private storage paths,
 * checksums/encryption, site archiver, database dumper, Google Drive REST client,
 * ledger tables and failure-alert email. No secrets are hardcoded here — all
 * come from config.php constants (see config.example.php for the placeholder list).
 */

require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/backup-pure.php';

// ── Private storage ──────────────────────────────────────────────────────────

/**
 * Resolves the private backup directory as the sibling of public_html on the
 * deployed server: public_html/../akinal-private/akinal-backup. Derived purely
 * from this file's own location (backup-lib.php lives at
 * <public_html>/api/admin/backup-lib.php, so two levels up is <public_html>,
 * and its parent's "akinal-private/akinal-backup" sibling is the target) — no
 * cPanel username, no absolute /home/<user>/ path is ever required or assumed.
 *
 * The resolved path itself is intentionally never included in any exception
 * message, log line, API response, or manifest — only relative/derived facts
 * (e.g. "writable: yes/no") are ever surfaced.
 */
function backup_private_dir(): string
{
    static $resolved = null;
    if ($resolved !== null) {
        return $resolved;
    }

    $publicHtml = realpath(dirname(__DIR__, 2));
    if ($publicHtml === false) {
        throw new RuntimeException('Uygulama kök dizini çözümlenemedi.');
    }

    $dir = dirname($publicHtml) . DIRECTORY_SEPARATOR . 'akinal-private' . DIRECTORY_SEPARATOR . 'akinal-backup';

    if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) {
        throw new RuntimeException(
            'Özel yedekleme klasörü bulunamadı. FTP ile public_html klasörünün yanına ' .
            'akinal-private/akinal-backup klasörünü oluşturun (bkz. docs/BACKUP_CENTER_SETUP.md).'
        );
    }

    $resolved = $dir;
    return $resolved;
}

function backup_work_dir(): string
{
    $dir = backup_private_dir() . '/work';
    if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) {
        throw new RuntimeException('Backup work directory could not be created.');
    }
    return $dir;
}

function backup_staging_dir(): string
{
    $dir = backup_private_dir() . '/restore-staging';
    if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) {
        throw new RuntimeException('Restore staging directory could not be created.');
    }
    return $dir;
}

function backup_log_dir(): string
{
    $dir = backup_private_dir() . '/logs';
    if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) {
        throw new RuntimeException('Backup log directory could not be created.');
    }
    return $dir;
}

function backup_log(string $line): void
{
    // UTC throughout — the daily job runs unattended and its package names are
    // already UTC-stamped, so log timestamps must line up with them exactly.
    $file = backup_log_dir() . '/backup-' . gmdate('Y-m') . '.log';
    @file_put_contents($file, '[' . gmdate('c') . '] ' . $line . PHP_EOL, FILE_APPEND | LOCK_EX);
}

function backup_rrmdir(string $dir): void
{
    if (!is_dir($dir)) {
        return;
    }
    $items = scandir($dir) ?: [];
    foreach ($items as $item) {
        if ($item === '.' || $item === '..') {
            continue;
        }
        $path = $dir . '/' . $item;
        if (is_dir($path) && !is_link($path)) {
            backup_rrmdir($path);
        } else {
            @unlink($path);
        }
    }
    @rmdir($dir);
}

// ── Private Google Drive configuration ───────────────────────────────────────

/**
 * Loads akinal-private/akinal-backup/backup-config.local.php (a plain
 * `return [...]` file, uploaded there by FTP — never inside public_html, never
 * committed). Absent/unreadable/malformed file is treated the same as "not
 * configured yet", not a fatal error, since this file is expected to not exist
 * until an admin has completed the FTP setup steps in docs/BACKUP_CENTER_SETUP.md.
 */
function backup_drive_config(): array
{
    static $cfg = null;
    if ($cfg !== null) {
        return $cfg;
    }

    $configFile = backup_private_dir() . '/backup-config.local.php';
    $raw = is_file($configFile) ? (include $configFile) : null;
    $data = is_array($raw) ? $raw : [];

    $folderId = trim((string) ($data['GOOGLE_DRIVE_BACKUP_FOLDER_ID'] ?? ''));
    $credentialsRaw = trim((string) ($data['GOOGLE_DRIVE_CREDENTIALS_PATH'] ?? ''));

    $credentialsPath = null;
    if ($credentialsRaw !== '') {
        $credentialsPath = backup_pure_is_absolute_path($credentialsRaw)
            ? $credentialsRaw
            : backup_private_dir() . '/' . ltrim($credentialsRaw, '/\\');
    }

    // BACKUP_ENCRYPTION_KEY's primary, documented home is a define() in
    // public_html/api/config.php — but admins naturally also try putting every
    // backup-related secret in this one private file. Read it here too (as a
    // fallback only) so a key placed in either location works, instead of
    // silently doing nothing and failing every run at the prerequisites stage.
    $encryptionKey = trim((string) ($data['BACKUP_ENCRYPTION_KEY'] ?? ''));

    // Same fallback pattern for the success-notification email settings: their
    // primary, documented home is public_html/api/config.php, but this private
    // file is also read so an admin can keep every backup-related secret in
    // one place instead of splitting them across two files.
    $resendApiKey = trim((string) ($data['RESEND_API_KEY'] ?? ''));
    $resendFromEmail = trim((string) ($data['RESEND_FROM_EMAIL'] ?? ''));
    $successNotificationEmail = trim((string) ($data['BACKUP_SUCCESS_NOTIFICATION_EMAIL'] ?? ''));

    // BACKUP_CRON_TOKEN: the bearer token an external scheduler (GitHub
    // Actions) presents to backup-cron.php. This private file is its primary
    // documented home (see backup-config.local.example.php) — a define() in
    // config.php is also supported, same dual-source pattern as every other
    // secret here, but is not required.
    $cronToken = trim((string) ($data['BACKUP_CRON_TOKEN'] ?? ''));

    $cfg = [
        'folder_id' => $folderId,
        'credentials_path' => $credentialsPath,
        'encryption_key' => $encryptionKey !== '' ? $encryptionKey : null,
        'resend_api_key' => $resendApiKey !== '' ? $resendApiKey : null,
        'resend_from_email' => $resendFromEmail !== '' ? $resendFromEmail : null,
        'success_notification_email' => $successNotificationEmail !== '' ? $successNotificationEmail : null,
        'cron_token' => $cronToken !== '' ? $cronToken : null,
    ];
    return $cfg;
}

/**
 * Resolves the configured backup encryption key from either of its two
 * supported sources: the BACKUP_ENCRYPTION_KEY constant in config.php
 * (primary/documented), or the same-named entry in the private
 * backup-config.local.php (fallback). Returns null if neither is set.
 */
function backup_encryption_key_source(): ?string
{
    if (defined('BACKUP_ENCRYPTION_KEY') && BACKUP_ENCRYPTION_KEY !== '') {
        return (string) BACKUP_ENCRYPTION_KEY;
    }
    return backup_drive_config()['encryption_key'];
}

/**
 * Resolves the Resend API key from either config.php (constant) or the
 * private backup-config.local.php (fallback), same pattern as
 * backup_encryption_key_source(). Returns null if neither is set — the
 * success email is then skipped entirely (backup_send_success_email()).
 */
function backup_resend_api_key_source(): ?string
{
    if (defined('RESEND_API_KEY') && RESEND_API_KEY !== '') {
        return (string) RESEND_API_KEY;
    }
    return backup_drive_config()['resend_api_key'];
}

/**
 * Resolves the Resend "from" sender address from either config.php or the
 * private backup-config.local.php, falling back to Resend's own shared
 * sandbox sender ('onboarding@resend.dev', test-only — see
 * config.example.php) only if neither is configured.
 */
function backup_resend_from_email_source(): string
{
    if (defined('RESEND_FROM_EMAIL') && RESEND_FROM_EMAIL !== '') {
        return (string) RESEND_FROM_EMAIL;
    }
    return backup_drive_config()['resend_from_email'] ?? 'onboarding@resend.dev';
}

/**
 * Resolves the success-notification recipient address from either config.php
 * or the private backup-config.local.php. Returns null if neither is set —
 * the success email is then skipped entirely (backup_send_success_email()).
 */
function backup_success_notification_email_source(): ?string
{
    if (defined('BACKUP_SUCCESS_NOTIFICATION_EMAIL') && BACKUP_SUCCESS_NOTIFICATION_EMAIL !== '') {
        return (string) BACKUP_SUCCESS_NOTIFICATION_EMAIL;
    }
    return backup_drive_config()['success_notification_email'];
}

/**
 * Resolves the private bearer token an external scheduler (GitHub Actions)
 * must present to backup-cron.php, from either config.php or the private
 * backup-config.local.php (see backup-config.local.example.php). Returns
 * null if neither is set — backup-cron.php then rejects every request with
 * the same generic 401 it would give an actually-wrong token, since with no
 * token configured no request could ever legitimately be authorized.
 */
function backup_cron_token_source(): ?string
{
    if (defined('BACKUP_CRON_TOKEN') && BACKUP_CRON_TOKEN !== '') {
        return (string) BACKUP_CRON_TOKEN;
    }
    return backup_drive_config()['cron_token'];
}

/**
 * Safe, path-free diagnostic state for the Backup Center UI. Never returns or
 * logs the resolved private directory, the credentials file path, or any raw
 * exception detail — only one of five fixed states plus a fixed Turkish label.
 */
function backup_drive_diagnose(): array
{
    $cfg = backup_drive_config();

    if ($cfg['folder_id'] === '' || $cfg['credentials_path'] === null) {
        return ['state' => 'not_configured', 'message' => 'Drive yapılandırılmadı.'];
    }

    if (!is_file($cfg['credentials_path']) || !is_readable($cfg['credentials_path'])) {
        return ['state' => 'credentials_problem', 'message' => 'Kimlik bilgisi dosyası eksik, okunamıyor veya bozuk.'];
    }

    $keyData = json_decode((string) @file_get_contents($cfg['credentials_path']), true);
    if (!is_array($keyData) || empty($keyData['private_key']) || empty($keyData['client_email'])) {
        return ['state' => 'credentials_problem', 'message' => 'Kimlik bilgisi dosyası eksik, okunamıyor veya bozuk.'];
    }

    try {
        gdrive_access_token();
    } catch (Throwable $exception) {
        return ['state' => 'auth_failed', 'message' => 'Yetkilendirme başarısız.'];
    }

    try {
        gdrive_get_metadata($cfg['folder_id'], 'id,name');
    } catch (Throwable $exception) {
        return ['state' => 'folder_inaccessible', 'message' => 'Yapılandırılan klasöre erişilemiyor.'];
    }

    return ['state' => 'connected', 'message' => 'Bağlantı başarılı.'];
}

// ── Capability probing ───────────────────────────────────────────────────────

function backup_disabled_functions(): array
{
    $raw = (string) ini_get('disable_functions');
    return $raw === '' ? [] : array_map('trim', explode(',', $raw));
}

function backup_function_usable(string $name): bool
{
    return function_exists($name) && !in_array($name, backup_disabled_functions(), true);
}

/**
 * Best-effort, non-destructive check for whether the mysqldump binary is actually
 * reachable (not just whether exec() is enabled) — runs `mysqldump --version` only.
 */
function backup_mysqldump_binary_present(): bool
{
    if (!backup_function_usable('exec')) {
        return false;
    }
    $returnVar = 1;
    @exec('mysqldump --version 2>&1', $unused, $returnVar);
    return $returnVar === 0;
}

function backup_capabilities(): array
{
    $execUsable = backup_function_usable('exec');
    $mysqldumpPresent = $execUsable && backup_mysqldump_binary_present();

    $dbDumpMethod = $mysqldumpPresent
        ? 'mysqldump (tercih edilen, tam yedek: şema + veri + tetikleyici/yordam/olay)'
        : ($execUsable
            ? 'PDO fallback (mysqldump PATH üzerinde bulunamadı) — tetikleyici/yordam/olay izin kısıtlarına tabi'
            : 'PDO fallback (exec() devre dışı) — tetikleyici/yordam/olay izin kısıtlarına tabi');

    $driveConfig = backup_drive_config();

    return [
        'zip_extension' => extension_loaded('zip'),
        'openssl_extension' => extension_loaded('openssl'),
        'curl_extension' => extension_loaded('curl'),
        'exec_available' => $execUsable,
        'mysqldump_available' => $mysqldumpPresent,
        'mail_function' => backup_function_usable('mail'),
        'encryption_key_configured' => backup_encryption_key_source() !== null,
        'gdrive_configured' => $driveConfig['folder_id'] !== '' && $driveConfig['credentials_path'] !== null
            && is_file($driveConfig['credentials_path']),
        'alert_email_configured' => defined('BACKUP_ALERT_EMAIL') && BACKUP_ALERT_EMAIL !== '',
        'success_email_configured' => backup_success_notification_email_source() !== null
            && backup_resend_api_key_source() !== null,
        'db_dump_method' => $dbDumpMethod,
    ];
}

/**
 * Fails fast with a clear, specific message before any backup work starts, instead
 * of failing deep inside archiving/upload with a confusing error. Disk-space checks
 * are best-effort (disk_free_space() can be disabled/unavailable on some hosts).
 */
function backup_assert_prerequisites(int $estimatedBytesNeeded): void
{
    $problems = [];
    if (!extension_loaded('zip')) {
        $problems[] = 'PHP ZipArchive uzantısı (ext-zip) etkin değil — site arşivi oluşturulamaz.';
    }
    if (!extension_loaded('openssl')) {
        $problems[] = 'PHP OpenSSL uzantısı etkin değil — yedekler şifrelenemez.';
    }
    if (!extension_loaded('curl')) {
        $problems[] = 'PHP cURL uzantısı etkin değil — Google Drive yüklemesi yapılamaz.';
    }
    if (backup_encryption_key_source() === null) {
        $problems[] = 'BACKUP_ENCRYPTION_KEY yapılandırılmamış.';
    }

    $dir = backup_private_dir();
    if (!is_writable($dir)) {
        $problems[] = 'Özel yedekleme klasörüne yazılamıyor (izinleri kontrol edin).';
    }

    if (function_exists('disk_free_space')) {
        $free = @disk_free_space($dir);
        if ($free !== false) {
            $needed = (int) ($estimatedBytesNeeded * 1.3); // headroom for temp copies during archive+encrypt
            if ($free < $needed) {
                $problems[] = sprintf(
                    'Yetersiz disk alanı: ~%s gerekli, ~%s boş.',
                    backup_format_bytes($needed),
                    backup_format_bytes((int) $free)
                );
            }
        }
    }

    if ($problems) {
        throw new RuntimeException(implode(' ', $problems));
    }
}

function backup_format_bytes(int $bytes): string
{
    $units = ['B', 'KB', 'MB', 'GB', 'TB'];
    $value = (float) $bytes;
    $i = 0;
    while ($value >= 1024 && $i < count($units) - 1) {
        $value /= 1024;
        $i++;
    }
    return round($value, 1) . ' ' . $units[$i];
}

/**
 * Fast size estimate of everything the frontend/backend/uploads archives will
 * actually read — public_html/ plus the private frontend-source mirror (if
 * present), minus the same excluded VCS/cache/dependency paths
 * backup_pure_is_excluded_from_archive() skips. Never touches the cPanel
 * account root. No compression; used only for the disk-space prerequisite
 * check, not for the archives themselves.
 */
function backup_estimate_site_size(): int
{
    $total = 0;

    $publicHtmlRoot = realpath(dirname(__DIR__, 2));
    if ($publicHtmlRoot !== false) {
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($publicHtmlRoot, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::LEAVES_ONLY
        );
        foreach ($iterator as $file) {
            /** @var SplFileInfo $file */
            if (!$file->isLink()) {
                $total += $file->getSize();
            }
        }
    }

    $sourceDir = backup_frontend_source_dir();
    if (is_dir($sourceDir)) {
        $srcIterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($sourceDir, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::LEAVES_ONLY
        );
        foreach ($srcIterator as $file) {
            /** @var SplFileInfo $file */
            if (!$file->isLink()) {
                $total += $file->getSize();
            }
        }
    }

    return $total;
}

/**
 * Estimate of the database's on-disk size via information_schema, used only for
 * the disk-space prerequisite check.
 */
function backup_estimate_database_size(): int
{
    try {
        $stmt = db()->prepare('SELECT SUM(data_length + index_length) AS total FROM information_schema.tables WHERE table_schema = :db');
        $stmt->execute(['db' => DB_NAME]);
        return (int) ($stmt->fetchColumn() ?: 0);
    } catch (Throwable $exception) {
        return 0;
    }
}

function backup_retention_count(): int
{
    return defined('BACKUP_RETENTION_COUNT') ? max(1, (int) BACKUP_RETENTION_COUNT) : 30;
}

// ── Ledger tables (additive only, never touches finance/auth tables) ────────

function backup_ensure_tables(): void
{
    static $done = false;
    if ($done) {
        return;
    }

    db()->exec("CREATE TABLE IF NOT EXISTS ak_backup_runs (
        id CHAR(36) NOT NULL PRIMARY KEY,
        run_type VARCHAR(32) NOT NULL,
        status VARCHAR(16) NOT NULL,
        started_at DATETIME NOT NULL,
        finished_at DATETIME NULL,
        package_name VARCHAR(191) NULL,
        site_archive_size BIGINT UNSIGNED NULL,
        db_archive_size BIGINT UNSIGNED NULL,
        backend_archive_size BIGINT UNSIGNED NULL,
        uploads_archive_size BIGINT UNSIGNED NULL,
        total_size BIGINT UNSIGNED NULL,
        checksum_site CHAR(64) NULL,
        checksum_db CHAR(64) NULL,
        checksum_backend CHAR(64) NULL,
        checksum_uploads CHAR(64) NULL,
        drive_folder_id VARCHAR(191) NULL,
        drive_folder_name VARCHAR(191) NULL,
        db_dump_method VARCHAR(32) NULL,
        error_message TEXT NULL,
        success_email_sent_at DATETIME NULL,
        notification_status VARCHAR(32) NULL,
        notification_detail VARCHAR(255) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    // Additive column for deployments where ak_backup_runs already existed before
    // the success-notification email feature was introduced (CREATE TABLE IF NOT
    // EXISTS above is a no-op on an existing table, so this covers that case).
    $hasEmailColumn = (int) db()->query(
        "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() "
        . "AND TABLE_NAME = 'ak_backup_runs' AND COLUMN_NAME = 'success_email_sent_at'"
    )->fetchColumn();
    if ($hasEmailColumn === 0) {
        db()->exec('ALTER TABLE ak_backup_runs ADD COLUMN success_email_sent_at DATETIME NULL AFTER error_message');
    }

    // Same additive pattern for the backend-archive columns introduced when the
    // single combined site archive was split into frontend/backend archives.
    // site_archive_size/checksum_site now record the FRONTEND archive.
    $hasBackendColumn = (int) db()->query(
        "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() "
        . "AND TABLE_NAME = 'ak_backup_runs' AND COLUMN_NAME = 'backend_archive_size'"
    )->fetchColumn();
    if ($hasBackendColumn === 0) {
        db()->exec('ALTER TABLE ak_backup_runs ADD COLUMN backend_archive_size BIGINT UNSIGNED NULL AFTER db_archive_size');
        db()->exec('ALTER TABLE ak_backup_runs ADD COLUMN checksum_backend CHAR(64) NULL AFTER checksum_db');
    }

    // Same additive pattern again for the uploads-archive columns introduced
    // when uploads/ was split out of the frontend archive into its own.
    $hasUploadsColumn = (int) db()->query(
        "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() "
        . "AND TABLE_NAME = 'ak_backup_runs' AND COLUMN_NAME = 'uploads_archive_size'"
    )->fetchColumn();
    if ($hasUploadsColumn === 0) {
        db()->exec('ALTER TABLE ak_backup_runs ADD COLUMN uploads_archive_size BIGINT UNSIGNED NULL AFTER backend_archive_size');
        db()->exec('ALTER TABLE ak_backup_runs ADD COLUMN checksum_uploads CHAR(64) NULL AFTER checksum_backend');
    }

    // Additive columns for the admin-only, non-sensitive per-package
    // notification diagnostic: one of notification_sent / notification_failed
    // / notification_not_configured, plus a short sanitized reason (Resend
    // HTTP status and/or message id — never a raw payload, header, or key).
    $hasNotificationStatusColumn = (int) db()->query(
        "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() "
        . "AND TABLE_NAME = 'ak_backup_runs' AND COLUMN_NAME = 'notification_status'"
    )->fetchColumn();
    if ($hasNotificationStatusColumn === 0) {
        db()->exec('ALTER TABLE ak_backup_runs ADD COLUMN notification_status VARCHAR(32) NULL AFTER success_email_sent_at');
        db()->exec('ALTER TABLE ak_backup_runs ADD COLUMN notification_detail VARCHAR(255) NULL AFTER notification_status');
    }

    db()->exec("CREATE TABLE IF NOT EXISTS ak_backup_audit_log (
        id CHAR(36) NOT NULL PRIMARY KEY,
        admin_id CHAR(36) NULL,
        admin_email VARCHAR(191) NULL,
        action VARCHAR(64) NOT NULL,
        detail TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $done = true;
}

function backup_audit(?array $admin, string $action, ?string $detail = null): void
{
    backup_ensure_tables();
    // created_at is written explicitly in UTC (matching every other backup
    // timestamp — started_at, package name) rather than relying on MySQL's
    // CURRENT_TIMESTAMP default, which reflects the DB server's local
    // timezone. Without this, the frontend's single UTC->Europe/Istanbul
    // converter double-applies the +3h offset to an already-local value,
    // producing a 3-hour-inconsistent audit timestamp (P2-4).
    $stmt = db()->prepare('INSERT INTO ak_backup_audit_log (id, admin_id, admin_email, action, detail, created_at) VALUES (:id, :admin_id, :admin_email, :action, :detail, :created_at)');
    $stmt->execute([
        'id' => uuid_v4(),
        'admin_id' => $admin['id'] ?? null,
        'admin_email' => $admin['email'] ?? null,
        'action' => $action,
        'detail' => $detail,
        'created_at' => gmdate('Y-m-d H:i:s'),
    ]);
}

function backup_start_run(string $runType): string
{
    backup_ensure_tables();
    $id = uuid_v4();
    $stmt = db()->prepare('INSERT INTO ak_backup_runs (id, run_type, status, started_at) VALUES (:id, :type, :status, :started)');
    // UTC, to match the UTC-stamped package names/manifests this run produces.
    $stmt->execute(['id' => $id, 'type' => $runType, 'status' => 'running', 'started' => gmdate('Y-m-d H:i:s')]);
    return $id;
}

function backup_finish_run(string $id, string $status, array $fields = []): void
{
    $fields['status'] = $status;
    $fields['finished_at'] = gmdate('Y-m-d H:i:s');

    $columns = ['status', 'finished_at', 'package_name', 'site_archive_size', 'db_archive_size', 'backend_archive_size', 'uploads_archive_size', 'total_size', 'checksum_site', 'checksum_db', 'checksum_backend', 'checksum_uploads', 'drive_folder_id', 'drive_folder_name', 'db_dump_method', 'error_message'];
    $sets = [];
    $params = ['id' => $id];
    foreach ($columns as $column) {
        if (array_key_exists($column, $fields)) {
            $sets[] = "`{$column}` = :{$column}";
            $params[$column] = $fields[$column];
        }
    }
    if (!$sets) {
        return;
    }
    $sql = 'UPDATE ak_backup_runs SET ' . implode(', ', $sets) . ' WHERE id = :id';
    db()->prepare($sql)->execute($params);
}

// ── Checksums & encryption ───────────────────────────────────────────────────

function backup_checksum_file(string $path): string
{
    $hash = hash_file('sha256', $path);
    if ($hash === false) {
        throw new RuntimeException('Checksum failed for ' . basename($path));
    }
    return $hash;
}

function backup_encryption_key(): string
{
    $key = backup_encryption_key_source();
    if ($key === null) {
        throw new RuntimeException('BACKUP_ENCRYPTION_KEY is not configured.');
    }
    return hash('sha256', $key, true);
}

/**
 * AES-256-CBC with a random IV prefixed to the ciphertext (first 16 bytes of the
 * output file). Streams the source file in fixed-size, block-aligned chunks so a
 * multi-gigabyte site/database archive never has to fit in PHP's memory limit —
 * only one chunk (1 MiB) plus small buffers are ever held in memory at a time.
 *
 * CBC chaining across chunks is done manually: each chunk after the first is
 * encrypted using the last 16 bytes of the previous chunk's ciphertext as its IV,
 * with padding disabled for all but the final chunk (which gets normal PKCS7
 * padding). The resulting byte stream is bit-for-bit identical to encrypting the
 * whole file in one call, so standard single-shot AES-256-CBC decryption (e.g.
 * `openssl enc -d -aes-256-cbc`) works unchanged on the output.
 */
function backup_encrypt_file(string $srcPath, string $destPath): void
{
    $key = backup_encryption_key();
    $iv = random_bytes(16);

    $in = fopen($srcPath, 'rb');
    $out = fopen($destPath, 'wb');
    if ($in === false || $out === false) {
        throw new RuntimeException('Could not open ' . basename($srcPath) . ' for streaming encryption.');
    }

    if (fwrite($out, $iv) === false) {
        fclose($in);
        fclose($out);
        throw new RuntimeException('Could not write IV to ' . basename($destPath) . '.');
    }

    $chunkSize = 1024 * 1024; // 1 MiB, a multiple of the 16-byte AES block size
    $chainIv = $iv;

    try {
        while (!feof($in)) {
            $chunk = fread($in, $chunkSize);
            if ($chunk === false) {
                throw new RuntimeException('Read error while encrypting ' . basename($srcPath) . '.');
            }
            $isLastChunk = feof($in);
            $options = OPENSSL_RAW_DATA | ($isLastChunk ? 0 : OPENSSL_ZERO_PADDING);

            $cipherChunk = openssl_encrypt($chunk, 'aes-256-cbc', $key, $options, $chainIv);
            if ($cipherChunk === false) {
                throw new RuntimeException('Encryption failed.');
            }
            if (fwrite($out, $cipherChunk) === false) {
                throw new RuntimeException('Could not write encrypted data to ' . basename($destPath) . '.');
            }
            $chainIv = substr($cipherChunk, -16);
        }
    } finally {
        fclose($in);
        fclose($out);
    }
}

// ── Site archive ──────────────────────────────────────────────────────────────

/**
 * Archives the full public_html tree (including uploads, which lives inside it)
 * into a single ZIP file at $destPath (ZIP's own internal DEFLATE compression —
 * this is never additionally gzipped; a gzip-wrapped ZIP gains nothing and would
 * make the "public_html.zip.enc" naming inaccurate). Requires ext-zip.
 */
function backup_build_site_archive(string $destPath): array
{
    if (!extension_loaded('zip')) {
        throw new RuntimeException('PHP ZipArchive extension (ext-zip) is not available on this host; site archiving is unsupported until it is enabled.');
    }

    $sourceRoot = realpath(dirname(__DIR__, 2)); // public_html/
    if ($sourceRoot === false) {
        throw new RuntimeException('Could not resolve public_html path.');
    }

    $zip = new ZipArchive();
    if ($zip->open($destPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
        throw new RuntimeException('Could not create site archive.');
    }
    $zip->setCompressionIndex(0, ZipArchive::CM_DEFAULT, 6);

    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($sourceRoot, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::LEAVES_ONLY
    );

    foreach ($iterator as $file) {
        /** @var SplFileInfo $file */
        if ($file->isLink()) {
            continue; // never follow symlinks into the package
        }
        $localPath = str_replace('\\', '/', substr($file->getPathname(), strlen($sourceRoot) + 1));
        $zip->addFile($file->getPathname(), 'public_html/' . $localPath);
    }

    $zip->close();

    return [
        'path' => $destPath,
        'size' => filesize($destPath) ?: 0,
        'checksum' => backup_checksum_file($destPath),
    ];
}

/**
 * Classifies a public_html-relative path as 'backend' (api/) or 'uploads'
 * (uploads/) — the two archives still built by walking public_html/ alone
 * via backup_build_split_site_archive() below. (The frontend archive is no
 * longer one of these categories: it walks the whole repo root instead — see
 * backup_build_frontend_archive() — so this function only needs to route
 * backend vs. uploads content; anything else returns 'frontend' but that
 * branch is never passed to backup_build_split_site_archive() anymore.)
 */
function backup_pure_archive_category(string $relativePath): string
{
    if (strncmp($relativePath, 'api/', 4) === 0) {
        return 'backend';
    }
    if (strncmp($relativePath, 'uploads/', 8) === 0) {
        return 'uploads';
    }
    return 'frontend';
}

/**
 * Shared implementation behind backup_build_backend_archive() and
 * backup_build_uploads_archive(): walks the public_html tree exactly once and
 * routes each file into the ZIP only if it belongs to $category
 * (backup_pure_archive_category(), 'backend' or 'uploads') and is not one of
 * the excluded infrastructure-secret/build-cache paths
 * (backup_pure_is_excluded_from_archive()). This is a disaster-recovery
 * package, so application config files (config.php, config.local.php, .env*)
 * are deliberately NOT excluded — see backup_pure_is_excluded_from_archive()
 * for exactly what is. Symlinks are never followed.
 */
function backup_build_split_site_archive(string $destPath, string $category): array
{
    if (!extension_loaded('zip')) {
        throw new RuntimeException('PHP ZipArchive extension (ext-zip) is not available on this host; site archiving is unsupported until it is enabled.');
    }

    $sourceRoot = realpath(dirname(__DIR__, 2)); // public_html/
    if ($sourceRoot === false) {
        throw new RuntimeException('Could not resolve public_html path.');
    }

    $zip = new ZipArchive();
    if ($zip->open($destPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
        throw new RuntimeException('Could not create archive.');
    }
    $zip->setCompressionIndex(0, ZipArchive::CM_DEFAULT, 6);

    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($sourceRoot, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::LEAVES_ONLY
    );

    foreach ($iterator as $file) {
        /** @var SplFileInfo $file */
        if ($file->isLink()) {
            continue; // never follow symlinks into the package
        }
        $localPath = str_replace('\\', '/', substr($file->getPathname(), strlen($sourceRoot) + 1));
        if (backup_pure_archive_category($localPath) !== $category) {
            continue;
        }
        if (backup_pure_is_excluded_from_archive($localPath)) {
            continue;
        }
        // config.php/config.local.php are recovery-required and never
        // excluded, but may themselves define BACKUP_ENCRYPTION_KEY — which
        // must never be stored inside any backup archive (it would let the
        // key that decrypts this very archive travel alongside it). Redact
        // only that one value; every other config constant is preserved.
        if ($category === 'backend' && ($localPath === 'api/config.php' || $localPath === 'api/config.local.php')) {
            $redacted = backup_pure_redact_encryption_key((string) file_get_contents($file->getPathname()));
            $zip->addFromString('public_html/' . $localPath, $redacted);
            continue;
        }
        $zip->addFile($file->getPathname(), 'public_html/' . $localPath);
    }

    $zip->close();

    return [
        'path' => $destPath,
        'size' => filesize($destPath) ?: 0,
        'checksum' => backup_checksum_file($destPath),
    ];
}

/**
 * Resolves the private, non-web-accessible frontend-source mirror path:
 * akinal-private/frontend-source/ (sibling of akinal-private/akinal-backup/,
 * both under akinal-private/). Populated by the FTP deploy tooling
 * (scripts/deploy_ftp.py, sync_frontend_source_mirror()) on every normal
 * deploy — NOT by this backup code, which only ever READS it.
 *
 * This exists specifically so backup_build_frontend_archive() never has to
 * walk the cPanel account root: a production audit proved the account root
 * (i) never contains the frontend's source tree (deploy tooling never pushed
 * it there) and (ii) contains unrelated/sensitive account-level content
 * (.htpasswd, logs/, stats/, private_html/, public_ftp/) that must never be
 * swept into a backup archive.
 */
function backup_frontend_source_dir(): string
{
    return dirname(backup_private_dir()) . '/frontend-source';
}

/**
 * Frontend backup archive: a FULL, rebuildable frontend application backup,
 * assembled from exactly two known-safe sources — NEVER the cPanel account
 * root:
 *   (a) the deployed production output under public_html/, EXCEPT api/
 *       (→ backend.zip.enc) and uploads/ (→ uploads.zip.enc), kept under a
 *       'public_html/...' prefix in the ZIP so it extracts back to the same
 *       layout;
 *   (b) the private frontend-source mirror at akinal-private/frontend-source/
 *       (see backup_frontend_source_dir()) — src/, public/, package.json,
 *       package-lock.json, vite.config.ts, tsconfig*.json, index.html, and
 *       the other root build/config files the deploy tooling mirrors there —
 *       kept at the ZIP root with its natural relative path (src/..., etc.)
 *       so it can be extracted directly into a fresh checkout and rebuilt
 *       with `npm install && npm run build`.
 * If the mirror directory doesn't exist yet (deploy tooling never run since
 * this feature shipped), the archive still succeeds with (a) alone — logged,
 * never a hard failure — rather than blocking the whole backup run.
 */
function backup_build_frontend_archive(string $destPath): array
{
    if (!extension_loaded('zip')) {
        throw new RuntimeException('PHP ZipArchive extension (ext-zip) is not available on this host; site archiving is unsupported until it is enabled.');
    }

    $publicHtmlRoot = realpath(dirname(__DIR__, 2));
    if ($publicHtmlRoot === false) {
        throw new RuntimeException('Could not resolve public_html path.');
    }

    $zip = new ZipArchive();
    if ($zip->open($destPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
        throw new RuntimeException('Could not create archive.');
    }
    $zip->setCompressionIndex(0, ZipArchive::CM_DEFAULT, 6);

    // (a) Deployed production output, excluding api/ and uploads/.
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($publicHtmlRoot, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::LEAVES_ONLY
    );
    foreach ($iterator as $file) {
        /** @var SplFileInfo $file */
        if ($file->isLink()) {
            continue;
        }
        $localPath = str_replace('\\', '/', substr($file->getPathname(), strlen($publicHtmlRoot) + 1));
        if (strncmp($localPath, 'api/', 4) === 0 || strncmp($localPath, 'uploads/', 8) === 0) {
            continue;
        }
        if (backup_pure_is_excluded_from_archive($localPath)) {
            continue;
        }
        $zip->addFile($file->getPathname(), 'public_html/' . $localPath);
    }

    // (b) Private, rebuildable frontend source mirror.
    $sourceDir = backup_frontend_source_dir();
    if (is_dir($sourceDir)) {
        $srcIterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($sourceDir, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::LEAVES_ONLY
        );
        foreach ($srcIterator as $file) {
            /** @var SplFileInfo $file */
            if ($file->isLink()) {
                continue;
            }
            $localPath = str_replace('\\', '/', substr($file->getPathname(), strlen($sourceDir) + 1));
            if (backup_pure_is_excluded_from_archive($localPath)) {
                continue;
            }
            $zip->addFile($file->getPathname(), $localPath);
        }
    } else {
        backup_log('Frontend source mirror not found at akinal-private/frontend-source — frontend.zip.enc contains deployed output only for this run, not rebuildable source. Run the deploy tooling (scripts/deploy_ftp.py) at least once to populate it.');
    }

    $zip->close();

    return [
        'path' => $destPath,
        'size' => filesize($destPath) ?: 0,
        'checksum' => backup_checksum_file($destPath),
    ];
}

/**
 * Backend backup archive: public_html/api/ in full (config.php and
 * config.local.php included — required for recovery — but with
 * BACKUP_ENCRYPTION_KEY redacted from their content before archiving; see
 * backup_pure_redact_encryption_key()), PLUS an explicit allowlist of exactly
 * two recovery-required private files — NEVER all of akinal-private/ walked
 * blindly, which also holds working files, logs, and restore-staging data
 * that must never enter a backup:
 *   - akinal-private/akinal-backup/backup-config.local.php (Drive folder ID
 *     + credentials path; also redacted, since it can optionally carry a
 *     BACKUP_ENCRYPTION_KEY fallback value)
 *   - the configured Google Drive service-account credential JSON file
 *     (kept as-is — it is a Drive secret, not the backup's own encryption
 *     key, so embedding it inside the archive that key encrypts is not
 *     self-defeating the way embedding the encryption key itself would be)
 */
function backup_build_backend_archive(string $destPath): array
{
    backup_build_split_site_archive($destPath, 'backend');

    $zip = new ZipArchive();
    if ($zip->open($destPath, ZipArchive::CREATE) !== true) {
        throw new RuntimeException('Could not reopen backend archive to add private recovery files.');
    }

    $privateDir = backup_private_dir(); // akinal-private/akinal-backup
    $driveConfig = backup_drive_config();

    $backupConfigPath = $privateDir . '/backup-config.local.php';
    if (is_file($backupConfigPath)) {
        $redacted = backup_pure_redact_encryption_key((string) file_get_contents($backupConfigPath));
        $zip->addFromString('akinal-private/akinal-backup/backup-config.local.php', $redacted);
    }

    if ($driveConfig['credentials_path'] !== null && is_file($driveConfig['credentials_path'])) {
        $credPath = $driveConfig['credentials_path'];
        $normalizedCred = str_replace('\\', '/', $credPath);
        $normalizedPrivate = str_replace('\\', '/', $privateDir);
        $entryName = strncmp($normalizedCred, $normalizedPrivate, strlen($normalizedPrivate)) === 0
            ? 'akinal-private/akinal-backup' . substr($normalizedCred, strlen($normalizedPrivate))
            : 'akinal-private/' . basename($credPath);
        $zip->addFile($credPath, $entryName);
    }

    $zip->close();

    return [
        'path' => $destPath,
        'size' => filesize($destPath) ?: 0,
        'checksum' => backup_checksum_file($destPath),
    ];
}

/**
 * Uploads backup archive: public_html/uploads/ only — customer, project,
 * media and document files under the runtime upload directory.
 */
function backup_build_uploads_archive(string $destPath): array
{
    return backup_build_split_site_archive($destPath, 'uploads');
}

// ── Database dump ─────────────────────────────────────────────────────────────

/**
 * Attempts a full mysqldump (schema + data + routines/triggers/events). Returns a
 * result array rather than a bare bool so callers can report *why* it fell back
 * to the PDO dumper instead of silently mislabeling a degraded backup as full.
 */
function backup_try_mysqldump(string $destPath): array
{
    if (!backup_function_usable('exec')) {
        return ['ok' => false, 'error' => 'exec() bu sunucuda devre dışı.'];
    }
    if (!backup_mysqldump_binary_present()) {
        return ['ok' => false, 'error' => 'mysqldump çalıştırılabilir dosyası PATH üzerinde bulunamadı.'];
    }

    $errLogPath = $destPath . '.mysqldump-stderr.log';
    $cmd = sprintf(
        '%s --single-transaction --routines --triggers --events --default-character-set=utf8mb4 --host=%s --user=%s %s %s > %s 2>%s',
        escapeshellcmd('mysqldump'),
        escapeshellarg(DB_HOST),
        escapeshellarg(DB_USER),
        defined('DB_PASS') && DB_PASS !== '' ? '--password=' . escapeshellarg(DB_PASS) : '',
        escapeshellarg(DB_NAME),
        escapeshellarg($destPath),
        escapeshellarg($errLogPath)
    );

    $returnVar = 1;
    @exec($cmd, $unused, $returnVar);

    $stderr = is_file($errLogPath) ? trim((string) file_get_contents($errLogPath)) : '';
    @unlink($errLogPath);

    $ok = $returnVar === 0 && is_file($destPath) && filesize($destPath) > 0;
    return [
        'ok' => $ok,
        'error' => $ok ? null : ('mysqldump başarısız oldu (exit ' . $returnVar . ')' . ($stderr !== '' ? ": {$stderr}" : '.')),
    ];
}

/**
 * Pure-PDO fallback dumper used whenever mysqldump/exec is unavailable, which is
 * common on shared hosting. Produces a plain, restorable .sql file containing
 * schema (CREATE TABLE) and data (batched INSERTs) unconditionally, plus triggers,
 * stored routines and events on a best-effort basis.
 *
 * Returns a list of human-readable warnings for any of those schema-object
 * categories that could not be exported — most commonly because the DB user lacks
 * privilege to read the relevant SHOW output on shared hosting. A non-empty
 * result means this was NOT a complete full backup and callers must not report
 * it as one.
 */
function backup_pdo_dump_database(string $destPath): array
{
    $warnings = [];
    $pdo = db();
    $fh = fopen($destPath, 'w');
    if ($fh === false) {
        throw new RuntimeException('Could not open database dump file for writing.');
    }

    fwrite($fh, "-- Akinal Insaat PDO fallback database dump\n");
    fwrite($fh, '-- Generated (UTC): ' . gmdate('c') . "\n");
    fwrite($fh, "SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS=0;\nSET SQL_MODE='NO_AUTO_VALUE_ON_ZERO';\n\n");

    $tables = $pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);

    foreach ($tables as $table) {
        $createRow = $pdo->query('SHOW CREATE TABLE `' . $table . '`')->fetch();
        $createSql = $createRow['Create Table'] ?? null;
        if ($createSql === null) {
            continue;
        }
        fwrite($fh, "-- ----------------------------\n-- Table: {$table}\n-- ----------------------------\n");
        fwrite($fh, "DROP TABLE IF EXISTS `{$table}`;\n{$createSql};\n\n");

        $countStmt = $pdo->query('SELECT COUNT(*) FROM `' . $table . '`');
        $rowCount = (int) $countStmt->fetchColumn();
        if ($rowCount === 0) {
            continue;
        }

        $batchSize = 500;
        for ($offset = 0; $offset < $rowCount; $offset += $batchSize) {
            $stmt = $pdo->query('SELECT * FROM `' . $table . '` LIMIT ' . $batchSize . ' OFFSET ' . $offset);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            if (!$rows) {
                break;
            }
            $columns = array_keys($rows[0]);
            $columnList = '`' . implode('`, `', $columns) . '`';
            $valueGroups = [];
            foreach ($rows as $row) {
                $values = array_map(function ($value) use ($pdo) {
                    return $value === null ? 'NULL' : $pdo->quote((string) $value);
                }, $row);
                $valueGroups[] = '(' . implode(', ', $values) . ')';
            }
            fwrite($fh, "INSERT INTO `{$table}` ({$columnList}) VALUES\n" . implode(",\n", $valueGroups) . ";\n");
        }
        fwrite($fh, "\n");
    }

    // Triggers — wrapped individually so a permission error here degrades to a
    // clearly reported warning instead of silently producing an incomplete dump.
    try {
        $triggers = $pdo->query('SHOW TRIGGERS')->fetchAll(PDO::FETCH_ASSOC);
        if ($triggers) {
            fwrite($fh, "-- ----------------------------\n-- Triggers\n-- ----------------------------\nDELIMITER $$\n");
            foreach ($triggers as $trigger) {
                $name = $trigger['Trigger'];
                $createRow = $pdo->query('SHOW CREATE TRIGGER `' . $name . '`')->fetch();
                $createSql = $createRow['SQL Original Statement'] ?? null;
                if ($createSql) {
                    fwrite($fh, "DROP TRIGGER IF EXISTS `{$name}`$$\n{$createSql}$$\n\n");
                } else {
                    $warnings[] = "Tetikleyici dışa aktarılamadı: {$name}";
                }
            }
            fwrite($fh, "DELIMITER ;\n\n");
        }
    } catch (Throwable $exception) {
        $warnings[] = 'Tetikleyiciler dışa aktarılamadı (izin kısıtı olabilir): ' . $exception->getMessage();
    }

    // Stored procedures & functions
    foreach (['PROCEDURE', 'FUNCTION'] as $routineType) {
        try {
            $stmt = $pdo->prepare("SHOW {$routineType} STATUS WHERE Db = :db");
            $stmt->execute(['db' => DB_NAME]);
            $routines = $stmt->fetchAll(PDO::FETCH_ASSOC);
            if (!$routines) {
                continue;
            }
            fwrite($fh, "-- ----------------------------\n-- Stored {$routineType}s\n-- ----------------------------\nDELIMITER $$\n");
            foreach ($routines as $routine) {
                $name = $routine['Name'];
                try {
                    $createRow = $pdo->query("SHOW CREATE {$routineType} `{$name}`")->fetch();
                    $key = $routineType === 'PROCEDURE' ? 'Create Procedure' : 'Create Function';
                    $createSql = $createRow[$key] ?? null;
                    if ($createSql) {
                        fwrite($fh, "DROP {$routineType} IF EXISTS `{$name}`$$\n{$createSql}$$\n\n");
                    } else {
                        $warnings[] = ucfirst(strtolower($routineType)) . " dışa aktarılamadı: {$name}";
                    }
                } catch (Throwable $inner) {
                    $warnings[] = ucfirst(strtolower($routineType)) . " dışa aktarılamadı (izin kısıtı olabilir): {$name}";
                }
            }
            fwrite($fh, "DELIMITER ;\n\n");
        } catch (Throwable $exception) {
            $warnings[] = "Depolanmış {$routineType} listesi alınamadı (izin kısıtı olabilir): " . $exception->getMessage();
        }
    }

    // Events
    try {
        $events = $pdo->query('SHOW EVENTS')->fetchAll(PDO::FETCH_ASSOC);
        if ($events) {
            fwrite($fh, "-- ----------------------------\n-- Events\n-- ----------------------------\nDELIMITER $$\n");
            foreach ($events as $event) {
                $name = $event['Name'];
                $createRow = $pdo->query("SHOW CREATE EVENT `{$name}`")->fetch();
                $createSql = $createRow['Create Event'] ?? null;
                if ($createSql) {
                    fwrite($fh, "DROP EVENT IF EXISTS `{$name}`$$\n{$createSql}$$\n\n");
                } else {
                    $warnings[] = "Olay dışa aktarılamadı: {$name}";
                }
            }
            fwrite($fh, "DELIMITER ;\n\n");
        }
    } catch (Throwable $exception) {
        $warnings[] = 'Olaylar (events) dışa aktarılamadı (izin kısıtı olabilir): ' . $exception->getMessage();
    }

    fwrite($fh, "SET FOREIGN_KEY_CHECKS=1;\n");
    fclose($fh);

    return $warnings;
}

/**
 * Produces a database dump, trying mysqldump first (schema + data + triggers/
 * routines/events, the only method that can be honestly labeled a full backup)
 * and falling back to the PDO dumper when mysqldump isn't usable. The PDO path
 * always exports schema + data, but triggers/routines/events depend on the DB
 * user's privileges — any that fail are collected as warnings. Callers MUST NOT
 * report a run as a full, unqualified success when $result['complete'] is false.
 */
function backup_dump_database(string $destPath): array
{
    $method = 'mysqldump';
    $warnings = [];

    $mysqldumpResult = backup_try_mysqldump($destPath);
    if (!$mysqldumpResult['ok']) {
        $method = 'pdo_fallback';
        $warnings[] = 'mysqldump kullanılamadı, PDO yedekleyiciye geçildi: ' . $mysqldumpResult['error'];
        $warnings = array_merge($warnings, backup_pdo_dump_database($destPath));
    }

    if (!is_file($destPath) || filesize($destPath) === 0) {
        throw new RuntimeException('Database dump produced an empty file.');
    }

    return [
        'path' => $destPath,
        'size' => filesize($destPath) ?: 0,
        'checksum' => backup_checksum_file($destPath),
        'method' => $method,
        'warnings' => $warnings,
        'complete' => empty($warnings),
    ];
}

// ── Gzip helper ────────────────────────────────────────────────────────────────

function backup_gzip_file(string $srcPath, string $destPath): void
{
    $src = fopen($srcPath, 'rb');
    $dest = gzopen($destPath, 'wb9');
    if ($src === false || $dest === false) {
        throw new RuntimeException('Could not compress file.');
    }
    while (!feof($src)) {
        gzwrite($dest, fread($src, 1024 * 1024));
    }
    fclose($src);
    gzclose($dest);
}

// ── Google Drive REST client (service account, no Composer dependency) ──────

function gdrive_access_token(): string
{
    static $cached = null;
    if ($cached !== null && $cached['expires'] > time() + 30) {
        return $cached['token'];
    }

    $driveConfig = backup_drive_config();
    if ($driveConfig['credentials_path'] === null || !is_file($driveConfig['credentials_path'])) {
        throw new RuntimeException('Google Drive service-account key is not configured.');
    }
    $keyData = json_decode((string) file_get_contents($driveConfig['credentials_path']), true);
    if (!is_array($keyData) || empty($keyData['private_key']) || empty($keyData['client_email'])) {
        throw new RuntimeException('Google Drive service-account key file is invalid.');
    }

    $now = time();
    $header = ['alg' => 'RS256', 'typ' => 'JWT'];
    $claims = [
        'iss' => $keyData['client_email'],
        'scope' => 'https://www.googleapis.com/auth/drive',
        'aud' => 'https://oauth2.googleapis.com/token',
        'iat' => $now,
        'exp' => $now + 3600,
    ];
    $segments = [
        rtrim(strtr(base64_encode(json_encode($header)), '+/', '-_'), '='),
        rtrim(strtr(base64_encode(json_encode($claims)), '+/', '-_'), '='),
    ];
    $signInput = implode('.', $segments);
    $signature = '';
    if (!openssl_sign($signInput, $signature, $keyData['private_key'], 'sha256WithRSAEncryption')) {
        throw new RuntimeException('Could not sign Google service-account JWT.');
    }
    $segments[] = rtrim(strtr(base64_encode($signature), '+/', '-_'), '=');
    $jwt = implode('.', $segments);

    $response = backup_curl_request('POST', 'https://oauth2.googleapis.com/token', [
        'Content-Type: application/x-www-form-urlencoded',
    ], http_build_query([
        'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        'assertion' => $jwt,
    ]));

    $payload = json_decode($response['body'], true);
    if ($response['status'] !== 200 || empty($payload['access_token'])) {
        throw new RuntimeException('Google Drive authentication failed: ' . ($payload['error_description'] ?? $response['body']));
    }

    $cached = ['token' => $payload['access_token'], 'expires' => $now + (int) ($payload['expires_in'] ?? 3600)];
    return $cached['token'];
}

function backup_curl_request(string $method, string $url, array $headers = [], ?string $body = null): array
{
    if (!extension_loaded('curl')) {
        throw new RuntimeException('ext-curl is required for Google Drive integration.');
    }
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_TIMEOUT => 120,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    if ($body !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    }
    $result = curl_exec($ch);
    if ($result === false) {
        $error = curl_error($ch);
        curl_close($ch);
        throw new RuntimeException("Google Drive request failed: {$error}");
    }
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['status' => $status, 'body' => (string) $result];
}

function gdrive_create_folder(string $name, string $parentId): string
{
    $token = gdrive_access_token();
    // supportsAllDrives=true is required for any write against a Shared Drive
    // item (creating a folder inside one) — without it, Drive v3 silently
    // rejects operations targeting Shared Drive content for a service account.
    $response = backup_curl_request('POST', 'https://www.googleapis.com/drive/v3/files?fields=id&supportsAllDrives=true', [
        'Authorization: Bearer ' . $token,
        'Content-Type: application/json',
    ], json_encode([
        'name' => $name,
        'mimeType' => 'application/vnd.google-apps.folder',
        'parents' => [$parentId],
    ]));
    $payload = json_decode($response['body'], true);
    if ($response['status'] >= 300 || empty($payload['id'])) {
        throw new RuntimeException('Google Drive folder creation failed: ' . $response['body']);
    }
    return $payload['id'];
}

/**
 * Uploads a file to Google Drive using the resumable upload protocol: a small
 * JSON "start session" request, then a single streamed PUT of the file content.
 * cURL reads the file straight from disk via CURLOPT_INFILE/CURLOPT_UPLOAD — the
 * archive is never assembled as one big string in PHP memory, so this works for
 * multi-gigabyte site/media archives under normal shared-hosting memory limits.
 */
function gdrive_upload_file(string $localPath, string $name, string $parentId): string
{
    $token = gdrive_access_token();
    $size = filesize($localPath);
    if ($size === false) {
        throw new RuntimeException('Could not stat ' . basename($localPath) . ' for upload.');
    }

    // Step 1: start a resumable upload session (small JSON body only).
    $initHeaders = [
        'Authorization: Bearer ' . $token,
        'Content-Type: application/json; charset=UTF-8',
        'X-Upload-Content-Type: application/octet-stream',
        'X-Upload-Content-Length: ' . $size,
    ];
    $initBody = (string) json_encode(['name' => $name, 'parents' => [$parentId]]);
    // supportsAllDrives=true is required to upload into a Shared Drive folder;
    // Google carries this through into the returned resumable session URL, so
    // the PUT in step 2 below does not need to repeat it.
    $init = backup_curl_request_capture_headers(
        'POST',
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id&supportsAllDrives=true',
        $initHeaders,
        $initBody
    );
    if ($init['status'] >= 300) {
        throw new RuntimeException('Google Drive upload session could not be started: ' . $init['body']);
    }
    if (!preg_match('/^Location:\s*(\S+)/mi', $init['headers'], $matches)) {
        throw new RuntimeException('Google Drive did not return a resumable upload session URL.');
    }
    $sessionUrl = trim($matches[1]);

    // Step 2: stream the file content to the session URL in one PUT request.
    // cURL's CURLOPT_INFILE reads the handle in small internal buffers, so this
    // does not load the archive into PHP memory regardless of file size.
    $fh = fopen($localPath, 'rb');
    if ($fh === false) {
        throw new RuntimeException('Could not open ' . basename($localPath) . ' for upload streaming.');
    }

    $ch = curl_init($sessionUrl);
    curl_setopt_array($ch, [
        CURLOPT_PUT => true,
        CURLOPT_INFILE => $fh,
        CURLOPT_INFILESIZE => $size,
        CURLOPT_HTTPHEADER => ['Content-Type: application/octet-stream'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 1800, // large archives on shared hosting can take a while
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $responseBody = curl_exec($ch);
    if ($responseBody === false) {
        $error = curl_error($ch);
        curl_close($ch);
        fclose($fh);
        throw new RuntimeException("Google Drive upload stream failed: {$error}");
    }
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    fclose($fh);

    if ($status >= 300) {
        throw new RuntimeException('Google Drive upload failed (HTTP ' . $status . '): ' . $responseBody);
    }
    $payload = json_decode((string) $responseBody, true);
    if (empty($payload['id'])) {
        throw new RuntimeException('Google Drive upload response did not include a file ID: ' . $responseBody);
    }
    return $payload['id'];
}

/**
 * Same contract as backup_curl_request() but also returns raw response headers,
 * needed to read the Location header from the resumable-upload session start.
 */
function backup_curl_request_capture_headers(string $method, string $url, array $headers = [], ?string $body = null): array
{
    if (!extension_loaded('curl')) {
        throw new RuntimeException('ext-curl is required for Google Drive integration.');
    }
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HEADER => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_TIMEOUT => 120,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    if ($body !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    }
    $result = curl_exec($ch);
    if ($result === false) {
        $error = curl_error($ch);
        curl_close($ch);
        throw new RuntimeException("Google Drive request failed: {$error}");
    }
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $headerSize = (int) curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    curl_close($ch);
    return [
        'status' => $status,
        'headers' => substr((string) $result, 0, $headerSize),
        'body' => substr((string) $result, $headerSize),
    ];
}

function gdrive_list_children(string $parentId, string $mimeFilter = ''): array
{
    $token = gdrive_access_token();
    $query = "'{$parentId}' in parents and trashed = false";
    if ($mimeFilter !== '') {
        $query .= " and mimeType = '{$mimeFilter}'";
    }
    // includeItemsFromAllDrives + supportsAllDrives are both required for a
    // 'x in parents' query to return results when the parent lives on a
    // Shared Drive — otherwise Drive v3 silently returns an empty file list
    // with no error. corpora=drive/driveId are intentionally NOT added here:
    // this query is already scoped to a specific parent folder via `q`, which
    // Google's API does not require corpora/driveId for.
    $url = 'https://www.googleapis.com/drive/v3/files?' . http_build_query([
        'q' => $query,
        'fields' => 'files(id,name,size,createdTime,mimeType,md5Checksum)',
        'orderBy' => 'createdTime',
        'pageSize' => 200,
        'supportsAllDrives' => 'true',
        'includeItemsFromAllDrives' => 'true',
    ]);
    $response = backup_curl_request('GET', $url, ['Authorization: Bearer ' . $token]);
    $payload = json_decode($response['body'], true);
    if ($response['status'] >= 300) {
        throw new RuntimeException('Google Drive listing failed: ' . $response['body']);
    }
    return $payload['files'] ?? [];
}

/**
 * Downloads a Drive file's content into a PHP string. This is intentionally only
 * ever used for the two tiny metadata files in a package (manifest.json and
 * checksums.sha256, both well under 1 KB) — never for the multi-megabyte/gigabyte
 * encrypted archives, which always use the streaming paths (gdrive_upload_file(),
 * gdrive_download_to_stream()) instead.
 */
function gdrive_get_file_content(string $fileId): string
{
    $token = gdrive_access_token();
    $response = backup_curl_request('GET', 'https://www.googleapis.com/drive/v3/files/' . $fileId . '?alt=media&supportsAllDrives=true', ['Authorization: Bearer ' . $token]);
    if ($response['status'] >= 300) {
        throw new RuntimeException('Google Drive file content download failed: ' . $response['body']);
    }
    return $response['body'];
}

/**
 * Strict post-upload verification for a freshly created recovery package folder.
 * Confirms the four expected files exist exactly once, that the two encrypted
 * archives' Drive-reported sizes (and MD5, when Drive supplies one) match the
 * local files exactly, and that the uploaded manifest.json / checksums.sha256
 * content matches this run's own computed values — i.e. the remote package is
 * genuinely this run's output, not a stale, partial, or wrong set of files.
 * Throws on any mismatch; callers must not proceed to retention on failure.
 *
 * $localArchives: [ filename => ['path' => string, 'size' => int, 'sha256' => string] ]
 */
function gdrive_verify_uploaded_package(string $folderId, array $localArchives, array $localManifest): void
{
    $children = gdrive_list_children($folderId);

    $expectedNames = array_merge(['manifest.json', 'checksums.sha256', BACKUP_RECOVERY_DOC_NAME], array_keys($localArchives));
    $childNames = array_map(fn($c) => (string) ($c['name'] ?? ''), $children);
    $filenameIssues = backup_pure_check_package_filenames($childNames, $expectedNames);
    if ($filenameIssues) {
        throw new RuntimeException('Yükleme doğrulaması başarısız: ' . implode('; ', $filenameIssues));
    }

    $childrenByName = [];
    foreach ($children as $child) {
        $childrenByName[(string) $child['name']] = $child;
    }

    // Archive size (and MD5, when Drive reports one) must match the local file exactly.
    foreach ($localArchives as $filename => $local) {
        $remote = $childrenByName[$filename];
        $remoteSize = isset($remote['size']) ? (int) $remote['size'] : null;
        if (backup_pure_archive_size_mismatch($local['size'], $remoteSize)) {
            throw new RuntimeException("Yükleme doğrulaması başarısız: '{$filename}' boyutu uyuşmuyor (yerel {$local['size']}, Drive " . ($remoteSize ?? 'yok') . ').');
        }
        if (!empty($remote['md5Checksum'])) {
            $localMd5 = hash_file('md5', $local['path']);
            if (!hash_equals((string) $remote['md5Checksum'], (string) $localMd5)) {
                throw new RuntimeException("Yükleme doğrulaması başarısız: '{$filename}' MD5 uyuşmuyor.");
            }
        }
    }

    // The uploaded manifest.json and checksums.sha256 must describe THIS run, not
    // a stale/mismatched one — parse and cross-check against local values.
    $remoteManifestRaw = gdrive_get_file_content((string) $childrenByName['manifest.json']['id']);
    $remoteManifest = json_decode($remoteManifestRaw, true);
    if (!is_array($remoteManifest)) {
        throw new RuntimeException('Yükleme doğrulaması başarısız: uzaktaki manifest.json geçerli JSON değil.');
    }
    foreach (['package_version', 'created_at', 'status'] as $key) {
        if (($remoteManifest[$key] ?? null) !== ($localManifest[$key] ?? null)) {
            throw new RuntimeException("Yükleme doğrulaması başarısız: manifest alanı uyuşmuyor ({$key}).");
        }
    }
    foreach ($localArchives as $filename => $local) {
        $remoteChecksumInManifest = $remoteManifest['checksums'][$filename] ?? null;
        if ($remoteChecksumInManifest !== $local['sha256']) {
            throw new RuntimeException("Yükleme doğrulaması başarısız: uzaktaki manifest içindeki checksum uyuşmuyor ({$filename}).");
        }
    }

    $remoteChecksumsRaw = gdrive_get_file_content((string) $childrenByName['checksums.sha256']['id']);
    foreach ($localArchives as $filename => $local) {
        $pattern = '/^' . preg_quote($local['sha256'], '/') . '\s+\*?' . preg_quote($filename, '/') . '$/mi';
        if (!preg_match($pattern, $remoteChecksumsRaw)) {
            throw new RuntimeException("Yükleme doğrulaması başarısız: uzaktaki checksums.sha256 içinde '{$filename}' için beklenen satır bulunamadı.");
        }
    }
}

/**
 * Classifies one of this system's Drive recovery folders for the dashboard and
 * for retention eligibility: only a folder whose manifest.json explicitly says
 * status "complete" counts as a full, retained successful backup. Partial or
 * unreadable packages are surfaced (for diagnosis) but never counted toward the
 * retention limit and never touched by automatic retention cleanup.
 */
function gdrive_classify_backup_folder(array $folder): array
{
    $children = gdrive_list_children((string) $folder['id']);
    $names = array_map(fn($c) => (string) $c['name'], $children);
    $totalSize = array_sum(array_map(fn($c) => (int) ($c['size'] ?? 0), $children));

    $status = 'incomplete';
    $dbDumpMethod = null;
    $checksums = [];
    $requiredNames = ['checksums.sha256', 'manifest.json', BACKUP_RECOVERY_DOC_NAME, BACKUP_FRONTEND_ARCHIVE_NAME, BACKUP_BACKEND_ARCHIVE_NAME, BACKUP_UPLOADS_ARCHIVE_NAME, BACKUP_DB_ARCHIVE_NAME];
    $hasAllRequired = count($children) >= count($requiredNames) && !array_diff($requiredNames, $names);

    if ($hasAllRequired) {
        $status = 'unknown';
        foreach ($children as $child) {
            if ($child['name'] === 'manifest.json') {
                try {
                    $manifest = json_decode(gdrive_get_file_content((string) $child['id']), true);
                    if (is_array($manifest)) {
                        $dbDumpMethod = $manifest['db_dump_method'] ?? null;
                        $checksums = is_array($manifest['checksums'] ?? null) ? $manifest['checksums'] : [];
                        if (($manifest['status'] ?? null) === 'complete') {
                            $status = 'complete';
                        } elseif (($manifest['status'] ?? null) === 'partial') {
                            $status = 'partial';
                        }
                    }
                } catch (Throwable $exception) {
                    $status = 'unknown';
                }
                break;
            }
        }
    }

    return [
        'id' => $folder['id'],
        'name' => $folder['name'],
        'created_at' => $folder['createdTime'] ?? null,
        'size' => $totalSize,
        'file_count' => count($children),
        'status' => $status,
        'status_label' => BACKUP_STATUS_LABELS[$status] ?? $status,
        'db_dump_method' => $dbDumpMethod,
        'checksums' => $checksums,
        'files' => array_map(fn($child) => [
            'id' => $child['id'],
            'name' => $child['name'],
            'size' => (int) ($child['size'] ?? 0),
        ], $children),
    ];
}

function gdrive_get_metadata(string $fileId, string $fields = 'id,name,parents,mimeType'): array
{
    $token = gdrive_access_token();
    $url = 'https://www.googleapis.com/drive/v3/files/' . $fileId . '?fields=' . urlencode($fields) . '&supportsAllDrives=true';
    $response = backup_curl_request('GET', $url, ['Authorization: Bearer ' . $token]);
    $payload = json_decode($response['body'], true);
    if ($response['status'] >= 300 || !is_array($payload)) {
        throw new RuntimeException('Google Drive metadata lookup failed: ' . $response['body']);
    }
    return $payload;
}

/**
 * Confirms a Drive file was created by this system before allowing a download:
 * its parent folder must itself be a direct child of the configured backup
 * folder and carry our naming prefix. Prevents proxying arbitrary Drive files.
 */
function gdrive_verify_system_owned(string $fileId): array
{
    $file = gdrive_get_metadata($fileId);
    $parents = $file['parents'] ?? [];
    if (!$parents) {
        throw new RuntimeException('Dosyanın üst klasörü bulunamadı.');
    }
    $parent = gdrive_get_metadata((string) $parents[0], 'id,name,parents');
    $grandparents = $parent['parents'] ?? [];
    $ownedFolder = strpos((string) $parent['name'], BACKUP_DRIVE_PREFIX) === 0
        && in_array(backup_drive_config()['folder_id'], $grandparents, true);
    if (!$ownedFolder) {
        throw new RuntimeException('Bu dosya bu sistem tarafından oluşturulmamış.');
    }
    return $file;
}

function gdrive_download_to_stream(string $fileId): void
{
    $token = gdrive_access_token();
    $ch = curl_init('https://www.googleapis.com/drive/v3/files/' . $fileId . '?alt=media&supportsAllDrives=true');
    curl_setopt_array($ch, [
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $token],
        CURLOPT_RETURNTRANSFER => false,
        CURLOPT_TIMEOUT => 300,
        CURLOPT_WRITEFUNCTION => function ($curlHandle, $chunk) {
            echo $chunk;
            return strlen($chunk);
        },
    ]);
    curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($status >= 300) {
        throw new RuntimeException('Google Drive dosya indirme hatası (HTTP ' . $status . ').');
    }
}

function gdrive_delete_file(string $fileId): void
{
    $token = gdrive_access_token();
    $response = backup_curl_request('DELETE', 'https://www.googleapis.com/drive/v3/files/' . $fileId . '?supportsAllDrives=true', ['Authorization: Bearer ' . $token]);
    if ($response['status'] >= 300 && $response['status'] !== 404) {
        throw new RuntimeException('Google Drive delete failed: ' . $response['body']);
    }
}

// ── Alert email (failure-only, best-effort) ──────────────────────────────────

function backup_send_alert(string $subject, string $body): void
{
    if (!defined('BACKUP_ALERT_EMAIL') || BACKUP_ALERT_EMAIL === '' || !backup_function_usable('mail')) {
        backup_log('Alert email skipped (not configured or mail() unavailable): ' . $subject);
        return;
    }
    @mail((string) BACKUP_ALERT_EMAIL, '[Akinal Yedekleme] ' . $subject, $body, 'Content-Type: text/plain; charset=UTF-8');
}

// ── Success notification email (Resend, verified-upload-only, exactly-once) ──

// Resend's API accepts attachments as base64 in the JSON body; very large
// combined attachment sizes risk hitting Resend's request-size limit or
// timing out. If the combined attachment size exceeds this, the notification
// is skipped entirely (never sent partially/without attachments) and only
// logged privately — the already-successful Drive backup is unaffected.
const BACKUP_SUCCESS_EMAIL_MAX_ATTACHMENT_BYTES = 35 * 1024 * 1024;

/**
 * Minimal Resend REST API client (POST /emails) — no Composer/SDK dependency,
 * consistent with how this file already talks to Google Drive's REST API
 * directly via backup_curl_request(). $attachments: [filename => absolute
 * local path]. Returns ['ok' => bool, 'status' => int, 'body' => string].
 */
function backup_resend_send_email(string $to, string $subject, string $bodyText, array $attachments): array
{
    $apiKey = backup_resend_api_key_source();
    if ($apiKey === null) {
        throw new RuntimeException('RESEND_API_KEY is not configured.');
    }
    $fromEmail = backup_resend_from_email_source();
    if ($fromEmail === 'onboarding@resend.dev') {
        // Purely informational — Resend's shared sandbox sender is documented
        // (config.example.php) as test-only; using it in a live send is not
        // blocked here (that's an operator config choice), but it's worth
        // surfacing in private diagnostics so it isn't mistaken for a
        // verified-domain production sender.
        backup_log('Success email using Resend\'s shared test sender (onboarding@resend.dev), not a verified production domain.');
    }
    $payload = [
        'from' => $fromEmail,
        'to' => [$to],
        'subject' => $subject,
        'text' => $bodyText,
        'attachments' => [],
    ];
    foreach ($attachments as $filename => $path) {
        if (!is_file($path)) {
            continue;
        }
        $payload['attachments'][] = [
            'filename' => $filename,
            'content' => base64_encode((string) file_get_contents($path)),
        ];
    }

    $response = backup_curl_request('POST', 'https://api.resend.com/emails', [
        'Authorization: Bearer ' . $apiKey,
        'Content-Type: application/json',
    ], (string) json_encode($payload));

    $decoded = json_decode($response['body'], true);
    $ok = $response['status'] >= 200 && $response['status'] < 300;

    return [
        'ok' => $ok,
        'status' => $response['status'],
        // Resend's success response is {"id": "<message-id>"} — an opaque
        // identifier, not a secret, safe to log/store for diagnostics. On
        // failure it echoes back a {"message": "..."} we sanitize before use.
        'message_id' => $ok && is_array($decoded) && isset($decoded['id']) ? (string) $decoded['id'] : null,
        'error_message' => !$ok && is_array($decoded) && isset($decoded['message']) ? (string) $decoded['message'] : null,
    ];
}

/**
 * Sets the admin-only diagnostic status/reason for a run's notification
 * attempt. $status is one of 'notification_sent', 'notification_failed',
 * 'notification_not_configured'. $detail is a short, already-sanitized
 * string (HTTP status, Resend message id, or a sanitized error) — never a
 * raw payload, header, or credential. Visible only via the existing admin
 * dashboard API (backups.php), never a public response.
 */
function backup_set_notification_status(string $runId, string $status, ?string $detail): void
{
    $stmt = db()->prepare('UPDATE ak_backup_runs SET notification_status = :status, notification_detail = :detail WHERE id = :id');
    $stmt->execute([
        'status' => $status,
        'detail' => $detail !== null ? substr($detail, 0, 255) : null,
        'id' => $runId,
    ]);
}

/**
 * Builds and sends the "Yedekleme Başarılı" notification (via Resend) for a
 * run whose package has ALREADY passed gdrive_verify_uploaded_package() —
 * called for both a fully complete run and one with database-export warnings
 * (the email body says which). Never called for failed or unverified runs —
 * see the call sites in backup_execute_full_run().
 *
 * Idempotency / safe-retry state machine (ak_backup_runs.notification_status):
 *   NULL / 'notification_failed' / 'notification_not_configured'
 *       → ELIGIBLE to attempt. Atomically claimed by setting the column to a
 *         transient 'notification_sending' marker (`UPDATE ... WHERE id = :id
 *         AND (notification_status IS NULL OR notification_status IN
 *         ('notification_failed','notification_not_configured'))`) so two
 *         concurrent callers can never both proceed.
 *   'notification_sending' (claimed by this call) → attempt Resend.
 *       - Resend returns a message id (2xx, accepted) → 'notification_sent',
 *         success_email_sent_at is set. NEVER reattempted again for this
 *         run_id: 'notification_sent' is not in the eligible-claim set above.
 *       - Resend rejects/errors, or isn't configured → 'notification_failed'
 *         / 'notification_not_configured'. success_email_sent_at stays NULL.
 *         This deliberately LEAVES the run eligible for exactly one future
 *         retry (e.g. after fixing configuration) — it must never be
 *         confused with "already sent".
 * This guarantees: never more than one Resend-accepted send per run_id, and
 * a run where Resend was never actually accepted can always be safely
 * retried without risk of a duplicate.
 *
 * A Resend API failure, or missing Resend/recipient configuration, is only
 * ever logged/recorded here — it can never undo, retry-loop, or otherwise
 * affect the already-recorded successful backup. This function never claims
 * the email was delivered — only that Resend's API accepted (or rejected) it.
 *
 * $attachments: [ filename => absolute local path ], the exact finalized
 * package files (never regenerated copies) — the caller passes paths still
 * inside the run's work directory, before that directory is cleaned up.
 */
function backup_send_success_email(string $runId, string $packageName, array $attachments, int $totalPackageSize, bool $dbComplete): void
{
    $recipient = backup_success_notification_email_source();
    if ($recipient === null) {
        backup_log('Success email skipped (BACKUP_SUCCESS_NOTIFICATION_EMAIL not configured): ' . $packageName);
        backup_set_notification_status($runId, 'notification_not_configured', 'recipient not configured');
        return;
    }
    if (backup_resend_api_key_source() === null) {
        backup_log('Success email skipped (RESEND_API_KEY not configured): ' . $packageName);
        backup_set_notification_status($runId, 'notification_not_configured', 'RESEND_API_KEY not configured');
        return;
    }

    // Atomic claim FIRST — only a run with no prior send attempt, or a prior
    // attempt that Resend never accepted, can be claimed. A run already
    // marked 'notification_sent' can never be claimed again.
    $claim = db()->prepare(
        "UPDATE ak_backup_runs SET notification_status = 'notification_sending' "
        . "WHERE id = :id AND (notification_status IS NULL OR notification_status IN ('notification_failed', 'notification_not_configured'))"
    );
    $claim->execute(['id' => $runId]);
    if ($claim->rowCount() !== 1) {
        backup_log('Success email skipped (already sent, or currently being sent, for this run_id): ' . $runId . ' / ' . $packageName);
        return;
    }

    $totalAttachmentBytes = 0;
    foreach ($attachments as $path) {
        $size = is_file($path) ? (filesize($path) ?: 0) : 0;
        $totalAttachmentBytes += $size;
    }
    if ($totalAttachmentBytes === 0 || $totalAttachmentBytes > BACKUP_SUCCESS_EMAIL_MAX_ATTACHMENT_BYTES) {
        $reason = sprintf('attachment set too large or unreadable for Resend delivery (%s)', backup_format_bytes($totalAttachmentBytes));
        backup_log(sprintf(
            'Success email NOT sent for %s: %s. Drive backup itself is unaffected; download the package directly from Drive if needed.',
            $packageName,
            $reason
        ));
        backup_set_notification_status($runId, 'notification_failed', $reason);
        return;
    }

    $istanbulTime = (new DateTimeImmutable('now', new DateTimeZone('UTC')))
        ->setTimezone(new DateTimeZone('Europe/Istanbul'))
        ->format('d.m.Y H:i:s');

    $dbStatusLine = $dbComplete
        ? "Veritabanı dışa aktarımı TAM olarak tamamlandı."
        : "Paket Drive'a yüklendi ve doğrulandı.";

    $bodyText = "Yedekleme başarıyla tamamlandı ve Google Drive'a yüklendiği doğrulandı.\n\n"
        . "Tamamlanma zamanı (Türkiye saati): {$istanbulTime}\n"
        . "Paket adı: {$packageName}\n"
        . "Toplam paket boyutu: " . backup_format_bytes($totalPackageSize) . "\n"
        . "Google Drive klasörü: " . BACKUP_DRIVE_FOLDER_URL . "\n"
        . "{$dbStatusLine}\n\n"
        . "Bu e-postaya bu paketin şifrelenmiş yedek dosyaları eklenmiştir.\n";

    try {
        $result = backup_resend_send_email(
            $recipient,
            'Akınal İnşaat – Yedekleme Başarılı',
            $bodyText,
            $attachments
        );
        // A 2xx from Resend only means the API accepted the request for
        // delivery — it is never proof of actual delivery to the recipient's
        // inbox, so this log line (and everything else in this codebase) is
        // careful to say "queued", never "delivered".
        if ($result['ok'] && $result['message_id'] !== null) {
            backup_log(sprintf(
                'Success email queued via Resend for %s (run_id=%s, attachment bytes=%d, message_id=%s)',
                $packageName,
                $runId,
                $totalAttachmentBytes,
                $result['message_id']
            ));
            $stmt = db()->prepare('UPDATE ak_backup_runs SET notification_status = :status, notification_detail = :detail, success_email_sent_at = :now WHERE id = :id');
            $stmt->execute([
                'status' => 'notification_sent',
                'detail' => 'resend_message_id=' . $result['message_id'],
                'now' => gmdate('Y-m-d H:i:s'),
                'id' => $runId,
            ]);
        } else {
            $sanitizedReason = backup_pure_sanitize_diagnostic_message(
                'resend_status=' . $result['status'] . ($result['error_message'] !== null ? (' ' . $result['error_message']) : '')
            );
            backup_log(sprintf(
                'Success email FAILED to queue via Resend for %s (run_id=%s): %s — Drive backup remains successful and unaffected; eligible for one retry',
                $packageName,
                $runId,
                $sanitizedReason
            ));
            backup_set_notification_status($runId, 'notification_failed', $sanitizedReason);
        }
    } catch (Throwable $sendError) {
        $sanitizedReason = backup_pure_sanitize_diagnostic_message($sendError->getMessage());
        backup_log(sprintf(
            'Success email FAILED to queue via Resend for %s (run_id=%s): %s — Drive backup remains successful and unaffected; eligible for one retry',
            $packageName,
            $runId,
            $sanitizedReason
        ));
        backup_set_notification_status($runId, 'notification_failed', $sanitizedReason);
    }
}

// ── Shared full-run orchestration (used by BOTH the CLI cron entry point and ─
// ── the admin "Şimdi Drive'a Yedekle" endpoint — logic lives here exactly once) ─

/**
 * Thrown when another run already holds the lock. Callers (CLI script, admin
 * HTTP endpoint) catch this distinctly to report "already running" rather than
 * a generic failure.
 */
class BackupAlreadyRunningException extends RuntimeException
{
}

/**
 * Thrown by backup_execute_full_run() for any failure that occurred inside its
 * main try block (after the lock was acquired), carrying which stage failed
 * (lock, archive, database_export, manifest, drive_upload, remote_verification,
 * retention) alongside an already-sanitized message — so callers such as
 * backup-run-now.php can build a safe, structured `{ ok: false, stage }`
 * response without ever needing to inspect (or accidentally leak) the raw
 * original exception. The original exception is kept as the "previous"
 * exception only for local, private log correlation — it is never re-thrown
 * or rendered anywhere.
 */
class BackupStageException extends RuntimeException
{
    private string $stage;

    public function __construct(string $sanitizedMessage, string $stage, ?Throwable $previous = null)
    {
        parent::__construct($sanitizedMessage, 0, $previous);
        $this->stage = $stage;
    }

    public function getStage(): string
    {
        return $this->stage;
    }
}

/**
 * Executes one complete backup run: site archive, database export, manifest/
 * RECOVERY.md/checksums, Drive upload, strict remote verification, ledger
 * recording, and (only for a fully complete database export) retention
 * cleanup. Used identically by the CLI daily cron entry point
 * (cron/backup-daily.php) and the admin "Şimdi Drive'a Yedekle" endpoint
 * (backup-run-now.php) — neither duplicates any of this logic.
 *
 * $runType is a free-form label stored on the ledger row (e.g. 'daily_auto',
 * 'manual_admin') so the history/audit trail can distinguish how a run was
 * triggered without any behavioral difference between them.
 *
 * Returns a small, UI-safe result array (no paths, no credentials) on success:
 * ['run_id', 'status', 'package_name', 'drive_folder_id', 'created_at', 'db_complete'].
 * Throws BackupAlreadyRunningException if a run is already in progress, or
 * RuntimeException (with the ledger row already correctly marked 'failed') on
 * any other failure.
 */
function backup_execute_full_run(string $runType): array
{
    backup_ensure_tables();

    // Concurrency guard — the SAME lock path is used regardless of trigger
    // (cron or manual button), so a manual click can never race a scheduled
    // run, and two manual clicks can never race each other either. See
    // backup_acquire_lock_at() for the stale-lock recovery logic (age/PID/
    // empty-content, evaluated independently of flock()).
    $lockPath = backup_private_dir() . '/daily-run.lock';
    $lock = backup_acquire_lock_at($lockPath);
    if (!$lock['acquired']) {
        throw new BackupAlreadyRunningException('Bir yedekleme işlemi zaten devam ediyor.');
    }
    if ($lock['stale_recovered']) {
        backup_log('Backup run (' . $runType . '): recovered a stale/leftover lock marker from a previous run; proceeding safely.');
    }
    // Redundant safety net for the rare case a fatal error bypasses the
    // `finally` block below (e.g. an out-of-memory termination). The primary,
    // always-taken release path is that `finally` block.
    register_shutdown_function(static function () use ($lock): void {
        backup_release_lock($lock['handle']);
    });

    // Tracks which stage failed, for private diagnostics only (never returned
    // to the browser) — lock/drive_config/prerequisites/archive/
    // database_export/manifest/drive_upload/remote_verification/retention.
    $stage = 'lock';
    $runId = null;
    $workDir = null;

    try {
        $stage = 'drive_config';
        $driveConfig = backup_drive_config();
        if ($driveConfig['folder_id'] === '' || $driveConfig['credentials_path'] === null || !is_file($driveConfig['credentials_path'])) {
            throw new RuntimeException('Google Drive yapılandırılmamış.');
        }
        $driveFolderId = $driveConfig['folder_id'];

        $stage = 'prerequisites';
        $estimatedNeeded = backup_estimate_site_size() + backup_estimate_database_size();
        backup_assert_prerequisites($estimatedNeeded);

        $stamp = gmdate('Y-m-d\TH-i-s\Z');
        $packageName = BACKUP_DRIVE_PREFIX . $stamp;
        $workDir = backup_work_dir() . '/' . $packageName;

        $runId = backup_start_run($runType);
        backup_log('Backup run started (run_id=' . $runId . ', type=' . $runType . ')');

        if (!mkdir($workDir, 0700, true)) {
            throw new RuntimeException('Could not create working directory.');
        }

        // 1. Frontend + backend + uploads archives — each a single ZIP (never
        // additionally gzipped), then separately encrypted. Together they cover the
        // exact same deployed public_html tree the old combined archive did (frontend
        // source/build, PHP backend/API including config, uploaded media), split by
        // backup_pure_archive_category(). This is a disaster-recovery package, so
        // application config (config.php, config.local.php) is intentionally NOT
        // excluded — see backup_pure_is_excluded_from_archive() for the narrow set
        // of things that are (Drive/service-account-shaped secrets, build/cache junk).
        $stage = 'archive';
        $frontendZip = $workDir . '/frontend.zip';
        backup_build_frontend_archive($frontendZip);
        $frontendEncPath = $workDir . '/' . BACKUP_FRONTEND_ARCHIVE_NAME;
        backup_encrypt_file($frontendZip, $frontendEncPath);
        @unlink($frontendZip);
        $frontendEncChecksum = backup_checksum_file($frontendEncPath);
        $frontendEncSize = filesize($frontendEncPath) ?: 0;

        $backendZip = $workDir . '/backend.zip';
        backup_build_backend_archive($backendZip);
        $backendEncPath = $workDir . '/' . BACKUP_BACKEND_ARCHIVE_NAME;
        backup_encrypt_file($backendZip, $backendEncPath);
        @unlink($backendZip);
        $backendEncChecksum = backup_checksum_file($backendEncPath);
        $backendEncSize = filesize($backendEncPath) ?: 0;

        $uploadsZip = $workDir . '/uploads.zip';
        backup_build_uploads_archive($uploadsZip);
        $uploadsEncPath = $workDir . '/' . BACKUP_UPLOADS_ARCHIVE_NAME;
        backup_encrypt_file($uploadsZip, $uploadsEncPath);
        @unlink($uploadsZip);
        $uploadsEncChecksum = backup_checksum_file($uploadsEncPath);
        $uploadsEncSize = filesize($uploadsEncPath) ?: 0;

        // 2. Database archive — plain SQL text, gzip helps here, then encrypted.
        $stage = 'database_export';
        $dbSql = $workDir . '/database.sql';
        $dbResult = backup_dump_database($dbSql);
        backup_gzip_file($dbSql, $dbSql . '.gz');
        @unlink($dbSql);
        $dbEncPath = $workDir . '/' . BACKUP_DB_ARCHIVE_NAME;
        backup_encrypt_file($dbSql . '.gz', $dbEncPath);
        @unlink($dbSql . '.gz');
        $dbEncChecksum = backup_checksum_file($dbEncPath);
        $dbEncSize = filesize($dbEncPath) ?: 0;

        if ($frontendEncSize === 0 || $backendEncSize === 0 || $dbEncSize === 0) {
            throw new RuntimeException('One or more encrypted archives is empty.');
        }
        // uploads/ may legitimately not exist yet on a fresh install — an empty
        // uploads archive is not itself a failure, just an empty-but-valid ZIP.

        // A run is only ever labeled "complete" when every requested schema object
        // (tables, triggers, routines, events) was actually exported. mysqldump
        // succeeding always means complete; a PDO-fallback run with warnings means
        // some objects were skipped, most often due to DB-user privileges.
        $manifestStatus = $dbResult['complete'] ? 'complete' : 'partial';

        // 3. Manifest — recovery-relevant metadata only, never any secret/credential value.
        $stage = 'manifest';
        $manifest = [
            'package_version' => BACKUP_PACKAGE_VERSION,
            'created_at' => gmdate('c'),
            'source' => 'akinalinsaat.com',
            'database' => DB_NAME,
            'db_dump_method' => $dbResult['method'],
            'db_dump_warnings' => $dbResult['warnings'],
            'recovery_doc' => BACKUP_RECOVERY_DOC_NAME,
            'archives' => [
                BACKUP_FRONTEND_ARCHIVE_NAME => ['size' => $frontendEncSize, 'encrypted' => true, 'format' => 'zip'],
                BACKUP_BACKEND_ARCHIVE_NAME => ['size' => $backendEncSize, 'encrypted' => true, 'format' => 'zip'],
                BACKUP_UPLOADS_ARCHIVE_NAME => ['size' => $uploadsEncSize, 'encrypted' => true, 'format' => 'zip'],
                BACKUP_DB_ARCHIVE_NAME => ['size' => $dbEncSize, 'encrypted' => true, 'format' => 'sql.gz'],
            ],
            'checksums' => [
                BACKUP_FRONTEND_ARCHIVE_NAME => $frontendEncChecksum,
                BACKUP_UPLOADS_ARCHIVE_NAME => $uploadsEncChecksum,
                BACKUP_BACKEND_ARCHIVE_NAME => $backendEncChecksum,
                BACKUP_DB_ARCHIVE_NAME => $dbEncChecksum,
            ],
            'status' => $manifestStatus,
        ];
        $manifestPath = $workDir . '/manifest.json';
        file_put_contents($manifestPath, json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

        // 4. RECOVERY.md — human-readable restore instructions derived only from the
        // manifest above (no secrets), so it is safe to upload alongside the archives.
        $recoveryPath = $workDir . '/' . BACKUP_RECOVERY_DOC_NAME;
        file_put_contents($recoveryPath, backup_build_recovery_md($manifest));
        $recoveryChecksum = backup_checksum_file($recoveryPath);

        // 5. Checksums file — covers all four archives and RECOVERY.md.
        $checksumsPath = $workDir . '/checksums.sha256';
        file_put_contents($checksumsPath, sprintf(
            "%s  %s\n%s  %s\n%s  %s\n%s  %s\n%s  %s\n",
            $frontendEncChecksum,
            BACKUP_FRONTEND_ARCHIVE_NAME,
            $backendEncChecksum,
            BACKUP_BACKEND_ARCHIVE_NAME,
            $uploadsEncChecksum,
            BACKUP_UPLOADS_ARCHIVE_NAME,
            $dbEncChecksum,
            BACKUP_DB_ARCHIVE_NAME,
            $recoveryChecksum,
            BACKUP_RECOVERY_DOC_NAME
        ));

        // 6. Upload to Google Drive: one subfolder per run, seven files inside it.
        // Each upload streams from disk — none of these archives are ever fully
        // loaded into PHP memory. Only ever uploads into the single configured
        // Drive folder (backup_drive_config()['folder_id']).
        $stage = 'drive_upload';
        $folderId = gdrive_create_folder($packageName, $driveFolderId);
        gdrive_upload_file($manifestPath, 'manifest.json', $folderId);
        gdrive_upload_file($recoveryPath, BACKUP_RECOVERY_DOC_NAME, $folderId);
        gdrive_upload_file($frontendEncPath, BACKUP_FRONTEND_ARCHIVE_NAME, $folderId);
        gdrive_upload_file($backendEncPath, BACKUP_BACKEND_ARCHIVE_NAME, $folderId);
        gdrive_upload_file($uploadsEncPath, BACKUP_UPLOADS_ARCHIVE_NAME, $folderId);
        gdrive_upload_file($dbEncPath, BACKUP_DB_ARCHIVE_NAME, $folderId);
        gdrive_upload_file($checksumsPath, 'checksums.sha256', $folderId);

        // Strict verification: exact expected filenames present exactly once,
        // Drive-reported size/MD5 matches the local file, and the uploaded
        // manifest.json/checksums.sha256 content matches this run's own computed
        // values. Throws (failing the run, before retention/notification ever
        // run) on any mismatch.
        $stage = 'remote_verification';
        gdrive_verify_uploaded_package(
            $folderId,
            [
                BACKUP_FRONTEND_ARCHIVE_NAME => ['path' => $frontendEncPath, 'size' => $frontendEncSize, 'sha256' => $frontendEncChecksum],
                BACKUP_BACKEND_ARCHIVE_NAME => ['path' => $backendEncPath, 'size' => $backendEncSize, 'sha256' => $backendEncChecksum],
                BACKUP_UPLOADS_ARCHIVE_NAME => ['path' => $uploadsEncPath, 'size' => $uploadsEncSize, 'sha256' => $uploadsEncChecksum],
                BACKUP_DB_ARCHIVE_NAME => ['path' => $dbEncPath, 'size' => $dbEncSize, 'sha256' => $dbEncChecksum],
            ],
            $manifest
        );

        $runStatus = $dbResult['complete'] ? 'success' : 'success_with_warnings';
        $totalPackageSize = $frontendEncSize + $backendEncSize + $uploadsEncSize + $dbEncSize;

        backup_finish_run($runId, $runStatus, [
            'package_name' => $packageName,
            'site_archive_size' => $frontendEncSize,
            'backend_archive_size' => $backendEncSize,
            'uploads_archive_size' => $uploadsEncSize,
            'db_archive_size' => $dbEncSize,
            'total_size' => $totalPackageSize,
            'checksum_site' => $frontendEncChecksum,
            'checksum_backend' => $backendEncChecksum,
            'checksum_uploads' => $uploadsEncChecksum,
            'checksum_db' => $dbEncChecksum,
            'drive_folder_id' => $folderId,
            'drive_folder_name' => $packageName,
            'db_dump_method' => $dbResult['method'],
            'error_message' => $dbResult['complete'] ? null : ('Uyarılarla tamamlandı: ' . implode(' | ', $dbResult['warnings'])),
        ]);
        backup_log('Backup run finished with status=' . $runStatus . ' (type=' . $runType . '): ' . $packageName . ' (drive_folder_id=' . $folderId . ')');

        // From this point on, the run is ALREADY recorded as successful in the
        // ledger. Post-success side effects (the partial-export alert email,
        // retention cleanup) must never be able to downgrade that recorded
        // status — anything that goes wrong here is logged/alerted only, never
        // rethrown, and backup_finish_run() is never called again for this
        // run_id. (This directly fixes a real bug: an exception anywhere in
        // this block used to propagate to the outer catch below, which called
        // backup_finish_run($runId, 'failed', ...) a second time — overwriting
        // status to "failed" while leaving the already-written package_name/
        // size fields in place, exactly the "Başarısız" + real package/size
        // combination seen in the history table.)
        try {
            // 7. Success notification email — sent for EVERY run that reaches this
            // point, regardless of database-export completeness: Drive upload
            // verification (gdrive_verify_uploaded_package()) already passed for
            // both a fully complete run and one with database warnings, so both
            // are genuinely verified, uploaded packages. The email body itself
            // states plainly whether the database export was fully complete or
            // used a partial/warned fallback — never overclaiming. Exactly-once
            // delivery and safe-retry-on-failure are handled entirely inside
            // backup_send_success_email() (notification_status state machine);
            // any exception/failure here is only logged, never affecting the
            // already-recorded run status.
            try {
                backup_send_success_email($runId, $packageName, [
                    BACKUP_FRONTEND_ARCHIVE_NAME => $frontendEncPath,
                    BACKUP_BACKEND_ARCHIVE_NAME => $backendEncPath,
                    BACKUP_UPLOADS_ARCHIVE_NAME => $uploadsEncPath,
                    BACKUP_DB_ARCHIVE_NAME => $dbEncPath,
                    'manifest.json' => $manifestPath,
                    'checksums.sha256' => $checksumsPath,
                    BACKUP_RECOVERY_DOC_NAME => $recoveryPath,
                ], $totalPackageSize, $dbResult['complete']);
            } catch (Throwable $emailError) {
                // Never let an email-sending failure block the alert/retention
                // steps below, and never let it affect the already-recorded
                // successful backup.
                $sanitizedEmailMessage = backup_pure_sanitize_diagnostic_message($emailError->getMessage());
                backup_log('Success email failed unexpectedly (run_id=' . $runId . '): class=' . get_class($emailError) . ' message=' . $sanitizedEmailMessage);
            }

            if (!$dbResult['complete']) {
                backup_send_alert(
                    'Yedekleme uyarılarla tamamlandı (TAM yedek değil)',
                    "Yedek Drive'a yüklendi (tanı amacıyla saklandı) fakat TAM bir kurtarma paketi DEĞİLDİ — bazı "
                    . "veritabanı nesneleri dışa aktarılamadı. Bu paket 30 yedek saklama sayacına dahil edilmedi ve "
                    . "bu çalıştırma için otomatik eski-yedek temizliği ÇALIŞTIRILMADI.\n\n"
                    . "Tetikleyen: {$runType}\nYöntem: {$dbResult['method']}\nUyarılar:\n- " . implode("\n- ", $dbResult['warnings']) . "\n\nZaman (UTC): " . gmdate('c')
                );
                backup_log('Backup run partial (db incomplete) — retention cleanup skipped for this run: ' . $packageName);
            } else {
                // 8. Retention: only ever runs after a FULLY complete database export and a
                // fully verified upload (both checked above). Only folders whose own
                // manifest.json says status=complete are counted/eligible for deletion.
                $stage = 'retention';
                try {
                    $allFolders = backup_filter_system_folders(gdrive_list_children($driveFolderId, 'application/vnd.google-apps.folder'));
                    $classified = array_map('gdrive_classify_backup_folder', $allFolders);
                    $completeOnes = array_values(array_filter($classified, fn($f) => $f['status'] === 'complete'));
                    $toDelete = backup_pure_select_retention_deletions($completeOnes, backup_retention_count());
                    foreach ($toDelete as $oldest) {
                        gdrive_delete_file($oldest['id']);
                        backup_log('Retention: deleted oldest complete backup folder ' . $oldest['name']);
                    }
                } catch (Throwable $retentionError) {
                    // Retention failure must alert but not mark the (already successful) backup as failed.
                    $sanitizedRetentionMessage = backup_pure_sanitize_diagnostic_message($retentionError->getMessage());
                    backup_log('Retention cleanup failed (run_id=' . $runId . '): class=' . get_class($retentionError) . ' message=' . $sanitizedRetentionMessage);
                    backup_send_alert('Yedekleme saklama temizliği başarısız', 'Yedek başarıyla alındı fakat eski yedeklerin temizlenmesi başarısız oldu: ' . $sanitizedRetentionMessage);
                }
            }
        } catch (Throwable $postSuccessError) {
            $sanitizedPostMessage = backup_pure_sanitize_diagnostic_message($postSuccessError->getMessage());
            backup_log(sprintf(
                'Post-success step failed (run_id=%s, already recorded as %s — status NOT changed): class=%s message=%s',
                $runId,
                $runStatus,
                get_class($postSuccessError),
                $sanitizedPostMessage
            ));
        }

        return [
            'run_id' => $runId,
            'status' => $runStatus,
            'package_name' => $packageName,
            'drive_folder_id' => $folderId,
            'created_at' => $manifest['created_at'],
            'db_complete' => $dbResult['complete'],
        ];
    } catch (Throwable $exception) {
        // Sanitized, stage-labeled diagnostics go only to the private log and the
        // ledger row (both admin-only, never rendered as raw text to the customer-
        // facing page) — no keys, tokens, credentials, or absolute paths.
        $sanitizedMessage = backup_pure_sanitize_diagnostic_message($exception->getMessage());
        if ($runId !== null) {
            backup_finish_run($runId, 'failed', ['error_message' => $sanitizedMessage]);
        }
        backup_log(sprintf(
            'Backup run failed (run_id=%s, type=%s, stage=%s): class=%s message=%s',
            $runId ?? 'n/a',
            $runType,
            $stage,
            get_class($exception),
            $sanitizedMessage
        ));
        backup_send_alert(
            'Yedekleme başarısız',
            "Yedekleme başarısız oldu.\n\nTetikleyen: {$runType}\nAşama: {$stage}\nHata sınıfı: " . get_class($exception) . "\nHata: {$sanitizedMessage}\nZaman (UTC): " . gmdate('c')
        );
        // Wrapped rather than re-thrown raw: callers (e.g. backup-run-now.php) get
        // a structured, already-sanitized stage + message and never need to
        // inspect (or risk leaking) the original exception's raw content.
        throw new BackupStageException($sanitizedMessage, $stage, $exception);
    } finally {
        // Always runs — including on archive/upload/verification failure — so the
        // work directory never lingers and the lock is never left held past this call.
        if ($workDir !== null) {
            backup_rrmdir($workDir);
        }
        backup_release_lock($lock['handle']);
    }
}
