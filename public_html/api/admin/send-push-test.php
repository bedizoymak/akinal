<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/push-utils.php';

$admin = require_admin();
require_method('POST');

try {
    $result = send_push_to_all_admins([
        'title' => 'Akinal İnşaat Test Bildirimi',
        'body' => 'Bu cihazda admin web push bildirimleri çalışıyor.',
        'url' => '/admin/bildirimler',
        'icon' => '/favicon.png',
    ], (string) $admin['id']);

    json_success($result);
} catch (Throwable $exception) {
    record_last_push_error([
        'status' => 0,
        'error' => 'exception',
        'message' => $exception->getMessage(),
    ]);
    json_error('Test bildirimi gönderilemedi.', 500, ['reason' => $exception->getMessage()]);
}
