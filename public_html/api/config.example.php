<?php
declare(strict_types=1);

/**
 * Example API database config.
 *
 * Copy this file to config.php on the production server only, then replace the
 * placeholder values there. Do not commit config.php or real credentials.
 */

if (!defined('AK_API_INTERNAL')) {
    http_response_code(403);
    exit('Forbidden');
}

define('DB_HOST', 'localhost');
define('DB_NAME', 'akinalin_wp282');
define('DB_USER', 'MYSQL_USERNAME_HERE');
define('DB_PASS', 'MYSQL_PASSWORD_HERE');

// Required by POST /api/contact-request.php.
// Create a server-side Cloudflare Turnstile secret for the same site key used
// by VITE_TURNSTILE_SITE_KEY, then set the real value in config.php only.
define('TURNSTILE_SECRET_KEY', 'TURNSTILE_SECRET_KEY_HERE');

// Temporary one-time token for /api/admin/run-demo-import.php.
// Set a long random value in production config.php only, run the import once,
// then delete run-demo-import.php from the server immediately.
define('DEMO_IMPORT_TOKEN', 'LONG_RANDOM_DEMO_IMPORT_TOKEN_HERE');

// Admin-only browser push notifications.
// VAPID_PUBLIC_KEY is the URL-safe public key used by browser PushManager.
// VAPID_PRIVATE_KEY must be a PEM encoded prime256v1 EC private key.
// VAPID_SUBJECT should identify the site owner, usually mailto: or https: URL.
define('VAPID_PUBLIC_KEY', 'VAPID_PUBLIC_KEY_HERE');
define('VAPID_PRIVATE_KEY', "-----BEGIN EC PRIVATE KEY-----\nVAPID_PRIVATE_KEY_PEM_HERE\n-----END EC PRIVATE KEY-----");
define('VAPID_SUBJECT', 'mailto:admin@akinalinsaat.com');
