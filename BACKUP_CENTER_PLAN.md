# Yedekleme Merkezi — Inspection Report & Implementation Plan

Status: **PLANNING ONLY — NOT APPROVED, NOT IMPLEMENTED**. No production code, cron jobs, credentials, or restores have been created. This document is the deliverable requested before any implementation begins.

---

## 1. Inspection findings

### 1.1 Auth / role model
- Session-based auth (`public_html/api/auth.php`), no JWT. `require_admin()` re-queries `ak_admin_users` on every request and requires `role === 'admin'` (exact string) and `is_active = 1`.
- Passwords: `password_hash`/`password_verify` (bcrypt/argon), in `public_html/api/admin/login.php`. Login has rate limiting.
- There is **no existing "re-enter password" / step-up-auth pattern anywhere** in the codebase. This must be built net-new for the restore wizard.
- `ak_profiles` / `ak_user_roles` are confirmed unused, schema-only Supabase leftovers per CLAUDE.md — not part of the live auth path. They will be excluded from restore by default per your instructions.

### 1.2 Admin routing/UI convention
- Frontend: `NAV_GROUPS` in `src/components/admin/AdminLayout.tsx` (a "Sistem" group already exists containing "Bakım Konsolu" — natural home for "Yedekleme Merkezi"). `PAGE_META` must also be updated for breadcrumbs. Routes registered in `src/App.tsx`, lazy-loaded.
- Backend: one flat PHP file per endpoint in `public_html/api/admin/`, always starting with `require_once helpers.php; require_admin();`, method-switched on `$_SERVER['REQUEST_METHOD']`, responses via `json_success()`/`json_error()`.
- `AdminMaintenanceConsole.tsx` is the closest existing analog: a client-side registry of dangerous one-click actions with confirm dialogs and structured result rendering — a reasonable base pattern for the manual-action buttons (download, restore) in Yedekleme Merkezi, though restore needs a dedicated multi-step wizard, not a single confirm dialog.

### 1.3 DB config
- `public_html/api/db.php` reads `DB_HOST/DB_NAME/DB_USER/DB_PASS` constants from `config.php` (prod) or `config.local.php` (dev), both gitignored, both protected from FTP overwrite by `deploy_ftp.py`. Standard PDO/MySQL, `utf8mb4`.
- Adding backup-specific secrets (encryption key, Google service-account JSON path, alert email) should follow the same `config.php`-constant convention — never hardcoded, never committed.

### 1.4 Hosting environment
- No evidence of `exec`/`shell_exec`/`proc_open`/`popen`/`passthru` in use anywhere in the app — consistent with shared cPanel hosting where these are commonly disabled. **Must assume they are unavailable** unless proven otherwise on the actual account (verifiable cheaply and safely with a `phpinfo()`-free capability probe — see Phase 0 below).
- No cron code exists yet. cPanel Cron Jobs (crontab UI) is the standard mechanism on this class of hosting and very likely available even when shell exec from within PHP requests is restricted, because cron itself is configured outside the PHP request sandbox. This needs to be confirmed with you/hosting panel access, not assumed.
- Deploy is FTP-only (`scripts/deploy_ftp.py`), push-based from a dev machine, no SSH evidenced. `uploads/` is the one writable, deploy-persistent web directory.
- **No non-web-accessible server-side directory is referenced anywhere in the codebase.** This is the single biggest open question (see §2 "Private storage location").

### 1.5 Audit/email/download patterns
- No audit-log table, no outbound email (`mail()`/PHPMailer/SMTP) anywhere in the codebase — only browser push (VAPID) exists. Both an audit trail and an alert-email mechanism must be built from scratch.
- No file-streaming download endpoints exist yet (no `Content-Disposition`, `readfile`, `fpassthru` usage). This is also net-new.

### 1.6 Filesystem
- Only `public_html/` is deployed/web-accessible. Repo root (scripts, docs) is dev-machine-only. No PHP `composer.json` — the backend is dependency-free vanilla PHP 8, so any archive library (`ZipArchive`) or Google API client must be confirmed available/vendored, not assumed via Composer (Composer may or may not be usable on the shared host — needs a Phase-0 check).

### 1.7 package.json
- No `googleapis`, `archiver`, or zip/tar libraries currently present in the frontend build. `mysql2` exists as a **devDependency**, giving Node-side scripts a working MySQL client already — useful precedent if any part of the pipeline runs from a dev machine rather than the server (see architecture options below).

