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
    clear_last_push_error();

    if (!push_is_configured()) {
        $error = ['reason' => 'vapid_not_configured', 'message' => 'VAPID public/private keys are missing or still use placeholders.'];
        record_last_push_error($error);
        return ['sent' => 0, 'failed' => 0, 'skipped' => true, 'reason' => 'vapid_not_configured', 'errors' => [$error]];
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
    $errors = [];

    foreach ($subscriptions as $subscription) {
        try {
            $result = send_web_push($subscription, $payload);
        } catch (Throwable $exception) {
            $result = [
                'success' => false,
                'status' => 0,
                'error' => 'exception',
                'message' => $exception->getMessage(),
            ];
        }

        if ($result['success']) {
            $sent++;
            db()->prepare('UPDATE ak_push_subscriptions SET last_used_at = NOW() WHERE id = :id')->execute(['id' => $subscription['id']]);
            continue;
        }

        $failed++;
        $error = normalize_push_error($subscription, $result);
        $errors[] = $error;
        record_last_push_error($error);

        if (in_array((int) ($result['status'] ?? 0), [404, 410], true)) {
            db()->prepare('DELETE FROM ak_push_subscriptions WHERE id = :id')->execute(['id' => $subscription['id']]);
        }
    }

    return ['sent' => $sent, 'failed' => $failed, 'skipped' => false, 'errors' => $errors];
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
        $headerSize = (int) curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        $error = curl_error($ch);
        curl_close($ch);
        $rawResponse = is_string($response) ? $response : '';
        $responseHeaders = $headerSize > 0 ? substr($rawResponse, 0, $headerSize) : '';
        $responseBody = $headerSize > 0 ? substr($rawResponse, $headerSize) : $rawResponse;

        return [
            'success' => $status >= 200 && $status < 300,
            'status' => $status,
            'error' => $error ?: null,
            'response' => substr(trim($responseBody), 0, 2000),
            'response_headers' => substr(trim($responseHeaders), 0, 2000),
        ];
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

    return [
        'success' => $status >= 200 && $status < 300,
        'status' => $status,
        'error' => $response === false ? 'request_failed' : null,
        'response' => is_string($response) ? substr($response, 0, 1000) : null,
        'response_headers' => implode("\n", $http_response_header ?? []),
    ];
}

function create_vapid_jwt(string $endpoint): string
{
    $origin = vapid_audience_from_endpoint($endpoint);

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
    $offset = 0;
    if (ord($der[$offset++]) !== 0x30) {
        throw new RuntimeException('Invalid ECDSA signature sequence.');
    }
    read_der_length($der, $offset);

    if (ord($der[$offset++]) !== 0x02) {
        throw new RuntimeException('Invalid ECDSA signature R integer.');
    }
    $rLength = read_der_length($der, $offset);
    $r = substr($der, $offset, $rLength);
    $offset += $rLength;

    if (ord($der[$offset++]) !== 0x02) {
        throw new RuntimeException('Invalid ECDSA signature S integer.');
    }
    $sLength = read_der_length($der, $offset);
    $s = substr($der, $offset, $sLength);

    return left_pad_signature_part($r, (int) ($partLength / 2))
        . left_pad_signature_part($s, (int) ($partLength / 2));
}

function read_der_length(string $der, int &$offset): int
{
    $length = ord($der[$offset++]);
    if ($length < 0x80) {
        return $length;
    }

    $bytes = $length & 0x7f;
    $length = 0;
    for ($index = 0; $index < $bytes; $index++) {
        $length = ($length << 8) + ord($der[$offset++]);
    }
    return $length;
}

