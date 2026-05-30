<?php
declare(strict_types=1);

require_once __DIR__ . '/response.php';

function start_secure_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');

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

    return !empty($_SESSION['admin']) && is_array($_SESSION['admin']);
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
        json_error('Authentication required.', 401);
    }

    return $admin;
}

/*
 * Phase 3 will implement login/logout against ak_admin_users.
 * Expected flow:
 * - Look up ak_admin_users by email_lower = strtolower(email).
 * - Require is_active = 1.
 * - Verify submitted password with password_verify() against password_hash.
 * - Store only safe admin identity/session fields in $_SESSION['admin'].
 */
