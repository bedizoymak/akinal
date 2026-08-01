<?php
declare(strict_types=1);

/**
 * Example private Backup Center configuration.
 *
 * This file documents the production layout — it is NOT deployed by
 * scripts/deploy_ftp.py (which only pushes public_html/) and must never be
 * uploaded there either. On the real server, this whole akinal-private/
 * folder is created and populated by hand over FTP, at the SAME level as
 * public_html (i.e. a sibling directory, not inside it):
 *
 *   FTP account root/
 *     public_html/
 *     akinal-private/
 *       akinal-backup/
 *         google-drive-service-account.json   <- uploaded by FTP, never in git
 *         backup-config.local.php             <- copy of THIS file, filled in, never in git
 *         logs/
 *         temp/
 *         staging/
 *
 * To use: copy this file to backup-config.local.php in the SAME folder on the
 * server (not in this repo) and fill in real values there. Never commit the
 * real file — it is gitignored (see .gitignore: akinal-private/akinal-backup/backup-config.local.php).
 *
 * This file is loaded with a plain `include` and must `return` an array — it
 * is intentionally not a public_html/api/config.php-style define() file, since
 * it never runs from a web request and lives entirely outside public_html.
 */

return [
    // Filename (relative to this same akinal-backup/ folder) or, if you prefer,
    // an absolute path to the Google service-account JSON key. The default
    // below assumes the key sits right next to this config file, which is the
    // layout the FTP setup steps in docs/BACKUP_CENTER_SETUP.md create.
    'GOOGLE_DRIVE_CREDENTIALS_PATH' => 'google-drive-service-account.json',

    // Dedicated Google Drive folder ID (the part of the folder's URL after
    // /folders/), shared with the service account's email as Editor.
    // See docs/BACKUP_CENTER_SETUP.md for how to create/share the folder.
    'GOOGLE_DRIVE_BACKUP_FOLDER_ID' => '',

    // OPTIONAL fallback only. The primary, documented home for this value is
    // `define('BACKUP_ENCRYPTION_KEY', '...');` in public_html/api/config.php
    // (see config.example.php) — that is where it should normally live. This
    // entry is read ONLY if that constant is not defined there, so setting the
    // key in either file works. Do not set it in both places with different
    // values — whichever one is actually read will silently win.
    // Generate with: openssl rand -base64 32
    'BACKUP_ENCRYPTION_KEY' => '',

    // OPTIONAL fallback only, same pattern as BACKUP_ENCRYPTION_KEY above. The
    // primary, documented home for these three is public_html/api/config.php
    // (see config.example.php); they are read from here only if the matching
    // constant isn't defined there. Do not set a value in both places.
    //
    // RESEND_API_KEY: a Resend (https://resend.com) API key, used server-side
    // only to send the one-time "Yedekleme Başarılı" success notification
    // email after a backup is fully verified. Leave empty to disable sending.
    'RESEND_API_KEY' => '',

    // RESEND_FROM_EMAIL: the sender address. 'onboarding@resend.dev' is
    // Resend's own shared TEST sender (works without domain verification);
    // for production, use an address on a domain verified in your Resend
    // account.
    'RESEND_FROM_EMAIL' => 'onboarding@resend.dev',

    // BACKUP_SUCCESS_NOTIFICATION_EMAIL: where the success notification is
    // sent. Leave empty to disable sending.
    'BACKUP_SUCCESS_NOTIFICATION_EMAIL' => '',

    // BACKUP_CRON_TOKEN: the private bearer token an external scheduler
    // (e.g. GitHub Actions, via .github/workflows/daily-backup.yml) must
    // present as `Authorization: Bearer <token>` to
    // public_html/api/admin/backup-cron.php. This endpoint requires no
    // browser session — this token is its only credential — so treat it
    // exactly like a password: long, random, unique to this purpose, never
    // reused elsewhere, never committed. Leave empty to disable the endpoint
    // entirely (every request gets a generic 401 with no token configured).
    // Generate with: openssl rand -hex 32
    'BACKUP_CRON_TOKEN' => 'generate-a-long-random-secret-and-set-it-only-in-private-config',
];
