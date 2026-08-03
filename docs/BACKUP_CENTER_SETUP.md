# Yedekleme Merkezi — Setup & Restore Guide (V1)

This document covers everything that must be configured **manually** (FTP + Google) to
activate the Backup Center implemented in this repository. Nothing here is done for you
automatically — the code is deployed, but the daily job is inert until you complete these
steps. **No cPanel username or absolute username-bearing home-directory path is required
anywhere in this setup** — only FTP access and database credentials, which the app already has.

## 1. What was implemented (V1 scope)

- Admin page: `/admin/yedekleme-merkezi` (`src/pages/admin/AdminBackupCenter.tsx`)
- Backend endpoints (`public_html/api/admin/`):
  - `backups.php` — dashboard data (capabilities, Drive diagnostics, history, audit log, Drive listing)
  - `backup-download.php` — streams a fresh full site or database backup directly to the browser
  - `backup-drive-download.php` — proxies a download of one file from a system-created Drive backup
  - `backup-restore-validate.php` — accepts an uploaded package and validates it (no restore performed)
  - `cron/backup-daily.php` — the daily job, **CLI-only**, wired to a cron job you create (see §3)
  - `backup-lib.php` / `backup-pure.php` — shared library used by all of the above
- New DB tables (created automatically on first use): `ak_backup_runs`, `ak_backup_audit_log`
- Private, FTP-managed configuration folder layout (see §2)

**Not implemented in V1, by design:** automatic/live restore of files or database. The page
only validates an uploaded recovery package and reports what it contains. Restoring is a
manual procedure (§7) until a later phase adds a guarded restore wizard.

The daily job checks its prerequisites (ext-zip, ext-openssl, ext-curl, encryption key
configured, private directory writable, rough disk-space estimate) before doing any work and
fails with a specific message naming exactly what's missing, rather than failing deep inside
archiving/upload with a confusing error. `mysqldump` availability is checked separately and is
not fatal — its absence just means the PDO fallback is used (see §6).

## 2. Private folder layout (FTP-only, no cPanel username needed)

The private backup folder is **derived automatically at runtime** as the sibling of
`public_html` — the code resolves it from its own file location
(`public_html/api/admin/backup-lib.php` → two levels up is `public_html` → its sibling is
`akinal-private`), so nothing in `config.php` needs to name an absolute path. You only need to
create the folder structure once, by FTP, at the same level as `public_html`:

```
FTP account root/
  public_html/                          (already exists — deployed by this repo)
  akinal-private/
    akinal-backup/
      google-drive-service-account.json (uploaded by you, step 2 below)
      backup-config.local.php           (created by you from the template, step 3 below)
      logs/
      temp/
      staging/
```

**Exact FTP-only steps:**

1. Using your FTP client, at the **same level** as `public_html` (i.e. its sibling, not
   inside it), create `akinal-private/akinal-backup/`, and inside that create three empty
   subfolders: `logs/`, `temp/`, `staging/`. (The application will also try to create these
   itself on first run if they're missing, but creating them ahead of time via FTP lets you
   control their permissions directly.)
2. Upload your Google service-account JSON key file into `akinal-private/akinal-backup/` —
   see §4 for how to obtain it. Do not rename it unless you also update
   `GOOGLE_DRIVE_CREDENTIALS_PATH` in the next step to match.
3. Copy the tracked template `akinal-private/akinal-backup/backup-config.local.example.php`
   (from this repo) to `akinal-private/akinal-backup/backup-config.local.php` **on the
   server**, in that same folder — never inside `public_html`, never committed to git (it's
   gitignored).
4. Open `backup-config.local.php` and enter your Google Drive folder ID (see §4) for
   `GOOGLE_DRIVE_BACKUP_FOLDER_ID`. Leave `GOOGLE_DRIVE_CREDENTIALS_PATH` as the default
   filename unless you renamed the JSON key in step 2.
5. In Google Drive, confirm the folder is shared with the service account's email address as
   **Editor** (see §4, step 5).
6. Deploy the application code normally (`deploy-akinal.bat` / `scripts/deploy_ftp.py`, as
   always — this never touches `akinal-private/`), then run one controlled backup test: either
   trigger `cron/backup-daily.php` manually once via SSH/cron-now if your host offers it, or
   simply wait for the first scheduled run (§3) and check the Yedekleme Merkezi dashboard
   afterwards for a "Tam Kurtarma Yedeği" or "Kısmi / Geri Yükleme Garantisi Yok" result.

`akinal-private/akinal-backup/backup-config.local.php` (a plain `return [...]` array file, not
a `define()`-style config) holds only:

