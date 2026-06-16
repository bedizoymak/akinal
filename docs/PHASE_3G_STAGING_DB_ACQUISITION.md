# Phase 3G - Staging Database Acquisition and Verification

Date: 2026-06-14
Scope: identify a safe MySQL database copy for canonical classification.

## Executive Summary

Phase 3G result: **NO-GO for actual Phase 3E rerun**.

No production database connection was made. No SQL was executed. No migration SQL was executed. No write statements were executed.

The recommended staging source is a fresh cPanel/phpMyAdmin export or hosting snapshot of the current MySQL database `akinalin_wp282`, restored into an isolated local/staging MySQL database with a dedicated read-only user. The local repository contains useful historical Supabase export artifacts, but they are not a complete current MySQL staging target for Phase 3E classification.

## Possible Sources

| Source | Found | Evidence | Usefulness |
| --- | --- | --- | --- |
| cPanel backups | Not found locally | Docs mention hosting/cPanel/phpMyAdmin workflows, but no cPanel backup archive is present. | Best recommended source if exported fresh from hosting. |
| SQL exports | Partial | `migration-tools/output/import-production-clean.sql`, `import-public-launch.sql`, `import-demo-data.sql` exist. | Not sufficient for Phase 3E because these are generated import artifacts, not a current full MySQL dump. |
| Local dumps | Not found | No `.sql`, `.dump`, `.gz`, `.zip`, or similar current MySQL dump for `akinalin_wp282` was found. | No approved target. |
| Hosting snapshots | Not found locally | Production readiness docs mention hosting snapshots/backups, but no snapshot artifact is present. | Good source if obtained from hosting panel. |
| Bediz archives | Not found locally | No separate Bediz archive/dump path was discovered. | Potential source only if Bediz provides a dated MySQL dump or snapshot. |
| Supabase export | Found | `full_export.json` and `migration-tools/exports/full_export.json`, exported at `2026-05-30T05:36:51.360809+00:00`. | Useful historical archive; not a current MySQL classifier target. |

## Candidate Verification

### Candidate A - Current Production-Like MySQL Config

- Source: `public_html/api/config.php`
- Database name: `akinalin_wp282`
- Hostname: `localhost`
- Row counts: not queried
- Backup date: not applicable
- Production/staging confidence: 95% production-like
- Risk: high
- Decision: rejected for Phase 3E. It may be production and uses app credentials, not a read-only classifier user.

### Candidate B - Supabase Full Export Archive

- Source: `full_export.json`, `migration-tools/exports/full_export.json`
- Export date: `2026-05-30T05:36:51.360809+00:00`
- Source metadata: `supabase_full_public_export`
- Database name: not a MySQL database
- Production/staging confidence: archive, not live production
- Row-count evidence from conversion reports:
  - `payment_plans`: 400 source rows
  - `payments`: 164 source rows
  - `expenses`: 120 source rows
  - `financial_entries`: 761 source rows
  - `customers`: 21 source rows
  - `employees`: 20 source rows
  - `expense_cards`: 21 source rows
  - `projects`: 23 source rows
- Risk: medium, contains sensitive exported data.
- Decision: not approved for direct Phase 3E. The classifier expects MySQL `ak_` tables, not raw Supabase JSON.

### Candidate C - Generated MySQL Import SQL

- Sources:
  - `migration-tools/output/import-production-clean.sql`
  - `migration-tools/output/import-public-launch.sql`
  - `migration-tools/output/import-demo-data.sql`
- Database name: not bound to a restored database
- Backup date: generated from 2026-05-30 export artifacts
- Production/staging confidence: local generated artifacts
- Risk: high if imported into the wrong target
- Decision: not approved for Phase 3E. These are import scripts and executing them would violate this phase.

### Candidate D - Fresh cPanel/phpMyAdmin MySQL Dump

- Source: not yet acquired
- Expected database name: `akinalin_wp282`
- Backup date: must be recorded at export time
- Production/staging confidence: acceptable only after restored to isolated staging/local DB
- Risk: low after restoration if production is never connected and user is read-only
- Decision: recommended acquisition path.

## Recommended Staging Source

Recommended source: **fresh hosting/cPanel/phpMyAdmin export of `akinalin_wp282`, restored into a separate staging/local MySQL database**.

Required properties:

- Export is taken from hosting backup tools or phpMyAdmin.
- Export file is stored outside Git.
- Restored database name is clearly non-production, for example `akinalin_phase3e_staging`.
- Application production credentials are not reused.
- A dedicated classifier user has `SELECT` only.
- Phase 3B additive schema state is known and recorded.
- Snapshot date, source, and restore timestamp are documented.

## Restoration Procedure

### Option 1 - Local MySQL

1. Install MySQL 8.x or MariaDB compatible with the hosting engine.
2. Create an isolated database:

