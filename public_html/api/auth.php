<?php
declare(strict_types=1);

require_once __DIR__ . '/response.php';

function start_secure_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $secure = is_https_request();

    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'domain' => '',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);

    session_start();
}

function is_admin_logged_in(): bool
{
    start_secure_session();

    return !empty($_SESSION['admin']) && is_array($_SESSION['admin']) && !empty($_SESSION['admin']['id']);
}

function current_admin(): ?array
{
    start_secure_session();

    return is_admin_logged_in() ? $_SESSION['admin'] : null;
}

function require_admin(): array
{
    $admin = current_admin();

    if ($admin === null) {
        json_error('Oturum açmanız gerekiyor.', 401);
    }

    if (($admin['role'] ?? '') !== 'admin') {
        json_error('Bu işlem için yönetici yetkisi gerekiyor.', 403);
    }

    require_once __DIR__ . '/db.php';
    $statement = db()->prepare('SELECT id, email, role, is_active FROM ak_admin_users WHERE id = :id LIMIT 1');
    $statement->execute(['id' => (string) $admin['id']]);
    $current = $statement->fetch();

    if (!$current || (int) ($current['is_active'] ?? 0) !== 1 || ($current['role'] ?? '') !== 'admin') {
        logout_admin_session();
        json_error('Yönetici oturumu artık geçerli değil.', 403);
    }

    $current['full_name'] = $admin['full_name'] ?? null;
    set_current_admin_without_regeneration($current);
    return current_admin() ?? $admin;
}

function set_current_admin(array $admin): void
{
    start_secure_session();
    session_regenerate_id(true);
    set_current_admin_without_regeneration($admin);
}

function set_current_admin_without_regeneration(array $admin): void
{
    start_secure_session();
    $_SESSION['admin'] = [
        'id' => (string) ($admin['id'] ?? ''),
        'email' => (string) ($admin['email'] ?? ''),
        'full_name' => $admin['full_name'] ?? null,
        'role' => (string) ($admin['role'] ?? 'admin'),
    ];
}

function logout_admin_session(): void
{
    start_secure_session();
    $_SESSION = [];

    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', [
            'expires' => time() - 42000,
            'path' => $params['path'],
            'domain' => $params['domain'],
            'secure' => (bool) $params['secure'],
            'httponly' => (bool) $params['httponly'],
            'samesite' => $params['samesite'] ?? 'Lax',
        ]);
    }

    session_destroy();
}

function is_https_request(): bool
{
    if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
        return true;
    }

    return strtolower($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
}