function left_pad_signature_part(string $value, int $length): string
{
    $value = ltrim($value, "\x00");
    if (strlen($value) > $length) {
        $value = substr($value, -$length);
    }
    return str_pad($value, $length, "\x00", STR_PAD_LEFT);
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

function normalize_push_error(array $subscription, array $result): array
{
    return [
        'subscription_id' => (string) ($subscription['id'] ?? ''),
        'endpoint_host' => parse_url((string) ($subscription['endpoint'] ?? ''), PHP_URL_HOST) ?: null,
        'audience' => vapid_audience_from_endpoint((string) ($subscription['endpoint'] ?? '')),
        'endpoint_hash' => (string) ($subscription['endpoint_hash'] ?? ''),
        'status' => (int) ($result['status'] ?? 0),
        'error' => $result['error'] ?? null,
        'message' => $result['message'] ?? null,
        'response' => $result['response'] ?? null,
        'response_headers' => $result['response_headers'] ?? null,
    ];
}

function record_last_push_error(array $error): void
{
    $payload = [
        'created_at' => gmdate('c'),
        'error' => $error,
    ];
    $path = last_push_error_path();
    @file_put_contents($path, json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
    error_log('Admin web push failure: ' . json_encode($error, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
}

function clear_last_push_error(): void
{
    $path = last_push_error_path();
    if (is_file($path)) {
        @unlink($path);
    }
}

function read_last_push_error(): ?array
{
    $path = last_push_error_path();
    if (!is_readable($path)) {
        return null;
    }

    $data = json_decode((string) file_get_contents($path), true);
    return is_array($data) ? $data : null;
}

function last_push_error_path(): string
{
    return sys_get_temp_dir() . '/akinal-admin-last-push-error.json';
}

function service_worker_detected(): bool
{
    $serverRootPath = dirname(__DIR__, 2) . '/admin-push-sw.js';
    $sourcePublicPath = dirname(__DIR__, 3) . '/public/admin-push-sw.js';
    return is_readable($serverRootPath) || is_readable($sourcePublicPath);
}

function push_subscription_count(?string $adminId = null): int
{
    ensure_push_subscriptions_table();
    if ($adminId !== null && $adminId !== '') {
        $stmt = db()->prepare('SELECT COUNT(*) FROM ak_push_subscriptions WHERE admin_id = :admin_id');
        $stmt->execute(['admin_id' => $adminId]);
        return (int) $stmt->fetchColumn();
    }
    return (int) db()->query('SELECT COUNT(*) FROM ak_push_subscriptions')->fetchColumn();
}

function push_subscription_diagnostics(?string $adminId = null): array
{
    ensure_push_subscriptions_table();
    if ($adminId !== null && $adminId !== '') {
        $stmt = db()->prepare('SELECT id, endpoint, endpoint_hash, p256dh, auth, user_agent, created_at, updated_at, last_used_at FROM ak_push_subscriptions WHERE admin_id = :admin_id ORDER BY updated_at DESC LIMIT 10');
        $stmt->execute(['admin_id' => $adminId]);
    } else {
        $stmt = db()->query('SELECT id, endpoint, endpoint_hash, p256dh, auth, user_agent, created_at, updated_at, last_used_at FROM ak_push_subscriptions ORDER BY updated_at DESC LIMIT 10');
    }

    return array_map(static function (array $row): array {
        return [
            'id' => $row['id'] ?? null,
            'endpoint_host' => parse_url((string) ($row['endpoint'] ?? ''), PHP_URL_HOST) ?: null,
            'audience' => vapid_audience_from_endpoint((string) ($row['endpoint'] ?? '')),
            'endpoint_hash' => $row['endpoint_hash'] ?? null,
            'has_p256dh' => trim((string) ($row['p256dh'] ?? '')) !== '',
            'has_auth' => trim((string) ($row['auth'] ?? '')) !== '',
            'p256dh_length' => strlen((string) ($row['p256dh'] ?? '')),
            'auth_length' => strlen((string) ($row['auth'] ?? '')),
            'user_agent' => $row['user_agent'] ?? null,
            'created_at' => $row['created_at'] ?? null,
            'updated_at' => $row['updated_at'] ?? null,
            'last_used_at' => $row['last_used_at'] ?? null,
        ];
    }, $stmt->fetchAll() ?: []);
}

function vapid_diagnostics(): array
{
    $publicKey = configured_vapid_public_key();
    $privateKey = configured_vapid_private_key();
    $privateResource = $privateKey !== '' ? openssl_pkey_get_private($privateKey) : false;
    $privateDetails = $privateResource ? openssl_pkey_get_details($privateResource) : false;
    $privatePublicKey = '';

    if (is_array($privateDetails) && isset($privateDetails['ec']['x'], $privateDetails['ec']['y'])) {
        $privatePublicKey = base64url_encode("\x04" . $privateDetails['ec']['x'] . $privateDetails['ec']['y']);
    }

    return [
        'configured' => push_is_configured(),
        'public_key_present' => $publicKey !== '' && $publicKey !== 'VAPID_PUBLIC_KEY_HERE',
        'private_key_present' => $privateKey !== '' && strpos($privateKey, 'VAPID_PRIVATE_KEY_PEM_HERE') === false,
        'subject_present' => configured_vapid_subject() !== '',
        'public_key_length' => strlen($publicKey),
        'vapid_public_fingerprint' => vapid_public_fingerprint(),
        'private_key_valid' => (bool) $privateResource,
        'public_private_key_match' => $privatePublicKey !== '' && hash_equals($privatePublicKey, $publicKey),
        'subject' => configured_vapid_subject(),
    ];
}

function vapid_audience_from_endpoint(string $endpoint): string
{
    $scheme = parse_url($endpoint, PHP_URL_SCHEME);
    $host = parse_url($endpoint, PHP_URL_HOST);
    if (!$scheme || !$host) {
        return '';
    }

    $origin = $scheme . '://' . $host;
    $port = parse_url($endpoint, PHP_URL_PORT);
    if ($port) {
        $origin .= ':' . $port;
    }
    return $origin;
}

function vapid_public_fingerprint(): ?string
{
    $publicKey = configured_vapid_public_key();
    if ($publicKey === '' || $publicKey === 'VAPID_PUBLIC_KEY_HERE') {
        return null;
    }
    return substr(hash('sha256', $publicKey), 0, 16);
}
