<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

require_method('POST');

$input = read_json_body();
$consentStatus = trim((string) ($input['consent_status'] ?? ''));
$allowedStatuses = ['accepted', 'rejected', 'managed'];

if (!in_array($consentStatus, $allowedStatuses, true)) {
    json_error('Geçersiz çerez tercihi.');
}

try {
    $pdo = db();
    $stmt = $pdo->prepare(
        'INSERT INTO ak_cookie_consents (id, consent_status, necessary, analytics, marketing, user_agent, created_at)
         VALUES (:id, :consent_status, :necessary, :analytics, :marketing, :user_agent, NOW())'
    );
    $stmt->execute([
        'id' => uuid_v4(),
        'consent_status' => $consentStatus,
        'necessary' => normalize_bool($input['necessary'] ?? true),
        'analytics' => normalize_bool($input['analytics'] ?? false),
        'marketing' => normalize_bool($input['marketing'] ?? false),
        'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? null,
    ]);

    json_success(['stored' => true]);
} catch (Throwable $exception) {
    json_error('Çerez tercihi kaydedilemedi.', 500);
}

function read_json_body(): array
{
    $data = json_decode(file_get_contents('php://input') ?: '{}', true);
    return is_array($data) ? $data : [];
}

function normalize_bool($value): int
{
    if ($value === true || $value === 1 || $value === '1') {
        return 1;
    }
    return 0;
}

function uuid_v4(): string
{
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}