```sql
CREATE DATABASE akinalin_phase3e_staging CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

3. Restore the dump into only this database using a local admin account.
4. Create a read-only classifier user:

```sql
CREATE USER 'ak_classifier_ro'@'localhost' IDENTIFIED BY '<strong-password>';
GRANT SELECT ON akinalin_phase3e_staging.* TO 'ak_classifier_ro'@'localhost';
FLUSH PRIVILEGES;
```

5. Verify with read-only checks only:

```sql
SELECT DATABASE();
SELECT COUNT(*) FROM ak_payment_plans;
SELECT COUNT(*) FROM ak_payments;
SELECT COUNT(*) FROM ak_expenses;
SELECT COUNT(*) FROM ak_financial_entries;
```

6. Configure Phase 3E:

```powershell
$env:AK_CLASSIFIER_DB_HOST = "127.0.0.1"
$env:AK_CLASSIFIER_DB_NAME = "akinalin_phase3e_staging"
$env:AK_CLASSIFIER_DB_USER = "ak_classifier_ro"
$env:AK_CLASSIFIER_DB_PASS = "<strong-password>"
```

### Option 2 - Docker MySQL

1. Start an isolated container:

```powershell
docker run --name akinal-phase3e-mysql `
  -e MYSQL_ROOT_PASSWORD=<root-password> `
  -e MYSQL_DATABASE=akinalin_phase3e_staging `
  -p 3307:3306 `
  -d mysql:8.4
```

2. Restore the dump into the container using `mysql` from the host or inside the container.
3. Create the read-only classifier user:

```sql
CREATE USER 'ak_classifier_ro'@'%' IDENTIFIED BY '<strong-password>';
GRANT SELECT ON akinalin_phase3e_staging.* TO 'ak_classifier_ro'@'%';
FLUSH PRIVILEGES;
```

4. Configure Phase 3E with:

```powershell
$env:AK_CLASSIFIER_DB_HOST = "127.0.0.1"
$env:AK_CLASSIFIER_DB_NAME = "akinalin_phase3e_staging"
$env:AK_CLASSIFIER_DB_USER = "ak_classifier_ro"
$env:AK_CLASSIFIER_DB_PASS = "<strong-password>"
```

Use port `3307` only if the classifier is extended to accept a port or the local MySQL client maps it through the default connection path. The current classifier DSN accepts host and database only, so simplest setup is local MySQL on the default port or a temporary host alias.

### Option 3 - XAMPP/WAMP MySQL

1. Start MySQL/MariaDB from XAMPP or WAMP.
2. Create database `akinalin_phase3e_staging` in phpMyAdmin.
3. Import the dump into that staging database only.
4. Create a dedicated read-only user in phpMyAdmin with `SELECT` only on `akinalin_phase3e_staging`.
5. Set `AK_CLASSIFIER_DB_*` variables to that staging database.
6. Run only the classifier and read-only reconciliation SQL after confirming the selected database name is not `akinalin_wp282`.

## Verification Checklist

Before Phase 3E rerun:

- [ ] Dump source identified: cPanel backup, phpMyAdmin export, hosting snapshot, or Bediz-provided archive.
- [ ] Dump date/time recorded.
- [ ] Dump file stored outside Git.
- [ ] Restored database name is not `akinalin_wp282`.
- [ ] Row counts captured for `ak_payment_plans`, `ak_payments`, `ak_expenses`, and `ak_financial_entries`.
- [ ] Read-only classifier user created.
- [ ] `SHOW GRANTS` confirms `SELECT` only.
- [ ] `AK_CLASSIFIER_DB_*` points to the staging/restored database.
- [ ] Production config is not used.
- [ ] No migration/import SQL is executed during verification.

## Risk Assessment

Main risks:

- Accidentally connecting the classifier to production `akinalin_wp282`.
- Restoring/importing SQL into production instead of a staging database.
- Using app credentials that can write data.
- Treating old Supabase export artifacts as current MySQL truth.
- Running generated import SQL instead of only restoring a controlled dump.

Controls:

- Use a visibly different database name such as `akinalin_phase3e_staging`.
- Use a dedicated read-only database user.
- Keep dumps and classifier output outside Git.
- Record `SELECT DATABASE()` and row counts before classification.
- Never use `public_html/api/config.php` for Phase 3E.

## GO / NO-GO for Actual Phase 3E Rerun

Decision: **NO-GO**.

Reason:
- No verified MySQL staging/restored-backup database is currently available.
- No safe read-only classifier credentials are currently configured.
- Available local SQL/export artifacts are not an approved current MySQL classification target.

GO criteria:

- Acquire a fresh MySQL dump or hosting snapshot.
- Restore it into a clearly named non-production database.
- Create a `SELECT`-only classifier user.
- Capture row-count verification and backup date.
- Confirm Phase 3B schema state.
- Rerun Phase 3E only after those checks pass.

## Safety Confirmation

- Production connection: not attempted.
- Migration SQL execution: not performed.
- Write SQL execution: not performed.
- Reconciliation SQL execution: not performed.
- Schema changes: none.
- Code changes: none.
- Runtime changes: none.
