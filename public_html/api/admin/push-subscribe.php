<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/push-utils.php';

$admin = require_admin();
require_method('POST');

try {
    ensure_push_subscriptions_table();

    $input = read_admin_json_body();

    if (($input['action'] ?? '') === 'config') {
        json_success([
            'public_key' => configured_vapid_public_key(),
            'configured' => push_is_configured(),
        ]);
    }

    if (!push_is_configured()) {
        json_error('Web push VAPID anahtarları sunucuda yapılandırılmamış.', 500);
    }

    $subscription = $input['subscription'] ?? $input;
    $endpoint = trim((string) ($subscription['endpoint'] ?? ''));
    $keys = is_array($subscription['keys'] ?? null) ? $subscription['keys'] : [];
    $p256dh = trim((string) ($keys['p256dh'] ?? ''));
    $auth = trim((string) ($keys['auth'] ?? ''));

    if ($endpoint === '' || $p256dh === '' || $auth === '') {
        json_error('Geçerli push aboneliği alınamadı.');
    }

    $id = uuid_v4();
    $hash = hash('sha256', $endpoint);
    $stmt = db()->prepare(
        'INSERT INTO ak_push_subscriptions (id, admin_id, endpoint, endpoint_hash, p256dh, auth, user_agent, created_at, updated_at)
         VALUES (:id, :admin_id, :endpoint, :endpoint_hash, :p256dh, :auth, :user_agent, NOW(), NOW())
         ON DUPLICATE KEY UPDATE admin_id = VALUES(admin_id), p256dh = VALUES(p256dh), auth = VALUES(auth), user_agent = VALUES(user_agent), updated_at = NOW()'
    );
    $stmt->execute([
        'id' => $id,
        'admin_id' => (string) $admin['id'],
        'endpoint' => $endpoint,
        'endpoint_hash' => $hash,
        'p256dh' => $p256dh,
        'auth' => $auth,
        'user_agent' => substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 500),
    ]);

    json_success(['subscribed' => true]);
} catch (Throwable $exception) {
    json_error('Push aboneliği kaydedilemedi.', 500, ['reason' => $exception->getMessage()]);
}
