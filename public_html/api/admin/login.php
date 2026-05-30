<?php
declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth.php';

require_method('POST');

$input = read_json_body();
$email = strtolower(trim((string) ($input['email'] ?? '')));
$password = (string) ($input['password'] ?? '');

if ($email === '' || $password === '') {
    json_error('Invalid email or password.', 401);
}

try {
    $pdo = db();
    $columns = get_table_columns($pdo, 'ak_admin_users');
    $select = ['id', 'email', 'password_hash', 'role', 'is_active'];
    if (in_array('full_name', $columns, true)) {
        $select[] = 'full_name';
    }

    $stmt = $pdo->prepare('SELECT ' . implode(', ', array_map(fn($column) => "`{$column}`", $select)) . ' FROM ak_admin_users WHERE email_lower = :email_lower LIMIT 1');
    $stmt->execute(['email_lower' => $email]);
    $admin = $stmt->fetch();

    if (!$admin || (int) ($admin['is_active'] ?? 0) !== 1 || empty($admin['password_hash']) || !password_verify($password, (string) $admin['password_hash'])) {
        json_error('Invalid email or password.', 401);
    }

    set_current_admin($admin);

    json_success([
        'admin' => current_admin(),
    ]);
} catch (Throwable $exception) {
    json_error('Login failed.', 500);
}

function read_json_body(): array
{
    $body = file_get_contents('php://input');
    $data = json_decode($body ?: '{}', true);
    return is_array($data) ? $data : [];
}

function get_table_columns(PDO $pdo, string $table): array
{
    $stmt = $pdo->query('SHOW COLUMNS FROM ' . $table);
    return array_map(static fn($row) => $row['Field'], $stmt->fetchAll());
}
