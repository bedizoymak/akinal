<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/admin/push-utils.php';

require_method('POST');

$input = read_json_body();
$fullName = trim((string) ($input['full_name'] ?? ''));
$phone = trim((string) ($input['phone'] ?? ''));
$email = trim((string) ($input['email'] ?? ''));
$serviceType = trim((string) ($input['service_type'] ?? ''));
$message = trim((string) ($input['message'] ?? ''));

if ($fullName === '' || text_length($fullName) < 2 || text_length($fullName) > 100) {
    json_error('Ad Soyad zorunludur.');
}
if ($phone === '' || text_length($phone) < 7 || text_length($phone) > 30) {
    json_error('Telefon numarası zorunludur.');
}
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_error('Geçerli bir e-posta giriniz.');
}
if ($serviceType === '') {
    json_error('Lütfen bir hizmet seçin.');
}
if ($message === '' || text_length($message) < 5 || text_length($message) > 2000) {
    json_error('Mesajınızı yazınız.');
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

    try {
        send_push_to_all_admins([
            'title' => 'Yeni İletişim Talebi',
            'body' => $fullName . ' tarafından yeni bir iletişim talebi gönderildi.',
            'url' => '/admin/talepler',
            'icon' => '/favicon.png',
        ]);
    } catch (Throwable $pushException) {
        // Contact requests must remain reliable even if browser push delivery is unavailable.
    }

    json_success(['id' => $contactId]);
} catch (Throwable $exception) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    json_error('Talebiniz gönderilemedi.', 500);
}

function read_json_body(): array
{
    $body = file_get_contents('php://input') ?: '{}';
    $data = json_decode($body, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        json_error('Geçersiz JSON gövdesi.');
    }
    return is_array($data) ? $data : [];
}

function text_length(string $value): int
{
    return function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value);
}

function uuid_v4(): string
{
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}
