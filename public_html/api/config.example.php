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

define('TURNSTILE_SECRET_KEY', 'TURNSTILE_SECRET_KEY_HERE');

// Dangerous launch/setup tools are disabled by default in committed files.
// Set these to true only in a temporary, trusted setup copy when absolutely needed.
define('ENABLE_ADMIN_SQL_EDITOR', false);
define('ENABLE_DEMO_IMPORT', false);

// Phase 4C foundation only. Keep disabled until an approved cutover phase.
define('CANONICAL_SETTLEMENT_ENABLED', false);

// Phase 5B read cutover flags. Keep canonical reads disabled until explicit approval.
define('CANONICAL_READ_MODEL_ENABLED', false);
define('CANONICAL_READ_MODEL_SHADOW_COMPARE', true);
define('CANONICAL_READ_MODEL_FAIL_CLOSED', true);
define('CANONICAL_READ_MODEL_LOG_MISMATCHES', true);
