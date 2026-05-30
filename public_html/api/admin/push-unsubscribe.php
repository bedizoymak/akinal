<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/push-utils.php';

$admin = require_admin();
require_method('POST');

try {
    ensure_push_subscriptions_table();

    $input = read_admin_json_body();
    $endpoint = trim((string) ($input['endpoint'] ?? ''));

    if ($endpoint === '') {
        json_error('Push abonelik endpoint bilgisi eksik.');
    }

    $stmt = db()->prepare('DELETE FROM ak_push_subscriptions WHERE admin_id = :admin_id AND endpoint_hash = :endpoint_hash');
    $stmt->execute([
        'admin_id' => (string) $admin['id'],
        'endpoint_hash' => hash('sha256', $endpoint),
    ]);

    json_success(['unsubscribed' => true]);
} catch (Throwable $exception) {
    json_error('Push aboneliği kaldırılamadı.', 500, ['reason' => $exception->getMessage()]);
}
