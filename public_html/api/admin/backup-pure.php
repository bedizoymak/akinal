<?php
declare(strict_types=1);

/**
 * Pure, DB-free constants and helper functions for the Backup Center. Kept separate
 * from backup-lib.php (which requires db.php/auth.php) so these can be exercised by
 * a plain CLI script (scripts/verify-backup-corrections.php) without a database or
 * an admin session.
 */

// Bumped to '4' when frontend.zip.enc stopped walking the cPanel account root
// and switched to the private frontend-source mirror (akinal-private/
// frontend-source/) plus explicit allowlisted private files in
// backend.zip.enc — restore tooling keys off this to tell old- and new-shape
// packages apart.
const BACKUP_PACKAGE_VERSION = '4';
const BACKUP_DRIVE_PREFIX = 'akinal-recovery-';

// Canonical archive filenames used consistently across the manifest, checksums
// file, Drive uploads, restore validation and the admin UI. Each archive is a
// ZIP (never gzipped on top of a ZIP — that adds size for no benefit and was a
// past bug where the package was mislabeled as tar.gz while actually being a
// gzipped zip), except the database dump which is plain SQL text and does
// benefit from gzip. The public_html tree is split three ways — frontend
// (everything outside api/ and uploads/), backend (api/ only, config files
// included), and uploads (uploads/ only) — so any one of them can be
// restored/inspected independently.
const BACKUP_FRONTEND_ARCHIVE_NAME = 'frontend.zip.enc';
const BACKUP_BACKEND_ARCHIVE_NAME = 'backend.zip.enc';
const BACKUP_UPLOADS_ARCHIVE_NAME = 'uploads.zip.enc';
const BACKUP_DB_ARCHIVE_NAME = 'database.sql.gz.enc';
const BACKUP_RECOVERY_DOC_NAME = 'RECOVERY.md';

// Google Drive folder link shown in the success notification email and reused
// by the admin UI's clickable summary cards (kept as a plain constant here so
// the email body never has to reconstruct or guess it).
const BACKUP_DRIVE_FOLDER_URL = 'https://drive.google.com/drive/folders/1i99EccR4kS9VJM14b4hs3pFfUxl6w4MC?usp=drive_link';

// The daily automation's intended cron schedule. A single source of truth for
// both the admin UI label and docs/BACKUP_CENTER_SETUP.md's cron instructions.
const BACKUP_DAILY_SCHEDULE_EXPRESSION = '0 1 * * *';
const BACKUP_DAILY_SCHEDULE_LABEL = 'Her gün 01:00 (Türkiye saati)';

// The three status labels shown in the admin UI and used for run/package
// classification. "Tam Kurtarma Yedeği" requires BOTH a full site archive and a
// mysqldump-produced, fully complete database export, verified on Drive. Anything
// produced only via the PDO fallback (or with any DB export warning) is always
// "Kısmi" — it must never be presented as a genuine disaster-recovery guarantee.
const BACKUP_STATUS_LABELS = [
    'complete' => 'Tam Kurtarma Yedeği',
    'partial' => 'Kısmi / Geri Yükleme Garantisi Yok',
    'failed' => 'Başarısız',
    'incomplete' => 'Başarısız',
    'unknown' => 'Bilinmiyor',
    'running' => 'Çalışıyor',
];

/**
 * Filters a list of Drive items (each with a 'name' key) down to the ones that
 * carry this system's exact folder-naming prefix. Used for both the dashboard
 * listing and retention cleanup so unrelated Drive content is never touched.
 */
function backup_filter_system_folders(array $folders): array
{
    return array_values(array_filter($folders, static function ($folder) {
        $name = (string) ($folder['name'] ?? '');
        return strncmp($name, BACKUP_DRIVE_PREFIX, strlen(BACKUP_DRIVE_PREFIX)) === 0;
    }));
}

