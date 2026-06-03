<?php
declare(strict_types=1);

const CREATE_ADMIN_CONFIRM = 'CREATE_AKINAL_ADMIN';
const ENABLE_SETUP_TOOL = false;

header('X-Content-Type-Options: nosniff');
header('Content-Type: text/plain; charset=utf-8');

if (!ENABLE_SETUP_TOOL) {
    http_response_code(403);
    echo "This admin creation tool is disabled for launch readiness.\n";
    echo "Enable it only in a temporary setup copy, create the admin, then delete that copy immediately.\n";
    exit;
}

if (($_GET['confirm'] ?? '') !== CREATE_ADMIN_CONFIRM) {
    http_response_code(403);
    echo "Refused.\n";
    echo "Open with ?confirm=" . CREATE_ADMIN_CONFIRM . " to create the first admin user.\n";
    exit;
}

require_once __DIR__ . '/api/db.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    show_form();
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    http_response_code(405);
    header('Allow: GET, POST');
    exit('Method not allowed.');
}

$input = read_input();
$email = strtolower(trim((string) ($input['email'] ?? '')));
$password = (string) ($input['password'] ?? '');
$fullName = trim((string) ($input['full_name'] ?? ''));

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    fail_text('Invalid email.');
}

if (strlen($password) < 10) {
    fail_text('Password must be at least 10 characters.');
}

try {
    $pdo = db();
    $columns = get_table_columns($pdo, 'ak_admin_users');
    $hasFullName = in_array('full_name', $columns, true);
    $hasUpdatedAt = in_array('updated_at', $columns, true);
    $id = uuid_v4();
    $passwordHash = password_hash($password, PASSWORD_DEFAULT);

    $insertColumns = ['id', 'email', 'email_lower', 'password_hash', 'role', 'is_active'];
    $values = [
        'id' => $id,
        'email' => $email,
        'email_lower' => $email,
        'password_hash' => $passwordHash,
        'role' => 'admin',
        'is_active' => 1,
    ];

    if ($hasFullName) {
        $insertColumns[] = 'full_name';
        $values['full_name'] = $fullName !== '' ? $fullName : null;
    }

    $updates = [
        '`email` = VALUES(`email`)',
        '`password_hash` = VALUES(`password_hash`)',
        '`role` = VALUES(`role`)',
        '`is_active` = VALUES(`is_active`)',
    ];
    if ($hasFullName) {
        $updates[] = '`full_name` = VALUES(`full_name`)';
    }
    if ($hasUpdatedAt) {
        $updates[] = '`updated_at` = CURRENT_TIMESTAMP';
    }

    $sql = 'INSERT INTO ak_admin_users (`' . implode('`, `', $insertColumns) . '`) VALUES (:' . implode(', :', $insertColumns) . ') ON DUPLICATE KEY UPDATE ' . implode(', ', $updates);
    $stmt = $pdo->prepare($sql);
    $stmt->execute($values);

    header('Content-Type: text/plain; charset=utf-8');
    echo "Admin user created or updated successfully.\n";
    echo "Email: {$email}\n";
    echo "Delete public_html/create-admin-user.php immediately.\n";
} catch (Throwable $exception) {
    fail_text('Admin user creation failed. Check server logs.');
}

function read_input(): array
{
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    if (stripos($contentType, 'application/json') !== false) {
        $data = json_decode(file_get_contents('php://input') ?: '{}', true);
        return is_array($data) ? $data : [];
    }

    return $_POST;
}

function show_form(): void
{
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Admin Oluştur</title></head><body>';
    echo '<h1>Akinal Admin Oluştur</h1>';
    echo '<p>Bu geçici dosyayı admin oluşturduktan sonra hemen silin.</p>';
    echo '<form method="post">';
    echo '<p><label>Ad Soyad<br><input name="full_name" autocomplete="name"></label></p>';
    echo '<p><label>E-posta<br><input name="email" type="email" required autocomplete="email"></label></p>';
    echo '<p><label>Şifre<br><input name="password" type="password" required minlength="10" autocomplete="new-password"></label></p>';
    echo '<p><button type="submit">Admin Oluştur</button></p>';
    echo '</form></body></html>';
    exit;
}

function get_table_columns(PDO $pdo, string $table): array
{
    $stmt = $pdo->query('SHOW COLUMNS FROM ' . $table);
    return array_map(static fn($row) => $row['Field'], $stmt->fetchAll());
}

function uuid_v4(): string
{
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function fail_text(string $message): void
{
    http_response_code(400);
    header('Content-Type: text/plain; charset=utf-8');
    echo $message . "\n";
    exit;
}
