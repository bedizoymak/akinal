<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/push-utils.php';

$admin = require_admin();
require_method('GET');

try {
    $adminId = (string) ($admin['id'] ?? '');

    json_success([
        'subscription_count' => push_subscription_count($adminId),
        'service_worker_detected' => service_worker_detected(),
        'vapid_config_present' => push_is_configured(),
        'vapid' => vapid_diagnostics(),
        'subscriptions' => push_subscription_diagnostics($adminId),
        'last_push_error' => read_last_push_error(),
    ]);
} catch (Throwable $exception) {
    json_error('Push tanılama bilgileri alınamadı.', 500, ['reason' => $exception->getMessage()]);
}