/**
 * True if a file at $relativePath (forward-slash, relative to the archive's
 * own walk root — public_html/ for backend/uploads, the repo root for
 * frontend) must never be placed inside the frontend/backend/uploads backup
 * ZIPs. This is a disaster-recovery package, so application config files
 * (config.php, config.local.php, .env*) are intentionally NOT excluded here —
 * they are required to actually restore the site and are only ever readable
 * by someone who already holds BACKUP_ENCRYPTION_KEY. What IS excluded:
 * (1) filenames shaped like a private key or a Google service-account
 * credential — these belong to Drive infrastructure, are never stored inside
 * public_html or the frontend source tree in the first place, and must never
 * be duplicated into a backup archive even by accident; (2) this system's own
 * private directory (akinal-private/ — holds BACKUP_ENCRYPTION_KEY, the Drive
 * service-account key, and logs; embedding the decryption key's own storage
 * location inside the very archive it protects would be a real risk if that
 * archive were ever extracted independently); (3) generated/cache/VCS
 * directories (node_modules, dist, dist-ssr, .git, .cache, __pycache__) that
 * are build junk or version-control metadata, not source, and contribute
 * nothing to rebuilding/redeploying the application. Pure string matching
 * only — no filesystem access.
 */
function backup_pure_is_excluded_from_archive(string $relativePath): bool
{
    $normalized = strtolower(str_replace('\\', '/', ltrim($relativePath, '/')));
    $basename = basename($normalized);

    if (preg_match('/\.(pem|p12|key)$/', $basename)) {
        return true;
    }
    if (preg_match('/service[-_]?account.*\.json$/', $basename)) {
        return true;
    }
    if (preg_match('#(^|/)(node_modules|dist|dist-ssr|\.git|akinal-private|\.cache|__pycache__)(/|$)#', $normalized)) {
        return true;
    }
    return false;
}

/**
 * True if $path is already an absolute filesystem path (POSIX `/...`, UNC/POSIX
 * `\...`, or Windows `C:\...`/`C:/...`). Used to decide whether a configured
 * GOOGLE_DRIVE_CREDENTIALS_PATH should be used as-is or resolved relative to the
 * private backup directory — never assumes a particular OS.
 */
function backup_pure_is_absolute_path(string $path): bool
{
    if ($path === '') {
        return false;
    }
    if ($path[0] === '/' || $path[0] === '\\') {
        return true;
    }
    return (bool) preg_match('#^[A-Za-z]:[\\\\/]#', $path);
}

/**
 * Pure check used by gdrive_verify_uploaded_package(): given the actual filenames
 * found in a freshly uploaded Drive folder and the exact set expected for a
 * package, returns a list of issues (empty = ok). Every expected name must
 * appear exactly once, and no unexpected extra files may be present — catches
 * both missing/duplicated files and a stale/wrong file set slipping through.
 */
function backup_pure_check_package_filenames(array $childNames, array $expectedNames): array
{
    $issues = [];
    $counts = array_count_values($childNames);
    foreach ($expectedNames as $expected) {
        $count = $counts[$expected] ?? 0;
        if ($count !== 1) {
            $issues[] = "'{$expected}' expected exactly once, found {$count}";
        }
    }
    if (count($childNames) !== count($expectedNames)) {
        $issues[] = 'unexpected extra file(s) present in the uploaded package folder';
    }
    return $issues;
}

/**
 * Pure check used by gdrive_verify_uploaded_package(): an uploaded archive's size
 * as reported by Drive must exactly equal the local file's size, and Drive must
 * have actually reported a size at all (null means Drive didn't tell us, which
 * we also treat as a verification failure rather than silently trusting it).
 */
function backup_pure_archive_size_mismatch(int $localSize, ?int $remoteSize): bool
{
    return $remoteSize === null || $remoteSize !== $localSize;
}

/**
 * Redacts only the BACKUP_ENCRYPTION_KEY value from a PHP config file's
 * source before that file is embedded in a backup archive — never any other
 * constant (DB credentials, Drive folder ID, etc. are preserved, since they
 * ARE required for recovery). This is the one hard rule that must never be
 * relaxed: the key that encrypts a backup archive must never be discoverable
 * INSIDE that same archive (or any archive) — a decryptor who already has the
 * archive would trivially also have the key, defeating the encryption
 * entirely. The key must be stored separately (e.g. an offline password
 * manager entry), never alongside the backups it protects.
 *
 * Matches both supported forms this codebase uses:
 *   define('BACKUP_ENCRYPTION_KEY', '...')        (config.php)
 *   'BACKUP_ENCRYPTION_KEY' => '...'               (backup-config.local.php)
 * Pure string transform — no filesystem or archive I/O.
 */
