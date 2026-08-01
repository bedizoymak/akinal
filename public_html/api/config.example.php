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

// Yedekleme Merkezi (Backup Center). See docs/BACKUP_CENTER_SETUP.md for full setup
// instructions. All values below are placeholders — never commit real ones.
//
// The private backup directory (working files, logs, temp archives, and the
// Google Drive credentials/config below) is NOT configured here. It is derived
// automatically at runtime as the sibling of public_html on the server —
// public_html/../akinal-private/akinal-backup/ — created via FTP, with no
// cPanel username or absolute /home/<user>/ path ever required. Google Drive
// settings (GOOGLE_DRIVE_CREDENTIALS_PATH, GOOGLE_DRIVE_BACKUP_FOLDER_ID) live
// in that folder's own backup-config.local.php — see
// akinal-private/akinal-backup/backup-config.local.example.php in this repo
// for the template, and docs/BACKUP_CENTER_SETUP.md for the exact FTP steps.

// Symmetric key used to encrypt backup archives before upload (AES-256).
// Generate with: openssl rand -base64 32
// Store an offline copy yourself — if this key is lost, existing Drive backups
// cannot be decrypted.
define('BACKUP_ENCRYPTION_KEY', 'BACKUP_ENCRYPTION_KEY_HERE');

// Where failure-only backup alert emails are sent.
define('BACKUP_ALERT_EMAIL', '');

// Where the one-time "Yedekleme Başarılı" success notification is sent after a
// backup package has fully completed AND been verified as uploaded to Google
// Drive (never for failed/partial/unverified runs). Leave empty to disable.
// Example: define('BACKUP_SUCCESS_NOTIFICATION_EMAIL', 'bedizoymak@eclipsemuhendislik.com');
define('BACKUP_SUCCESS_NOTIFICATION_EMAIL', '');

// Resend (https://resend.com) is used server-side only to deliver the success
// notification email above (via its plain REST API — no Composer/SDK
// dependency, no frontend mail logic). Leave RESEND_API_KEY empty to disable
// sending entirely.
//
// SECURITY: always use a key you generated yourself and that has never been
// pasted anywhere outside your own password manager / this private config
// file (never in chat, tickets, commit messages, or any other transcript). If
// a key was ever exposed that way, treat it as compromised and rotate it in
// the Resend dashboard before use — a leaked key is not fixed by simply not
// committing it.
//
// RESEND_FROM_EMAIL: 'onboarding@resend.dev' is Resend's own shared TEST
// sender — it works without domain verification but is for testing only
// (Resend may rate-limit/restrict it, and it is not your brand). For
// production, set this to an address on a domain you have verified in the
// Resend dashboard (e.g. 'yedekleme@akinalinsaat.com').
// Example: define('RESEND_API_KEY', 're_xxx...');
// Example: define('RESEND_FROM_EMAIL', 'yedekleme@akinalinsaat.com'); // production: verified domain
define('RESEND_API_KEY', '');
define('RESEND_FROM_EMAIL', 'onboarding@resend.dev'); // test sender only — replace with a verified-domain address in production

// Maximum number of system-created Drive backups to retain.
define('BACKUP_RETENTION_COUNT', 30);
