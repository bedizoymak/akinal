<?php
declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth.php';

require_method('POST');

$input = read_json_body();
$email = strtolower(trim((string) ($input['email'] ?? '')));
$password = (string) ($input['password'] ?? '');
$rateLimitKey = login_rate_limit_key($email);

if ($email === '' || $password === '') {
    json_error('Invalid email or password.', 401);
}

if (is_login_rate_limited($rateLimitKey)) {
    json_error('Too many login attempts. Please try again later.', 429);
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
        record_failed_login($rateLimitKey);
        json_error('Invalid email or password.', 401);
    }

    clear_failed_login($rateLimitKey);
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

function login_rate_limit_key(string $email): string
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    return hash('sha256', strtolower($email) . '|' . $ip);
}

function login_rate_limit_path(string $key): string
{
    return sys_get_temp_dir() . '/akinal-login-' . $key . '.json';
}

function read_login_rate_limit(string $key): array
{
    $path = login_rate_limit_path($key);
    if (!is_file($path)) {
        return ['count' => 0, 'first_attempt' => time()];
    }

    $data = json_decode((string) file_get_contents($path), true);
    return is_array($data) ? $data : ['count' => 0, 'first_attempt' => time()];
}

function is_login_rate_limited(string $key): bool
{
    $data = read_login_rate_limit($key);
    $firstAttempt = (int) ($data['first_attempt'] ?? time());
    $count = (int) ($data['count'] ?? 0);

    if (time() - $firstAttempt > 900) {
        clear_failed_login($key);
        return false;
    }

    return $count >= 5;
}

function record_failed_login(string $key): void
{
    $data = read_login_rate_limit($key);
    $firstAttempt = (int) ($data['first_attempt'] ?? time());
    if (time() - $firstAttempt > 900) {
        $data = ['count' => 0, 'first_attempt' => time()];
    }

    $data['count'] = (int) ($data['count'] ?? 0) + 1;
    @file_put_contents(login_rate_limit_path($key), json_encode($data), LOCK_EX);
}

function clear_failed_login(string $key): void
{
    $path = login_rate_limit_path($key);
    if (is_file($path)) {
        @unlink($path);
    }
}