```php
return [
    'GOOGLE_DRIVE_CREDENTIALS_PATH' => 'google-drive-service-account.json',
    'GOOGLE_DRIVE_BACKUP_FOLDER_ID' => '<your Drive folder ID>',
];
```

Also add to your production `public_html/api/config.php` (unrelated to Drive — this stays
where the rest of the app's config already lives):

```php
define('BACKUP_ENCRYPTION_KEY', '<output of: openssl rand -base64 32>');
define('BACKUP_ALERT_EMAIL', 'you@example.com');
define('BACKUP_SUCCESS_NOTIFICATION_EMAIL', 'bedizoymak@eclipsemuhendislik.com');
define('BACKUP_RETENTION_COUNT', 30);
```

(A `BACKUP_ENCRYPTION_KEY` entry in `backup-config.local.php`, §2, also works as a fallback if
this `define()` is missing — but set it in exactly one of the two places, not both with
different values, since only one is actually read.)

Keep an offline copy of `BACKUP_ENCRYPTION_KEY` yourself (password manager, etc.) — if it's
lost, existing Drive backups become undecryptable.

**Privacy guarantee:** the resolved absolute path to `akinal-private/akinal-backup/` is never
included in any UI text, API response, manifest, audit-log entry, or error message anywhere in
this codebase — only filenames (e.g. `public_html.zip.enc`) or fixed, safe status phrases (e.g.
"Kimlik bilgisi dosyası eksik, okunamıyor veya bozuk") are ever surfaced.

## 3. Exact cron job to create manually

Add **one** cron job through your hosting control panel's Cron Jobs feature (or `crontab -e`
over SSH if available). This is the single CLI entry point for the whole daily automation layer
— it reuses all of the existing package-creation/upload/verification/retention logic in
`backup-lib.php` rather than duplicating any of it, acquires an exclusive lock so two overlapping
firings can never run at once, and refuses to execute at all outside a CLI context (a direct
browser/HTTP request to it always gets a 403, both from its own `PHP_SAPI !== 'cli'` check and
from the sibling `.htaccess` denying the whole `cron/` folder).

**Schedule:** once daily at 01:00 Türkiye time — the cron expression to enter:

```
0 1 * * *
```

**Command template** (do not type a username or a literal `/home/...` path — see the two paths
below):

```
<PHP CLI BINARY PATH> <PATH TO backup-daily.php> >> <PATH TO cron LOG FILE> 2>&1
```

Concretely, using `~` (the shell's home-directory shorthand, which cPanel's cron and most POSIX
shells expand automatically for the account running the job — never a literal username):

```
/usr/local/bin/php ~/public_html/api/admin/cron/backup-daily.php >> ~/akinal-private/akinal-backup/logs/cron.log 2>&1
```

**The two paths you must select/copy from your actual deployed installation** (not type from
memory, and never a username-bearing absolute home-directory path you looked up yourself):

1. **The PHP CLI binary path** — cPanel's Cron Jobs screen usually offers a dropdown of
   installed PHP versions (e.g. `/usr/local/bin/php8.2`); pick the one matching this app's
   required PHP 8+ runtime, or ask your host which CLI binary to use.
