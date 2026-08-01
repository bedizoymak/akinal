<?php
declare(strict_types=1);

require_once __DIR__ . '/backup-lib.php';

$admin = require_admin();
require_method('GET');
backup_ensure_tables();

$fileId = trim((string) ($_GET['file_id'] ?? ''));
$name = trim((string) ($_GET['name'] ?? 'akinal-yedek-dosyasi'));
$safeName = preg_replace('/[^a-zA-Z0-9._-]+/', '-', $name) ?: 'akinal-yedek-dosyasi';

if ($fileId === '') {
    json_error('Dosya kimliği eksik.');
}
if (!backup_capabilities()['gdrive_configured']) {
    json_error('Google Drive yapılandırılmamış.', 500);
}

try {
    gdrive_verify_system_owned($fileId);
} catch (Throwable $exception) {
    backup_log('Rejected drive download for file_id=' . $fileId . ': ' . $exception->getMessage());
    json_error('Bu dosya indirilemiyor: ' . $exception->getMessage(), 403);
}

backup_audit($admin, 'drive_download', json_encode(['file_id' => $fileId, 'name' => $safeName]));
backup_log('Drive file downloaded by ' . ($admin['email'] ?? 'unknown') . ': ' . $safeName . ' (' . $fileId . ')');

header('Content-Type: application/octet-stream');
header('Content-Disposition: attachment; filename="' . $safeName . '"');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store, no-cache, must-revalidate');

while (ob_get_level() > 0) {
    ob_end_clean();
}

try {
    gdrive_download_to_stream($fileId);
} catch (Throwable $exception) {
    backup_log('Drive download stream failed: ' . $exception->getMessage());
}
exit;
