<?php
declare(strict_types=1);

require_once __DIR__ . '/backup-lib.php';

$admin = require_admin();
require_method('GET');
backup_ensure_tables();

$type = (string) ($_GET['type'] ?? '');
if (!in_array($type, ['site', 'database'], true)) {
    json_error('Geçersiz yedek türü.');
}

$workDir = backup_work_dir() . '/manual-' . date('Ymd-His') . '-' . bin2hex(random_bytes(4));
if (!mkdir($workDir, 0700, true)) {
    json_error('Geçici klasör oluşturulamadı.', 500);
}

$stamp = date('Y-m-d_H-i-s');

try {
    if ($type === 'site') {
        $archivePath = $workDir . '/public_html-' . $stamp . '.zip';
        $result = backup_build_site_archive($archivePath);
        $downloadName = 'akinal-site-yedek-' . $stamp . '.zip';
        $mime = 'application/zip';
    } else {
        $sqlPath = $workDir . '/database-' . $stamp . '.sql';
        $result = backup_dump_database($sqlPath);
        $gzPath = $sqlPath . '.gz';
        backup_gzip_file($sqlPath, $gzPath);
        @unlink($sqlPath);
        $archivePath = $gzPath;
        // Never call a PDO-fallback/partial export a "tam yedek" — the filename
        // and audit log must be honest about which kind of export this actually is,
        // independent of what the UI button happened to say when clicked.
        $downloadName = ($result['complete'] ? 'akinal-veritabani-TAM-yedek-' : 'akinal-veritabani-KISMI-yedek-') . $stamp . '.sql.gz';
        $mime = 'application/gzip';
    }
} catch (Throwable $exception) {
    backup_rrmdir($workDir);
    backup_log('Manual download failed (' . $type . '): ' . $exception->getMessage());
    json_error('Yedek oluşturulamadı: ' . $exception->getMessage(), 500);
}

backup_audit($admin, 'manual_download_' . $type, $downloadName . (isset($result['complete']) ? (' complete=' . ($result['complete'] ? '1' : '0')) : ''));
backup_log('Manual ' . $type . ' download by ' . ($admin['email'] ?? 'unknown') . ': ' . $downloadName);

if ($type === 'database') {
    header('X-Backup-Complete: ' . ($result['complete'] ? '1' : '0'));
    if (!$result['complete']) {
        header('X-Backup-Warning: kismi-veritabani-yedegi-tam-degil');
    }
}

$size = filesize($archivePath) ?: 0;

header('Content-Type: ' . $mime);
header('Content-Disposition: attachment; filename="' . $downloadName . '"');
header('Content-Length: ' . $size);
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store, no-cache, must-revalidate');

while (ob_get_level() > 0) {
    ob_end_clean();
}

readfile($archivePath);
backup_rrmdir($workDir);
exit;
