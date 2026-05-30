<?php
declare(strict_types=1);

function ensure_push_subscriptions_table(): void
{
    db()->exec(
        'CREATE TABLE IF NOT EXISTS ak_push_subscriptions (
            id VARCHAR(36) NOT NULL PRIMARY KEY,
            admin_id VARCHAR(191) NOT NULL,
            endpoint TEXT NOT NULL,
            endpoint_hash CHAR(64) NOT NULL,
            p256dh TEXT NOT NULL,
            auth TEXT NOT NULL,
            user_agent TEXT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            last_used_at DATETIME NULL,
            UNIQUE KEY ak_push_endpoint_hash_unique (endpoint_hash),
            KEY ak_push_admin_id_index (admin_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
}

function configured_vapid_public_key(): string
{
    return defined('VAPID_PUBLIC_KEY') ? trim((string) VAPID_PUBLIC_KEY) : '';
}

function configured_vapid_private_key(): string
{
    return defined('VAPID_PRIVATE_KEY') ? trim((string) VAPID_PRIVATE_KEY) : '';
}

function configured_vapid_subject(): string
{
    $subject = defined('VAPID_SUBJECT') ? trim((string) VAPID_SUBJECT) : '';
    return $subject !== '' ? $subject : 'mailto:admin@akinalinsaat.com';
}

function push_is_configured(): bool
{
    return configured_vapid_public_key() !== ''
        && configured_vapid_public_key() !== 'VAPID_PUBLIC_KEY_HERE'
        && configured_vapid_private_key() !== ''
        && configured_vapid_private_key() !== 'VAPID_PRIVATE_KEY_PEM_HERE'
        && strpos(configured_vapid_private_key(), 'VAPID_PRIVATE_KEY_PEM_HERE') === false;
}

function send_push_to_all_admins(array $payload, ?string $adminId = null): array
{
    ensure_push_subscriptions_table();

    if (!push_is_configured()) {
        return ['sent' => 0, 'failed' => 0, 'skipped' => true, 'reason' => 'vapid_not_configured'];
    }

    if ($adminId !== null && $adminId !== '') {
        $statement = db()->prepare('SELECT * FROM ak_push_subscriptions WHERE admin_id = :admin_id ORDER BY updated_at DESC');
        $statement->execute(['admin_id' => $adminId]);
    } else {
        $statement = db()->query('SELECT * FROM ak_push_subscriptions ORDER BY updated_at DESC');
    }
    $subscriptions = $statement->fetchAll() ?: [];
    $sent = 0;
    $failed = 0;

    foreach ($subscriptions as $subscription) {
        $result = send_web_push($subscription, $payload);
        if ($result['success']) {
            $sent++;
            db()->prepare('UPDATE ak_push_subscriptions SET last_used_at = NOW() WHERE id = :id')->execute(['id' => $subscription['id']]);
            continue;
        }

        $failed++;
        if (in_array((int) ($result['status'] ?? 0), [404, 410], true)) {
            db()->prepare('DELETE FROM ak_push_subscriptions WHERE id = :id')->execute(['id' => $subscription['id']]);
        }
    }

    return ['sent' => $sent, 'failed' => $failed, 'skipped' => false];
}

function send_web_push(array $subscription, array $payload): array
{
    $endpoint = (string) ($subscription['endpoint'] ?? '');
    $userPublicKey = base64url_decode((string) ($subscription['p256dh'] ?? ''));
    $userAuth = base64url_decode((string) ($subscription['auth'] ?? ''));

    if ($endpoint === '' || strlen($userPublicKey) !== 65 || strlen($userAuth) < 16) {
        return ['success' => false, 'status' => 0, 'error' => 'invalid_subscription'];
    }

    $serverKey = openssl_pkey_new([
        'private_key_type' => OPENSSL_KEYTYPE_EC,
        'curve_name' => 'prime256v1',
    ]);
    if ($serverKey === false) {
        return ['success' => false, 'status' => 0, 'error' => 'ephemeral_key_failed'];
    }

    $details = openssl_pkey_get_details($serverKey);
    $serverPublicKey = "\x04" . ($details['ec']['x'] ?? '') . ($details['ec']['y'] ?? '');
    $userPublicPem = ec_public_key_to_pem($userPublicKey);
    $userKey = openssl_pkey_get_public($userPublicPem);
    $sharedSecret = $userKey ? openssl_pkey_derive($userKey, $serverKey, 32) : false;

    if (!is_string($sharedSecret) || strlen($serverPublicKey) !== 65) {
        return ['success' => false, 'status' => 0, 'error' => 'shared_secret_failed'];
    }

    $salt = random_bytes(16);
    $context = "WebPush: info\0" . $userPublicKey . $serverPublicKey;
    $ikm = hkdf_sha256($sharedSecret, 32, $context, $userAuth);
    $contentEncryptionKey = hkdf_sha256($ikm, 16, "Content-Encoding: aes128gcm\0", $salt);
    $nonce = hkdf_sha256($ikm, 12, "Content-Encoding: nonce\0", $salt);
    $plaintext = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\x02";
    $tag = '';
    $ciphertext = openssl_encrypt($plaintext, 'aes-128-gcm', $contentEncryptionKey, OPENSSL_RAW_DATA, $nonce, $tag);

    if (!is_string($ciphertext)) {
        return ['success' => false, 'status' => 0, 'error' => 'encryption_failed'];
    }

    $body = $salt . pack('N', 4096) . chr(strlen($serverPublicKey)) . $serverPublicKey . $ciphertext . $tag;
    $headers = [
        'Content-Type: application/octet-stream',
        'Content-Encoding: aes128gcm',
        'TTL: 2419200',
        'Authorization: vapid t=' . create_vapid_jwt($endpoint) . ', k=' . configured_vapid_public_key(),
    ];

    return push_http_post($endpoint, $headers, $body);
}

function push_http_post(string $endpoint, array $headers, string $body): array
{
    if (function_exists('curl_init')) {
        $ch = curl_init($endpoint);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HEADER => true,
            CURLOPT_TIMEOUT => 10,
        ]);
        $response = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        return ['success' => $status >= 200 && $status < 300, 'status' => $status, 'error' => $error ?: null, 'response' => is_string($response) ? substr($response, 0, 500) : null];
    }

    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => implode("\r\n", $headers),
            'content' => $body,
            'timeout' => 10,
            'ignore_errors' => true,
        ],
    ]);
    $response = @file_get_contents($endpoint, false, $context);
    $status = 0;
    foreach (($http_response_header ?? []) as $header) {
        if (preg_match('/^HTTP\/\S+\s+(\d+)/', $header, $match)) {
            $status = (int) $match[1];
            break;
        }
    }

    return ['success' => $status >= 200 && $status < 300, 'status' => $status, 'error' => $response === false ? 'request_failed' : null];
}