function backup_pure_redact_encryption_key(string $content): string
{
    $placeholder = '[REDACTED_BEFORE_BACKUP_ARCHIVING]';

    $redacted = preg_replace(
        '/define\(\s*([\'"])BACKUP_ENCRYPTION_KEY\1\s*,\s*([\'"])[^\'"]*\2\s*\)/',
        "define('BACKUP_ENCRYPTION_KEY', '{$placeholder}')",
        $content
    );
    $redacted = is_string($redacted) ? $redacted : $content;

    $redacted = preg_replace(
        '/([\'"])BACKUP_ENCRYPTION_KEY\1\s*=>\s*([\'"])[^\'"]*\2/',
        "'BACKUP_ENCRYPTION_KEY' => '{$placeholder}'",
        $redacted
    );

    return is_string($redacted) ? $redacted : $content;
}

// Maximum age (seconds) a lock marker may show before it is treated as stale
// REGARDLESS of what flock() itself reports. flock() alone is the primary
// mutual-exclusion mechanism, but on some shared-hosting filesystems (network
// mounts, certain NFS configurations) it is not guaranteed to release
// reliably in every failure mode. This age ceiling — together with treating
// any empty/unparseable marker as unconditionally stale — is what prevents a
// single bad lock file from permanently blocking every future run. No real
// backup run should ever legitimately take this long.
const BACKUP_LOCK_MAX_AGE_SECONDS = 3600;

/**
 * Pure staleness decision for a lock marker, independent of flock() itself.
 *
 * - $lockData: the parsed JSON content of the lock file, or null if the file
 *   was empty/missing/unparseable — which is ALWAYS stale. An empty leftover
 *   lock file must never be treated as a permanently active lock.
 * - $ageSeconds: seconds since the lock file was last written (by mtime), or
 *   null if unknown (e.g. couldn't stat the file) — with no age signal and
 *   valid-looking content, we don't force-clear it (age is our only
 *   independent-of-flock staleness signal besides emptiness/PID).
 * - $pidAlive: true/false if the recorded PID's liveness could be positively
 *   determined (e.g. via posix_kill($pid, 0)), or null if unknown/unavailable
 *   on this host. A confirmed-dead PID is always stale, independent of age.
 */
function backup_pure_lock_is_stale(?array $lockData, ?int $ageSeconds, ?bool $pidAlive = null, int $maxAgeSeconds = BACKUP_LOCK_MAX_AGE_SECONDS): bool
{
    if (!is_array($lockData) || empty($lockData['started_at'])) {
        return true;
    }
    if ($pidAlive === false) {
        return true;
    }
    if ($ageSeconds === null) {
        return false;
    }
    return $ageSeconds > $maxAgeSeconds;
}

/**
 * Redacts anything that looks like a filesystem path or a credential/token
 * value from a diagnostic message before it is ever written to the private
 * log/ledger — defense in depth on top of already-sanitized exception
 * messages elsewhere in this codebase. Pure string transform, no I/O.
 */
function backup_pure_sanitize_diagnostic_message(string $message): string
{
    $sanitized = preg_replace('#(?:[A-Za-z]:)?[\\\\/][^\s\'"]{2,}#', '[path]', $message);
    $sanitized = is_string($sanitized) ? $sanitized : $message;
    $sanitized = preg_replace('/(key|token|secret|password|credential)([\s:=]+)\S+/i', '$1$2[redacted]', $sanitized);
    $sanitized = is_string($sanitized) ? trim($sanitized) : trim($message);
    // Byte-based length/truncation deliberately (not the multibyte-string
    // equivalents) — this function must never depend on ext-mbstring being
    // installed, since it can run from inside a failure handler where we
    // want zero additional ways to fail.
    return strlen($sanitized) > 500 ? substr($sanitized, 0, 500) . '...' : $sanitized;
}