2. **The script and log paths** — many cPanel Cron Jobs command fields include a small
   folder-browse control. Use it to browse to and select, rather than typing:
   - the script: `public_html/api/admin/cron/backup-daily.php`
   - the log destination: `akinal-private/akinal-backup/logs/cron.log` (create `logs/` first per
     §2 if it doesn't already exist)

   Letting cPanel fill in the path this way produces the correct absolute path for your specific
   account automatically — you never need to know, type, or record your own cPanel username
   anywhere in this process. If your host's UI has no browse control, `~/public_html/...` and
   `~/akinal-private/...` (exactly as shown above) work identically without needing one.

Notes:
- No real credentials or passwords ever belong in the cron command — the script reads DB and
  Drive credentials from `config.php` and `akinal-private/akinal-backup/backup-config.local.php`
  on the server itself (§1, §2).
- The log path is always under `akinal-private/akinal-backup/logs/` — never under `public_html`.
- All package timestamps, manifests, and log lines the job writes are in UTC, independent of the
  server's local timezone setting.
- The Backup Center dashboard only shows the schedule as **confirmed** once a real `daily_auto`
  run has actually been recorded (within the last 48 hours) — creating this cron job is what
  produces that first confirmed run; the dashboard cannot detect the cron job's existence any
  other way.

I have not created this cron job — you need to add it yourself.

## 4. Google Drive owner setup (manual, by you)

1. In Google Cloud Console, create/select a project and enable the **Google Drive API**.
2. Create a **Service Account** (no domain-wide delegation needed), e.g.
   `akinal-backup@<project>.iam.gserviceaccount.com`.
3. Create a JSON key for it and download it once.
4. In Google Drive, create a dedicated folder, e.g. "Akınal İnşaat — Otomatik Yedekler".
   Prefer a **Shared Drive** if your Workspace plan has one — files owned by a service account
   in a personal My Drive can be orphaned if the service account is ever deleted.
5. Share that folder with the service account's email, **Editor** access — and nothing else in
   Drive is shared to it.
6. Copy the folder's ID from its URL (`https://drive.google.com/drive/folders/<THIS PART>`) —
   this is the value for `GOOGLE_DRIVE_BACKUP_FOLDER_ID` in §2.
7. Upload the JSON key file via FTP into `akinal-private/akinal-backup/` (§2, step 2) — never
   inside `public_html`, never via git.

The Backup Center dashboard shows one of five safe, path-free diagnostic states for the Drive
connection — no path or credential detail is ever shown, only:
- **Drive yapılandırılmadı** — folder ID or credentials path not set yet
- **Kimlik bilgisi dosyası eksik, okunamıyor veya bozuk** — JSON key file missing/unreadable/malformed
- **Yetkilendirme başarısız** — the key was readable but Google rejected the service-account auth
- **Yapılandırılan klasöre erişilemiyor** — authorized, but the folder ID isn't reachable (e.g. not shared with the service account)
- **Bağlantı başarılı** — fully connected and ready

## 5. Package format produced by the daily job

Each run creates one Drive subfolder named `akinal-recovery-<UTC timestamp>` containing:

```
manifest.json          — package version, timestamps, archive names/sizes/checksums, db_dump_method, db_dump_warnings, status
RECOVERY.md             — human-readable restore instructions generated from the manifest (no secrets)
frontend.zip.enc       — a ZIP archive (its own internal compression, NOT additionally gzipped) of public_html EXCEPT
                          api/ — built frontend assets, uploaded media, .htaccess — then AES-256-CBC encrypted.
                          Decrypt → you get a plain .zip, not a .tar.gz.
backend.zip.enc        — a ZIP archive of public_html/api ONLY — the PHP backend/API code, including config.php —
                          then AES-256-CBC encrypted the same way.
database.sql.gz.enc    — a plain-text mysqldump/PDO SQL export, gzip-compressed (gzip helps here — SQL text compresses
                          well, unlike an already-compressed ZIP), then AES-256-CBC encrypted.
checksums.sha256       — sha256 of the three archives above AND of RECOVERY.md
```

Together, `frontend.zip.enc` and `backend.zip.enc` include the full deployed tree required to boot
the site: the built frontend, the PHP backend/API, `uploads/`, `.htaccess`, and `config.php` —
nothing required to run the site is deliberately excluded. Both are built by
`backup_build_split_site_archive()` in `backup-lib.php`, which walks the entire `public_html` tree
once and routes each file into the frontend or backend ZIP by whether it lives under `api/`
(`RecursiveDirectoryIterator`'s `SKIP_DOTS` flag only skips the special `.`/`..` entries, not real
dotfiles like `.htaccess`). Local dev/secret files are excluded from both archives via
`backup_pure_is_excluded_from_archive()`: `config.local.php`, `backup-config.local.php`, `.env`/
`.env.local`, `*.pem`/`*.p12`/`*.key`, service-account-shaped `*.json` filenames, and any
`node_modules`/`dist`/`.cache`/`__pycache__` directory. `config.php` itself IS included (needed for
a genuine disaster-recovery restore). `akinal-private/` itself is never included, since it lives
outside `public_html`.

### Success notification email

After a run's package has been fully verified as uploaded to Google Drive (see §6 below) AND its
database export was fully complete (`manifest.json.status === "complete"`), exactly one
"Akınal İnşaat – Yedekleme Başarılı" email is sent to `BACKUP_SUCCESS_NOTIFICATION_EMAIL` (set in
`config.php`; leave empty to disable), with the completion time in Europe/Istanbul, the package
name, total size, the Drive folder link, and the six package files attached. It is never sent for
failed or partial (`success_with_warnings`) runs — those instead get the existing failure/warning
alert email (`BACKUP_ALERT_EMAIL`). Delivery is exactly-once per run: `ak_backup_runs.success_email_sent_at`
is claimed atomically before `mail()` is ever called, so retries, dashboard refreshes, or repeated
status reads can never trigger a second send for the same package. If the combined attachment size
would be too large for `mail()` (see `BACKUP_SUCCESS_EMAIL_MAX_ATTACHMENT_BYTES`), or `mail()`
itself fails, the notification is skipped/logged only — the already-successful Drive backup is
never affected.

**`manifest.json.status`** is `"complete"` only when every requested schema object (tables,
triggers, stored routines, events) was actually exported — which mysqldump always guarantees when
it succeeds. If mysqldump wasn't usable and the PDO fallback ran, tables/data are always exported,
but triggers/routines/events depend on the DB user's privileges; if any of those failed, `status`
is `"partial"` and `db_dump_warnings` lists exactly what was skipped and why. The dashboard badge
reflects this as **"Kısmi / Geri Yükleme Garantisi Yok"** rather than "Tam Kurtarma Yedeği", and a
failure-alert email is sent even though the run technically produced and uploaded a package — a
partial export must never be mistaken for a full backup.

Retention: only folders named with the exact `akinal-recovery-` prefix, AND whose own
`manifest.json` reports `status: "complete"`, are ever counted toward `BACKUP_RETENTION_COUNT`
or considered for deletion. A `partial` run's package is still uploaded (kept for diagnosis) but
never counted and never auto-deleted, and retention cleanup does not run at all for the current
run when that run's own database export was partial — so a degraded run can never push out an
older, genuinely complete backup. The oldest complete package is removed only after the new
run's upload has passed strict verification: exact expected filenames present exactly once, each
archive's Drive-reported size (and MD5, when Drive supplies one) matches the local file, and the
uploaded manifest.json/checksums.sha256 content matches this run's own computed values. No other
Drive content is ever touched.

**Streaming/memory note:** both encryption (`backup_encrypt_file()`) and the Drive upload
(`gdrive_upload_file()`, using Google's resumable upload protocol) process files in chunks/via
cURL's own file streaming rather than loading a whole archive into a PHP string — this keeps
memory usage roughly constant regardless of site/media size, within normal shared-cPanel PHP
memory limits.

## 6. Critical cPanel limitation: what "Tam Kurtarma Yedeği" requires from hosting

**As of this writing, the live hosting account reportedly has `exec()` disabled.** The
application code never fakes around this: when `exec()`/`mysqldump` are unavailable, the daily
job and manual DB download both fall back to a pure-PHP PDO dumper, and the result is *always*
labeled `Kısmi / Geri Yükleme Garantisi Yok` (partial, no restore guarantee) — never "Tam Kurtarma
Yedeği" — because triggers/stored routines/events cannot be reliably exported that way (see
`backup_pdo_dump_database()` in `backup-lib.php`). The Backup Center dashboard shows a red banner
stating this plainly whenever `mysqldump` isn't available, and the manual DB-download button
relabels itself and prefixes the downloaded filename with `KISMI` in the same situation.

**This can only be fixed by hosting-side changes.** The following must be enabled/confirmed by
your hosting provider — application code cannot substitute for these, and none of them require
disclosing a cPanel username to configure on the application side:

1. **Cron Jobs** — needed to run the daily job at all (independent of the exec() issue).
2. **PHP CLI with `exec()`/`shell_exec()` permitted** (or SSH access as an alternative) — cron
   itself typically runs outside the web SAPI's `exec()` restriction, but this must be confirmed
   for this account specifically.
3. **`mysqldump`** available on PATH for the PHP CLI user — the only way to get a genuine full
   export (schema + data + triggers + stored routines + events) in one guaranteed-consistent pass.
4. **`gzip`** (or PHP's `zlib`/`gzopen()`, already used by this code and not itself blocked) —
   used to compress the SQL dump; not usually a separate blocker if PHP's zlib extension is
   enabled, which is already assumed elsewhere in this app.
5. **Archive capability** — PHP `ext-zip` (`ZipArchive`), used for the site archive; a PHP
   extension, not a shell tool, so this is normally within the hosting account's control via
   `php.ini`/MultiPHP extension settings, not a support-ticket item.
6. **A private, FTP-writable directory outside `public_html`** — already satisfied by the
   `akinal-private/akinal-backup/` folder created in §2; just confirm with your host that
   sibling-of-`public_html` directories are writable by your own FTP/cron account and are not
   served over HTTP (they normally are not, since only `public_html` is the web root).

### Exact support-ticket wording to send your hosting provider

> Subject: Enable PHP exec() and mysqldump for scheduled backups
>
> Hello, we need to run automated database backups via a Cron Job executing a PHP CLI script on
> our hosting account. Could you please confirm/enable the following:
> 1. `exec()` and `shell_exec()` are permitted for PHP CLI processes invoked via Cron Jobs (even
>    if they remain disabled for web-triggered PHP requests, which is fine and expected).
> 2. The `mysqldump` binary is installed and available on the PATH for our account's cron jobs.
> 3. Please confirm the PHP CLI binary path we should use in our cron command (e.g.
>    `/usr/local/bin/php` or a version-specific path such as `/usr/local/bin/php8.2`).
> 4. Please confirm that a directory at the same level as (sibling to) our `public_html` folder
>    is writable by our own cron/FTP account and is not served over HTTP.
>
> Thank you.

### Exact recommended `mysqldump` command (used automatically once available — nothing to configure)

This is exactly what `backup_try_mysqldump()` in `backup-lib.php` runs once `mysqldump` is
present; shown here for reference/manual verification, with placeholders instead of real
credentials:

```
mysqldump --single-transaction --routines --triggers --events \
  --default-character-set=utf8mb4 \
  --host=<DB_HOST> --user=<DB_USER> --password=<DB_PASS> \
  <DB_NAME> > database.sql
```

- `--single-transaction` — consistent snapshot of InnoDB tables without locking the whole DB.
- `--routines --triggers --events` — the full disaster-recovery requirement: stored
  procedures/functions, triggers, and scheduled events, not just tables.
- `--default-character-set=utf8mb4` — matches this app's schema charset/collation.

Real credentials are never placed in git — the application reads them from `config.php`
(`DB_HOST`/`DB_USER`/`DB_PASS`/`DB_NAME`, already gitignored) at run time; this command is shown
for documentation/manual-verification purposes only.

## 7. Manual restore procedure (V1 — no automatic restore yet)

1. On the Yedekleme Merkezi page, download the 6 files of the package you want to restore
   (`manifest.json`, `checksums.sha256`, `RECOVERY.md`, and the three `.enc` archives — either
   freshly via the per-file Drive download buttons, or from your own offline copies).
2. Upload all 6 files together via "Paket Dosyalarını Yükle ve Doğrula". Confirm the report
   says **Paket geçerli** (manifest present & version-matched, checksums.sha256 present, every
   checksum matches). If anything mismatches, stop — do not proceed with a corrupted package.
3. Check `manifest.json.status`. If it is `"partial"`, read `db_dump_warnings` before proceeding
   — you are restoring a database export that is missing some triggers/routines/events, not a
   full backup; decide whether that's acceptable for this restore before continuing.
4. On the new cPanel account, create the MySQL database and user first (see also `RECOVERY.md`
   inside the package, which repeats this exact flow with no dependency on this repo).
5. Decrypt `frontend.zip.enc` and `backend.zip.enc` locally: each file is
   `IV (16 bytes) || AES-256-CBC ciphertext` using `BACKUP_ENCRYPTION_KEY` (SHA-256-derived) — the
   result is a plain `.zip` file (there is no gzip layer to remove; do not run `tar`/`gunzip` on
   it). Extract `frontend.zip.enc`'s contents into the new account's `public_html`, and
   `backend.zip.enc`'s contents into `public_html/api`.
6. Decrypt `database.sql.gz.enc` the same way, then `gunzip` it, and import the resulting `.sql`
   into the new database. Example with OpenSSL CLI:
   ```
   openssl enc -d -aes-256-cbc -K <hex sha256 of key> -iv <hex of first 16 bytes> -in database.sql.gz.enc -out database.sql.gz
   gunzip database.sql.gz
   ```
   Import into a **throwaway/test database first** when validating a package, not production,
   and verify table counts and spot-check data before considering a production import.
7. Update `public_html/api/config.php` on the new account with the new host's `DB_HOST`/
   `DB_NAME`/`DB_USER`/`DB_PASS` — the archive's copy of `config.php` still has the OLD
   database's credentials.
8. Point DNS at the new server and issue/renew SSL (e.g. AutoSSL/Let's Encrypt) there.
9. Recreate the cron job (§3) and the `akinal-private/akinal-backup/` folder + Drive
   configuration (§2, §4) on the new account — none of that travels with the package.
10. Validate the site, admin login, media, and a sample of financial records before considering
    the migration complete.

A guarded, automatic restore wizard (pre-restore emergency backup, isolated-schema DB
validation, password re-confirmation, typed `GERİ YÜKLE` confirmation) is intentionally left for
a later phase — see the original planning notes in `BACKUP_CENTER_PLAN.md` at the repo root for
that design.

## 8. What I did NOT do

- Did not create any Google Cloud project, service account, or Drive folder.
- Did not create the cron job.
- Did not create the `akinal-private/akinal-backup/` folder on the server, upload a
  service-account key, write `backup-config.local.php`, or set any real secret.
- Did not perform a live restore or a live automated Drive upload (nothing has run yet — the
  first real run only happens after you complete §2–§4 and the cron fires).
