<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

require_method('POST');

$input = read_json_body();
$fullName = trim((string) ($input['full_name'] ?? ''));
$phone = trim((string) ($input['phone'] ?? ''));
$email = trim((string) ($input['email'] ?? ''));
$serviceType = trim((string) ($input['service_type'] ?? ''));
$message = trim((string) ($input['message'] ?? ''));
$turnstileToken = trim((string) ($input['turnstileToken'] ?? $input['turnstile_token'] ?? ''));

if ($fullName === '' || strlen($fullName) < 2 || strlen($fullName) > 100) {
    json_error('Ad Soyad zorunludur.');
}
if ($phone === '' || strlen($phone) < 7 || strlen($phone) > 30) {
    json_error('Telefon numarası zorunludur.');
}
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_error('Geçerli bir e-posta giriniz.');
}
if ($message === '' || strlen($message) < 5 || strlen($message) > 2000) {
    json_error('Mesajınızı yazınız.');
}
if ($turnstileToken === '') {
    json_error('Güvenlik doğrulaması gerekli.');
}
if (!defined('TURNSTILE_SECRET_KEY') || TURNSTILE_SECRET_KEY === '' || TURNSTILE_SECRET_KEY === 'TURNSTILE_SECRET_KEY_HERE') {
    json_error('Güvenlik doğrulaması sunucuda yapılandırılmamış.', 500);
}
if (!verify_turnstile($turnstileToken)) {
    json_error('Güvenlik doğrulaması başarısız.');
}

try {
    $pdo = db();
    $contactId = uuid_v4();
    $notificationId = uuid_v4();

    $pdo->beginTransaction();
    $stmt = $pdo->prepare(
        'INSERT INTO ak_contact_requests (id, full_name, phone, email, service_type, message, status, created_at)
         VALUES (:id, :full_name, :phone, :email, :service_type, :message, :status, NOW())'
    );
    $stmt->execute([
        'id' => $contactId,
        'full_name' => $fullName,
        'phone' => $phone,
        'email' => $email !== '' ? $email : null,
        'service_type' => $serviceType !== '' ? $serviceType : null,
        'message' => $message,
        'status' => 'Yeni',
    ]);

    $notificationStmt = $pdo->prepare(
        'INSERT INTO ak_notifications (id, title, message, type, priority, is_read, created_at)
         VALUES (:id, :title, :message, :type, :priority, 0, NOW())'
    );
    $notificationStmt->execute([
        'id' => $notificationId,
        'title' => 'Yeni İletişim Talebi',
        'message' => 'Web sitesi üzerinden ' . $fullName . ' tarafından yeni bir iletişim talebi alındı.',
        'type' => 'Yeni İletişim Talebi',
        'priority' => 'Yüksek',
    ]);

    $pdo->commit();

    json_success(['id' => $contactId]);
} catch (Throwable $exception) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    json_error('Talebiniz gönderilemedi.', 500);
}

function read_json_body(): array
{
    $data = json_decode(file_get_contents('php://input') ?: '{}', true);
    return is_array($data) ? $data : [];
}

function verify_turnstile(string $token): bool
{
    $payload = http_build_query([
        'secret' => TURNSTILE_SECRET_KEY,
        'response' => $token,
        'remoteip' => $_SERVER['REMOTE_ADDR'] ?? null,
    ]);

    $response = false;
    if (function_exists('curl_init')) {
        $ch = curl_init('https://challenges.cloudflare.com/turnstile/v0/siteverify');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 8,
            CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
        ]);
        $response = curl_exec($ch);
        curl_close($ch);
    } else {
        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
                'content' => $payload,
                'timeout' => 8,
            ],
        ]);
        $response = file_get_contents('https://challenges.cloudflare.com/turnstile/v0/siteverify', false, $context);
    }

    if (!is_string($response)) {
        return false;
    }

    $decoded = json_decode($response, true);
    return is_array($decoded) && ($decoded['success'] ?? false) === true;
}

function uuid_v4(): string
{
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}