/**
 * Acquires an exclusive, OS-level (flock) lock at $lockPath so overlapping daily
 * cron runs cannot execute concurrently. Uses only the filesystem + flock() — no
 * database, no admin session — so this is directly unit-testable.
 *
 * SAFETY INVARIANT: the lock path is never unlinked, truncated, or replaced
 * before flock() has actually been acquired on that same open handle. A
 * leftover file's content (empty, old, dead-PID) says nothing about whether
 * some OTHER process still holds flock on that same inode — the owning
 * process's flock is released by the OS when it exits, but the file itself
 * can persist. Unlinking/replacing it first, based only on its content, would
 * let a second process create-and-lock a fresh inode while the first process
 * still holds flock on the old (now-unlinked) one — split-brain: two
 * concurrently "successful" acquisitions, two backup runs racing each other.
 *
 * Algorithm:
 *   1. Open the STABLE path with 'c+' (create if missing, never truncates).
 *   2. Attempt flock(LOCK_EX | LOCK_NB) on that handle FIRST.
 *   3. flock() succeeds → no other process can be holding this inode's lock,
 *      so it is now safe to inspect the existing marker (purely for
 *      diagnostics/stale-recovery labeling) and to truncate+rewrite it in
 *      place on the already-locked handle.
 *   4. flock() fails → an active lock is genuinely held by someone else.
 *      Return rejection immediately. The file is NEVER unlinked, truncated,
 *      or replaced in this branch, no matter how old/empty its content is.
 *
 * Returns ['handle' => resource|null, 'acquired' => bool, 'stale_recovered' => bool].
 */
function backup_acquire_lock_at(string $lockPath): array
{
    // Read-only existence check, purely to distinguish "brand new lock path"
    // from "a marker file was already here" for the stale_recovered LABEL
    // below. This never gates the flock attempt itself and never touches the
    // file, so it cannot introduce any unlink/replace race.
    $existedBefore = is_file($lockPath);

    $handle = @fopen($lockPath, 'c+');
    if ($handle === false) {
        return ['handle' => null, 'acquired' => false, 'stale_recovered' => false];
    }

    if (!flock($handle, LOCK_EX | LOCK_NB)) {
        // An active competing lock exists on this exact inode. Do not unlink,
        // truncate, rename, or otherwise touch the file — doing so here would
        // let a second caller create/lock a different inode while this one
        // still holds the real lock (split-brain).
        fclose($handle);
        return ['handle' => null, 'acquired' => false, 'stale_recovered' => false];
    }

    // flock() succeeded: no other process can hold this inode's exclusive
    // lock right now, so it is safe to read/classify the existing marker for
    // diagnostics only — this classification can never override a failed
    // flock() above, since we only ever reach here after flock() succeeded.
    $existing = stream_get_contents($handle);
    $staleRecovered = false;
    if ($existedBefore) {
        $now = time();
        $mtime = @filemtime($lockPath);
        $ageSeconds = $mtime !== false ? ($now - $mtime) : null;
        $hasContent = is_string($existing) && trim($existing) !== '';
        $data = $hasContent ? json_decode($existing, true) : null;
        $pidAlive = null;
        if (is_array($data) && isset($data['pid']) && is_int($data['pid']) && function_exists('posix_kill')) {
            $pidAlive = @posix_kill((int) $data['pid'], 0);
        }
        // Any pre-existing marker recovered via a successful flock() is, by
        // definition, leftover from a run that is no longer holding the lock
        // — worth surfacing for logging — in addition to the explicit
        // age/PID/emptiness staleness classification.
        $staleRecovered = $hasContent || backup_pure_lock_is_stale(is_array($data) ? $data : null, $ageSeconds, $pidAlive);
    }

    ftruncate($handle, 0);
    rewind($handle);
    fwrite($handle, (string) json_encode(['pid' => getmypid(), 'started_at' => gmdate('c')]));
    fflush($handle);

    return ['handle' => $handle, 'acquired' => true, 'stale_recovered' => $staleRecovered];
}

/**
 * Releases a lock acquired via backup_acquire_lock_at(). Safe to call with a
 * null/non-resource handle (e.g. when acquisition itself failed).
 */
function backup_release_lock($handle): void
{
    if (is_resource($handle)) {
        @ftruncate($handle, 0);
        flock($handle, LOCK_UN);
        fclose($handle);
    }
}

