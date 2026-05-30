<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/push-utils.php';

$admin = require_admin();
require_method('GET');

try {
    $adminId = (string) ($admin['id'] ?? '');
    $subscriptions = push_subscription_diagnostics($adminId);
    $latestSubscription = $subscriptions[0] ?? [];

    json_success([
        'subscription_count' => push_subscription_count($adminId),
        'service_worker_detected' => service_worker_detected(),
        'vapid_config_present' => push_is_configured(),
        'audience' => $latestSubscription['audience'] ?? '',
        'endpoint_host' => $latestSubscription['endpoint_host'] ?? null,
        'vapid_public_fingerprint' => vapid_public_fingerprint(),
        'vapid' => vapid_diagnostics(),
        'subscriptions' => $subscriptions,
        'last_push_error' => read_last_push_error(),
    ]);
} catch (Throwable $exception) {
    json_error('Push tanılama bilgileri alınamadı.', 500, ['reason' => $exception->getMessage()]);
}