---

## 2. Key open questions that determine the architecture

These need your input or hosting-panel access before Phase 1 can start for real (I can't safely assume any of them):

1. **Where does the daily job actually run?**
   - Option A: cPanel Cron Job invoking a PHP CLI script on the server itself (`php /home/.../backup-runner.php`), writing to a private directory outside `public_html/` (e.g. `/home/<cpanel-user>/akinal-backups/`), then uploading to Google Drive via the service-account REST API over `curl`/PHP streams (no `exec` needed for Drive upload — pure HTTPS calls work with `curl_exec` which the app already uses elsewhere for market-rates/inflation-indices, so that part is proven available).
   - Option B: the job runs on your local machine / a separate always-on machine (like the existing `deploy_ftp.py` model) and pulls the DB via a restricted export endpoint + pulls files via FTP, then encrypts/uploads to Drive locally. This avoids depending on cPanel cron/CLI PHP entirely but means backups only happen when that machine is on/scheduled (e.g., Windows Task Scheduler), which is a materially different reliability story than "daily automated" implies.
   - **Recommendation: Option A**, contingent on confirming (a) cPanel Cron Jobs are available on this account, (b) PHP CLI (`php-cli`) is available (usually yes even when web-triggered `exec` is locked down, since cron runs outside the web SAPI sandbox), and (c) `mysqldump` is on PATH for the cron user, or PDO-based schema+data dump is used as a fallback if `mysqldump`/shell exec are unavailable even from cron.
   - This must be verified against your actual hosting control panel — I do not have hosting access and won't assume it.

2. **Private (non-web-accessible) storage location.** Every path referenced by the current codebase is under `public_html/`. A cPanel account almost always has writable space in the account home directory one level above `public_html/` (e.g. `/home/<user>/akinal-backups/`, `/home/<user>/tmp/`) which is never served by Apache. This needs confirming via cPanel File Manager or FTP-with-a-different-root — I'll need you to confirm the home-directory path (or grant a way to discover it, e.g. a one-time PHP script that prints `dirname(__DIR__, N)` and `sys_get_temp_dir()` safely without exposing secrets) before Phase 1.

3. **mysqldump vs. PDO dump.** If `shell_exec`/`exec` are disabled even in CLI/cron context (some hosts lock this globally), `mysqldump` can't be shelled out to. Fallback: a pure-PHP PDO-based dumper (iterate `SHOW CREATE TABLE`, `SHOW TRIGGERS`, `SHOW EVENTS`, batch-select rows, emit INSERTs) — slower and more code, but has zero external dependency risk. Plan should implement the PDO fallback as the primary path unless `mysqldump` availability is confirmed, since "works everywhere on this hosting tier" is safer than "works if lucky."

4. **ZipArchive/tar and openssl availability in PHP.** `ext-zip` and `ext-openssl` are common on shared hosting but not universal. Needs a Phase-0 capability probe (a locked-down, admin-only diagnostic endpoint that reports `extension_loaded('zip')`, `extension_loaded('openssl')`, `function_exists('exec')`, PHP CLI version, etc. — no secrets, admin-auth-gated, deleted or disabled after Phase 0).

5. **Composer availability.** Needed if we use Google's official `google/apiclient` PHP library for Drive uploads. If Composer isn't usable on the host, the fallback is calling the Google Drive v3 REST API directly with `curl`/streams and a hand-rolled JWT signer for service-account OAuth (more code, zero dependency risk — Google's OAuth2 service-account flow is a well-documented plain-HTTP + RS256 JWT exchange, and `openssl_sign()` can do the RS256 signing without any library).

6. **Alert email delivery.** No SMTP/mail() exists today. Options: PHP's built-in `mail()` (works out-of-the-box on most cPanel accounts via the local MTA, sufficient for a low-volume alert-only use case) vs. an SMTP relay (SendGrid/Mailgun/etc., needs new credentials). **Recommendation: start with PHP `mail()`** since it requires no new third-party account and cPanel shared hosting almost always supports it; revisit only if deliverability proves unreliable.

I'll treat cPanel Cron + PHP CLI + PDO-based DB dump + curl-based Drive REST calls + PHP `mail()` as the working assumption for the plan below, with the PDO dumper and REST-based Drive calls chosen specifically because they have no exotic extension/library dependencies — but Phase 0 must confirm or correct these before real building starts.

---

## 3. Phased implementation plan

### Phase 0 — Capability verification (read-only, no secrets, reversible)
- Add a single admin-only, temporary diagnostic endpoint (or reuse Bakım Konsolu) that reports: PHP CLI availability/version, `extension_loaded('zip'|'openssl'|'curl')`, `function_exists('exec'|'shell_exec'|'proc_open')`, whether `mysqldump` responds via a *safe* `exec` probe if exec is enabled (do not run it destructively — just `--version`), free disk space, and confirms a candidate private directory path you provide is writable.
- You confirm/provide: cPanel Cron Jobs availability, the private (non-web) storage path, whether Composer is usable, and your preference among the architecture options in §2.
- **No backups, no Drive access, no cron jobs created in this phase.**

### Phase 1 — Google Drive setup (manual, by you; instructions below in §5) + local secret storage convention
- You create the dedicated Drive folder + service account per §5 and hand me only the folder ID and confirmation the JSON key is placed at the agreed private path — I never see or commit the key itself.
- Add `config.php` constants (following existing convention): `BACKUP_ENCRYPTION_KEY`, `BACKUP_GDRIVE_FOLDER_ID`, `BACKUP_GDRIVE_SA_KEY_PATH`, `BACKUP_ALERT_EMAIL`, `BACKUP_PRIVATE_DIR`. Extend `config.example.php` with commented placeholders only (no real values, same pattern as existing VAPID/Turnstile keys).

### Phase 2 — Core backup engine (server-side PHP, CLI-invoked, lives outside `public_html/` where possible or in a non-routable subfolder with `.htaccess` deny-all if it must stay under `public_html/`)
- `manifest.json` builder, SHA-256 checksums, `public_html/` + `uploads/` archiver (ZipArchive or PDO+tar fallback per Phase-0 result), PDO-based full DB dumper (schema, data, indexes/FKs, triggers, routines, events — explicitly rejecting any "data-only" shortcut per your instruction), AES-256 encryption via `openssl_encrypt` with a key from `BACKUP_ENCRYPTION_KEY` (never derived from something guessable, generated once via `openssl rand`), Drive upload via REST (resumable upload for large files), retention logic (delete oldest **system-created-and-tagged** backup only after the new one's checksum is verified and Drive upload confirmed — tag backups via a Drive `appProperties` marker or a naming convention plus a local ledger table so we never touch unrelated Drive files).
- New DB table for the backup ledger/audit (e.g. `ak_backup_runs`, `ak_backup_audit_log`) — additive schema only, no touch to existing finance tables.
- Failure-path alert email via `mail()`, only on checksum/encryption/upload/cleanup failure, not on every run.
- Dry-run mode first (build package, verify checksums, **skip** the Drive upload and retention-delete) so we can validate the whole pipeline without touching production Drive storage or the 30-slot retention window.

### Phase 3 — cPanel Cron wiring (only after Phase 2 dry-runs are clean and you approve)
- Exact cron command and frequency proposed for approval: daily, off-peak, e.g. `0 3 * * * /usr/local/bin/php /home/<cpanel-user>/akinal-backups/bin/run-backup.php >> /home/<cpanel-user>/akinal-backups/logs/backup.log 2>&1` (path/PHP binary confirmed in Phase 0, never guessed).
- This phase is explicitly gated: **I will not create the cron job without your explicit go-ahead in this phase, separate from earlier approvals.**

### Phase 4 — "Yedekleme Merkezi" read-only admin page
- New nav entry under the "Sistem" group in `AdminLayout.tsx` + `PAGE_META` entry + lazy route in `App.tsx`.
- New page `src/pages/admin/AdminBackupCenter.tsx` showing: last successful/failed run, timestamp/size/checksum/Drive file ref/status, retained-count/30, list of system Drive backups, audit history table — all read-only against new backend endpoints (`GET /api/admin/backups.php`, `GET /api/admin/backup-audit.php`) that only ever query the ledger table and Drive's `files.list` (scoped to the dedicated folder) — no destructive capability in this phase.

### Phase 5 — Manual download actions
- `GET /api/admin/backup-download.php?type=files|database&token=...` — generates the archive into the private temp dir, streams via `readfile`/chunked output with `Content-Disposition`, then deletes the temp file in a `finally` block. Requires `require_admin()` **plus** a short-lived, single-use signed download token (prevents replay/CSRF via a bare authenticated GET) and an audit-log write. Never publicly reachable — no static file is ever left under `public_html/`.

### Phase 6 — Restore wizard (highest-risk phase; built last, tested most, deployed only with explicit separate approval)
- Multi-step React wizard component, not a form: (1) source selection — upload package or pick a listed Drive backup; (2) package validation report (manifest version, checksum, archive presence/non-emptiness, path-traversal/symlink scan) shown to the admin before any destructive option is even enabled; (3) scope selection (files/database/full) with protected-file list shown explicitly (config.php, .env, Drive key, encryption key, backup scripts/logs always excluded by default, with a separate, distinctly-labeled and separately-confirmed toggle to include them); (4) re-auth step — current password re-entry against `password_verify`, session-bound, short expiry; (5) typed confirmation literal `GERİ YÜKLE`; (6) automatic pre-restore emergency backup, verified before proceeding; (7) execution with per-stage progress and per-stage audit rows; (8) result report.
- DB restore specifically: import into an isolated temporary database/schema first (`akinal_restore_check_<timestamp>` or similar, created via `CREATE DATABASE` if the DB user has privilege — Phase 0 must check this privilege too), validate table counts/structure, and only then offer the live destructive import as a distinct final step. If the DB user lacks `CREATE DATABASE` privilege (common on constrained shared-hosting MySQL users), this must be reported to you as a hosting limitation rather than silently skipped, and the plan falls back to syntax/structural validation of the SQL file (parse `CREATE TABLE` statements, diff against current schema) as the best available pre-check.
- File restore: extract only into the private temp dir, validate, then use the safest available atomic-ish swap (e.g. build the new tree in a sibling temp dir under `public_html/`'s parent, then do a fast directory rename swap if the hosting account permits, falling back to an in-place overwrite with a rollback copy retained if rename-across-the-docroot isn't possible on this host — to be confirmed in Phase 0/6).

---

## 4. Threat model / key failure modes

| Risk | Mitigation |
|---|---|
| Backup archive or DB dump leaked (contains all customer/financial data) | AES-256 encryption before it ever leaves the server; key stored only in `config.php`-equivalent private location, never in Drive, never in git; Drive folder shared only to the dedicated service account, not "anyone with link" |
| Encryption key lost | You (not me) hold an offline copy per §5 instructions; documented explicitly as a manual step, not automated |
| Retention logic deletes a non-system or wrong backup | Deletion strictly scoped to files tagged by this system's naming convention + tracked in the local ledger table; delete only happens after the *new* upload's checksum is verified; never a bulk/wildcard Drive delete |
| Restore wizard used accidentally or by a compromised session | Password re-entry + typed `GERİ YÜKLE` + pre-restore emergency backup + full audit trail; download/restore endpoints separately gated from normal `require_admin()` browsing session assumptions |
| Restore corrupts DB mid-import with no way back | Pre-restore emergency backup created and verified first; DB restore validated in an isolated schema before any destructive import when hosting privileges allow it |
| Restore overwrites `config.php`/secrets, breaking the live site | Protected-file exclusion list enforced by default; only bypassable via a separately confirmed, distinctly labeled recovery mode |
| Path traversal / symlink in an uploaded "recovery package" used to write outside the intended directory | Manifest + archive validated before any extraction; extraction target paths normalized and checked to remain within the private temp dir; symlinks rejected outright |
| Cron job silently stops running (e.g., hosting change, disk full) | Failure-alert email on any pipeline stage failure; the admin page surfaces "last successful backup" prominently so staleness is visible even without an email (e.g., if the cron itself never fires, there's no failure email to send — this is a real gap: consider a weekly "still alive" heartbeat email as a secondary check in a later iteration) |
| Google service-account key compromise | Key scoped to a single dedicated folder only (Drive per-file/folder sharing, not domain-wide delegation); rotate via §5 procedure if ever suspected |
| Download endpoint abused for data exfiltration by a logged-in admin session (insider risk) | Every download is audit-logged with admin identity, timestamp, and type; short-lived signed tokens prevent link-sharing/replay after the fact |

---

## 5. Google Drive owner setup instructions (for you to perform manually)

I will not create Google Cloud/service-account credentials myself. Steps for you:

1. In Google Cloud Console, create (or reuse) a project dedicated to this purpose.
2. Enable the **Google Drive API** for that project.
3. Create a **Service Account** (e.g. `akinal-backup-sa@<project>.iam.gserviceaccount.com`), no domain-wide delegation.
4. Generate a JSON key for that service account and download it once.
5. In your normal Google Drive (or a Shared Drive if your Workspace plan has one — preferred, since service-account-owned files in a personal My Drive can be orphaned if the SA is ever deleted), create a **dedicated folder**, e.g. "Akinal İnşaat — Otomatik Yedekler".
6. Share that folder with the service account's email address, **Editor** access, and nothing else in Drive is shared to it.
7. Store the JSON key file **only** at the private server path agreed in Phase 0 (never in git, never under `public_html/`), and keep an encrypted offline copy yourself (e.g. a password manager) as the disaster-recovery-of-last-resort copy, since if the server is lost, the on-server copy is lost too.
8. Give me only: the folder's Drive ID (from its URL) and confirmation the key file is in place — not the key contents.

---

## 6. Required manual secrets/configuration (none committed)

- `BACKUP_ENCRYPTION_KEY` — generate via `openssl rand -base64 32`, stored only in `config.php`.
- `BACKUP_GDRIVE_SA_KEY_PATH` — path to the service-account JSON, outside `public_html/`.
- `BACKUP_GDRIVE_FOLDER_ID` — the dedicated Drive folder ID.
- `BACKUP_ALERT_EMAIL` — where failure alerts go.
- `BACKUP_PRIVATE_DIR` — confirmed private working directory from Phase 0.

---

## 7. Exact restore procedure (summary — full detail lives in the Phase 6 wizard copy)

1. Admin opens Yedekleme Merkezi → Restore.
2. Selects source (Drive backup or uploaded package) and scope.
3. System validates the package (manifest, checksums, structure, no traversal/symlinks) and shows a report; destructive controls stay disabled until validation passes.
4. Admin re-enters password.
5. Admin types `GERİ YÜKLE`.
6. System creates + verifies a pre-restore emergency backup.
7. For DB: attempt isolated-schema validation import first if privileges allow; report if not possible.
8. Final destructive step requires one more explicit confirmation click, separately labeled per scope (files/DB/full).
9. Execution proceeds with per-stage audit logging; result (success/partial/failure) displayed and logged.

## 8. Rollback plan

- Every restore is preceded by a verified emergency backup, restorable through the exact same pipeline — rollback is "restore the pre-restore emergency package."
- Phase-by-phase feature rollback: since each phase adds isolated new files/tables/routes (no edits to existing finance/auth logic), any phase can be disabled by removing its nav entry/route and leaving the backend files inert, without touching unrelated app behavior.

## 9. Test plan

- Phase 0: capability probe results reviewed with you before anything else proceeds.
- Phase 2: dry-run backups (no Drive upload/delete) validated by manually decrypting/checksumming output locally.
- Phase 2b: one real end-to-end run to a test sub-folder path in Drive (not yet the retention-managed 30-slot flow) to confirm upload + manifest correctness, before enabling retention deletion logic.
- Phase 3: cron enabled only after at least one manual CLI-triggered run succeeds end to end, monitored for the first several scheduled firings before considering it "live."
- Phase 6: restore tested first against a **disposable copy of the app on a separate throwaway DB/host**, never the production database, for both files-only and DB-only scopes, before any production restore is attempted — and even then, only ever exercised in production if a real recovery is needed or with your explicit sign-off for a supervised test.

---

## 10. Exact files I'd create/change (for your review, nothing written yet)

**New (backend):**
`public_html/api/admin/backups.php`, `backup-audit.php`, `backup-download.php`, `backup-restore-validate.php`, `backup-restore-execute.php`, `backup-restore-confirm-password.php`, plus a non-web-routable `bin/run-backup.php` CLI entrypoint and a small internal library (archiver, dumper, encryptor, drive-client, manifest, ledger-repo) — exact location depends on the Phase-0 private-directory answer.

**New (DB, additive only):** `ak_backup_runs`, `ak_backup_audit_log` (migration file under `public_html/migrations/` or `api/admin/migrations/` per existing convention).

**New (frontend):** `src/pages/admin/AdminBackupCenter.tsx`, supporting components for the restore wizard, new `apiClient.ts` functions, new types in `apiTypes.ts`.

**Edited:** `src/components/admin/AdminLayout.tsx` (nav entry), `src/App.tsx` (route), `public_html/api/config.example.php` (documented placeholder constants only).

---

**Waiting for your review/approval before Phase 0 or any later phase begins.**