/**
 * Given the set of Drive folders already classified as fully "complete" system
 * backups, returns the oldest ones that must be deleted to bring the count back
 * down to $limit (oldest-first, by 'created_at') — or an empty array if nothing
 * needs deleting. Pure: takes/returns plain arrays, does no Drive I/O itself, so
 * retention selection logic can be verified without any network access. Callers
 * must only ever pass folders already filtered to status === 'complete' — this
 * function has no opinion on status, it only trims by count.
 */
function backup_pure_select_retention_deletions(array $completeFolders, int $limit): array
{
    $sorted = $completeFolders;
    usort($sorted, static fn($a, $b) => strcmp((string) ($a['created_at'] ?? ''), (string) ($b['created_at'] ?? '')));
    $excess = count($sorted) - $limit;
    if ($excess <= 0) {
        return [];
    }
    return array_slice($sorted, 0, $excess);
}

/**
 * Whether the daily cron schedule can be shown as "confirmed" rather than
 * merely "configured in code": true only when a daily_auto run actually
 * started within the last $graceSeconds (default 48h — one missed/late day of
 * grace beyond the intended once-a-day cadence). The Backup Center UI must
 * never claim the cron is active just because this script and its docs exist
 * in the codebase — only an actual recorded run proves the schedule is real.
 */
function backup_pure_schedule_confirmed(?string $lastRunAtUtc, int $nowTimestamp, int $graceSeconds = 172800): bool
{
    if ($lastRunAtUtc === null || $lastRunAtUtc === '') {
        return false;
    }
    try {
        $lastRunDt = new DateTimeImmutable($lastRunAtUtc, new DateTimeZone('UTC'));
    } catch (Throwable $exception) {
        return false;
    }
    return ($nowTimestamp - $lastRunDt->getTimestamp()) <= $graceSeconds;
}

/**
 * Renders the RECOVERY.md that ships inside every package. Content is derived
 * entirely from the manifest — never from any secret value — so it is safe to
 * upload alongside the archives. States plainly whether the database export in
 * THIS package is a genuine full mysqldump export or a partial PDO fallback, so
 * nobody restores from a partial package believing it is complete.
 */