function create_vapid_jwt(string $endpoint): string
{
    $origin = parse_url($endpoint, PHP_URL_SCHEME) . '://' . parse_url($endpoint, PHP_URL_HOST);
    $port = parse_url($endpoint, PHP_URL_PORT);
    if ($port) {
        $origin .= ':' . $port;
    }

    $header = base64url_encode(json_encode(['typ' => 'JWT', 'alg' => 'ES256'], JSON_UNESCAPED_SLASHES));
    $claims = base64url_encode(json_encode([
        'aud' => $origin,
        'exp' => time() + 43200,
        'sub' => configured_vapid_subject(),
    ], JSON_UNESCAPED_SLASHES));
    $unsigned = $header . '.' . $claims;
    $privateKey = openssl_pkey_get_private(configured_vapid_private_key());

    if (!$privateKey || !openssl_sign($unsigned, $derSignature, $privateKey, OPENSSL_ALGO_SHA256)) {
        throw new RuntimeException('VAPID private key could not sign push request.');
    }

    return $unsigned . '.' . base64url_encode(ecdsa_der_to_raw($derSignature, 64));
}

function ec_public_key_to_pem(string $rawPublicKey): string
{
    $prefix = hex2bin('3059301306072A8648CE3D020106082A8648CE3D030107034200');
    return "-----BEGIN PUBLIC KEY-----\n"
        . chunk_split(base64_encode($prefix . $rawPublicKey), 64, "\n")
        . "-----END PUBLIC KEY-----\n";
}

function ecdsa_der_to_raw(string $der, int $partLength): string
{
    $offset = 3;
    if (ord($der[1]) > 0x80) {
        $offset += ord($der[1]) - 0x80;
    }
    $rLength = ord($der[$offset + 1]);
    $r = substr($der, $offset + 2, $rLength);
    $offset += 2 + $rLength;
    $sLength = ord($der[$offset + 1]);
    $s = substr($der, $offset + 2, $sLength);

    return str_pad(ltrim($r, "\x00"), $partLength / 2, "\x00", STR_PAD_LEFT)
        . str_pad(ltrim($s, "\x00"), $partLength / 2, "\x00", STR_PAD_LEFT);
}

function hkdf_sha256(string $inputKey, int $length, string $info = '', string $salt = ''): string
{
    $salt = $salt !== '' ? $salt : str_repeat("\0", 32);
    $prk = hash_hmac('sha256', $inputKey, $salt, true);
    $output = '';
    $block = '';
    for ($counter = 1; strlen($output) < $length; $counter++) {
        $block = hash_hmac('sha256', $block . $info . chr($counter), $prk, true);
        $output .= $block;
    }
    return substr($output, 0, $length);
}

function base64url_encode(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64url_decode(string $data): string
{
    $remainder = strlen($data) % 4;
    if ($remainder) {
        $data .= str_repeat('=', 4 - $remainder);
    }
    return base64_decode(strtr($data, '-_', '+/')) ?: '';
}