function backup_build_recovery_md(array $manifest): string
{
    $isComplete = ($manifest['status'] ?? null) === 'complete';
    $dbMethod = (string) ($manifest['db_dump_method'] ?? 'unknown');
    $warnings = $manifest['db_dump_warnings'] ?? [];
    $createdAt = (string) ($manifest['created_at'] ?? '');
    $frontendChecksum = (string) ($manifest['checksums'][BACKUP_FRONTEND_ARCHIVE_NAME] ?? '');
    $backendChecksum = (string) ($manifest['checksums'][BACKUP_BACKEND_ARCHIVE_NAME] ?? '');
    $uploadsChecksum = (string) ($manifest['checksums'][BACKUP_UPLOADS_ARCHIVE_NAME] ?? '');
    $dbChecksum = (string) ($manifest['checksums'][BACKUP_DB_ARCHIVE_NAME] ?? '');

    $dbStatusLine = $isComplete
        ? "**TAM veritabanı yedeği** — mysqldump ile şema + veri + tetikleyici/yordam/olaylar dahil eksiksiz dışa aktarıldı."
        : "**KISMİ veritabanı yedeği — GERİ YÜKLEME GARANTİSİ YOK.** Yöntem: `{$dbMethod}`. "
            . "Bu paket PDO yedekleyici ile alındı ve aşağıdaki nesneler eksik olabilir:\n"
            . (($warnings) ? "  - " . implode("\n  - ", $warnings) : '  (detay yok)');

    $lines = [
        '# Akınal İnşaat — Kurtarma Paketi (RECOVERY.md)',
        '',
        "Paket zamanı (UTC): {$createdAt}",
        'Paket sürümü: ' . (string) ($manifest['package_version'] ?? ''),
        '',
        '## Bu paketin durumu',
        '',
        $dbStatusLine,
        '',
        '## Paket içeriği',
        '',
        '- `manifest.json` — paket meta verisi (sır/parola İÇERMEZ)',
        '- `checksums.sha256` — aşağıdaki arşivlerin SHA-256 değerleri',
        '- `' . BACKUP_FRONTEND_ARCHIVE_NAME . "` — TAM frontend uygulama yedeği, iki bilinen-güvenli kaynaktan birleştirilmiştir (cPanel hesap kökü ASLA taranmaz): (a) `public_html/` altındaki YAYINDAKİ üretim çıktısı, `api/` ve `uploads/` HARİÇ (arşivde `public_html/...` öneki korunur); (b) özel, web'den erişilemeyen `akinal-private/frontend-source/` aynası — `src/`, `public/`, `index.html`, `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig*.json` ve diğer kök derleme/yapılandırma dosyaları (kendi doğal göreli yollarıyla arşiv kökünde yer alır; her normal `scripts/deploy_ftp.py` dağıtımında otomatik güncellenir). `node_modules/`, `dist/`, `.git/` hiçbir zaman dahil edilmez. ZIP olarak arşivlenip AES-256-CBC ile şifrelenmiştir. Şifre çözüldüğünde düz bir .zip elde edilir; ek bir gzip/tar katmanı YOKTUR." . " Checksum: `{$frontendChecksum}`",
        '- `' . BACKUP_BACKEND_ARCHIVE_NAME . "` — public_html/api ağacının TAMAMI (PHP backend/API kodu; config.php ve config.local.php DAHİL), PLUS iki açıkça izin verilmiş özel dosya (akinal-private/ TAMAMI DEĞİL): `akinal-private/akinal-backup/backup-config.local.php` (Drive klasör kimliği + kimlik bilgisi yolu) ve yapılandırılmış Google Drive servis hesabı kimlik bilgisi JSON dosyası. `config.php`, `config.local.php` ve `backup-config.local.php` içindeki BACKUP_ENCRYPTION_KEY değeri bu arşive eklenmeden ÖNCE düzenlenmiştir (diğer tüm ayarlar aynen korunur) — aşağıdaki 'Önemli' bölümüne bakın. Aynı şekilde ZIP olarak arşivlenip şifrelenmiştir." . " Checksum: `{$backendChecksum}`.",
        '- `' . BACKUP_UPLOADS_ARCHIVE_NAME . "` — public_html/uploads ağacının TAMAMI (müşteri, proje, medya ve belge dosyaları), aynı şekilde ZIP olarak arşivlenip şifrelenmiştir." . " Checksum: `{$uploadsChecksum}`.",
        '- `' . BACKUP_DB_ARCHIVE_NAME . "` — tam MySQL dökümü (düz SQL metni), gzip ile sıkıştırılıp AES-256-CBC ile şifrelenmiştir." . " Checksum: `{$dbChecksum}`",
        '',
        '## Yeni bir cPanel hesabına geri yükleme adımları',
        '',
        '1. Yeni cPanel hesabında MySQL veritabanı ve kullanıcı oluşturun, kullanıcıya tam yetki verin.',
        '2. `' . BACKUP_FRONTEND_ARCHIVE_NAME . '`, `' . BACKUP_BACKEND_ARCHIVE_NAME . '` ve `' . BACKUP_UPLOADS_ARCHIVE_NAME . '` dosyalarını ayrıca ve güvenli şekilde sakladığınız BACKUP_ENCRYPTION_KEY ile çözün (bu anahtar hiçbir arşivin içinde YOKTUR — bkz. \'Önemli\'). `' . BACKUP_BACKEND_ARCHIVE_NAME . '` içeriğini yeni hesabın kök dizinine çıkarın (böylece hem `public_html/api` hem `akinal-private/akinal-backup/backup-config.local.php` doğru yerlere gider), `' . BACKUP_UPLOADS_ARCHIVE_NAME . '` içeriğini `public_html/uploads` klasörüne çıkarın. `' . BACKUP_FRONTEND_ARCHIVE_NAME . '` içinde iki ayrı katman vardır: içindeki `public_html/...` yollu dosyaları doğrudan yeni hesabın `public_html` klasörüne çıkarırsanız site anında ayağa kalkar (hazır derlenmiş çıktı); alternatif/tam kurtarma için aynı arşivin kökündeki `src/`, `package.json`, `vite.config.ts` vb. proje kaynak dosyalarını bir geliştirme makinesine kopyalayıp `npm install && npm run build` çalıştırarak `public_html` çıktısını sıfırdan yeniden üretebilirsiniz.',
        '3. `' . BACKUP_DB_ARCHIVE_NAME . '` dosyasını aynı şekilde çözüp gzip açın ve elde edilen .sql dosyasını yeni veritabanına aktarın (`mysql -u ... -p ... yeni_db < database.sql`). Bu paket kısmi ise, aktarımdan önce eksik nesneleri (yukarıya bakın) not edin.',
        '4. `public_html/api/config.php` içindeki `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS` değerlerini yeni sunucunun bilgileriyle güncelleyin (arşivdeki kopya ESKİ sunucunun bilgilerini içerir). Aynı dosyadaki `BACKUP_ENCRYPTION_KEY` satırı düzenlenmiştir — ayrı sakladığınız gerçek anahtarı buraya siz geri yazmalısınız.',
        '5. Alan adı (DNS) kayıtlarını yeni sunucuya yönlendirin ve SSL sertifikasını (ör. AutoSSL/Let\'s Encrypt) yeni hesapta etkinleştirin.',
        '6. Yedekleme Merkezi\'nin cron görevini yeni sunucuda yeniden kurun (bkz. docs/BACKUP_CENTER_SETUP.md). Google Drive servis hesabı kimlik bilgisi ve backup-config.local.php `' . BACKUP_BACKEND_ARCHIVE_NAME . '` içinde YER ALIR (adım 2\'de doğru konuma çıkarılır) — yalnızca BACKUP_ENCRYPTION_KEY\'in gerçek değerini siz ayrı kaynağınızdan geri girmeniz gerekir.',
        '7. Siteyi, admin girişini, medya dosyalarını ve örnek finansal kayıtları doğrulayın.',
        '',
        '## Önemli — Şifreleme Anahtarı',
        '',
        '- Bu paket şifrelenmiştir; **BACKUP_ENCRYPTION_KEY hiçbir arşivin, e-postanın veya bu belgenin içinde YOKTUR ve olmamalıdır** — anahtarı, korunan verilerden tamamen ayrı ve güvenli bir yerde (ör. çevrimdışı bir parola yöneticisi kaydı) saklayın. Anahtar olmadan hiçbir arşiv çözülemez.',
        '- `config.php`, `config.local.php` ve `backup-config.local.php` içindeki `BACKUP_ENCRYPTION_KEY` satırları bu pakete eklenmeden önce `[REDACTED_BEFORE_BACKUP_ARCHIVING]` ile değiştirilmiştir — bu, anahtarı kendi kendini şifrelediği arşivin içine koymamak için kasıtlıdır (aksi halde arşive erişen biri anahtarı da elde ederdi). Diğer tüm ayarlar (DB bilgileri, Drive klasör kimliği, vb.) olduğu gibi korunmuştur.',
        '- `config.php` arşivin içindedir ve eski sunucunun veritabanı parolasını İÇERİR — geri yükleme sonrası adım 4\'te mutlaka güncelleyin.',
        '- Bu belge (RECOVERY.md) hiçbir parola, API anahtarı veya Drive kimlik bilgisi içermez.',
    ];

    return implode("\n", $lines) . "\n";
}

function backup_manifest_archive_name_issues(array $manifest): array
{
    $issues = [];
    $archives = $manifest['archives'] ?? null;
    if (!is_array($archives)) {
        return ['manifest.archives alanı eksik.'];
    }
    $recognizedNames = [BACKUP_FRONTEND_ARCHIVE_NAME, BACKUP_BACKEND_ARCHIVE_NAME, BACKUP_UPLOADS_ARCHIVE_NAME, BACKUP_DB_ARCHIVE_NAME];
    foreach ($recognizedNames as $expected) {
        if (!array_key_exists($expected, $archives)) {
            $issues[] = "Beklenen arşiv adı manifest içinde yok: {$expected}";
        }
    }
    foreach (array_keys($archives) as $name) {
        if (!in_array($name, $recognizedNames, true)) {
            $issues[] = "manifest içinde tanınmayan/eski biçimli arşiv adı: {$name}";
        }
    }
    return $issues;
}
