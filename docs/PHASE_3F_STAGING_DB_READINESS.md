# Phase 3F - Staging Database Setup and Classification Readiness

Date: 2026-06-14
Scope: database source discovery and read-only readiness verification for rerunning Phase 3E.

## Executive Summary

Phase 3F result: **NO-GO for rerunning Phase 3E**.

The repository contains a production-like MySQL configuration and historical Supabase export/conversion artifacts, but no verified staging or restored-backup MySQL database target is currently available for the Phase 3D classifier.

No database connection was opened. No classifier database run was executed. No reconciliation SQL was executed. No `INSERT`, `UPDATE`, `DELETE`, DDL, migration, schema change, data change, code change, UI change, or runtime behavior change was performed.

Important security note:
- `public_html/api/config.php` contains real-looking live secrets and must be treated as sensitive.
- This report intentionally redacts passwords, API secrets, VAPID keys, and private keys.

## Database Inventory

| Candidate | Source | Hostname | Database | Purpose | Read/write risk | Evidence it is not production | Confidence |
| --- | --- | --- | --- | --- | --- | --- | ---: |
| Production candidate | `public_html/api/config.php` | `localhost` | `akinalin_wp282` | Active PHP/MySQL app config | High. App user may have write privileges; SQL editor flag is enabled in local config. | None. File comments say copy to production server only; DB name matches production docs/runbooks. | 95% production-like |
| Example config | `public_html/api/config.example.php` | `localhost` | `akinalin_wp282` | Placeholder template | Low as-is; credentials are placeholders. | Placeholder username/password and setup-disabled flags. | 95% non-usable template |
| Installer placeholder | `public_html/install-schema.php` | `localhost` | `akinalin_wp282` | One-time schema installer template | High if edited and executed; includes DDL by design. | Placeholder username/password; not a classifier config. | 90% template, not approved target |
| Environment files | `.env`, `.env.local` | Not MySQL classifier config | Not MySQL classifier config | Frontend Turnstile and legacy Supabase secret material | Not applicable for MySQL classifier. Sensitive. | No `AK_CLASSIFIER_DB_*` variables and no MySQL staging identifier. | 90% not Phase 3E target |
| Supabase full export | `full_export.json`, `migration-tools/exports/full_export.json` | File-based export | `supabase_full_public_export` metadata | Historical export/backup input for conversion tooling | No DB write risk as a file; contains sensitive exported data. | Export metadata identifies Supabase export, not live production DB. | 80% backup artifact, not classifier target |
| Generated migration SQL | `migration-tools/output/*.sql` | File-based SQL output | Not a live database | Import/conversion artifact | High if imported; not read-only classification. | Ignored local output; docs say do not commit/use without review. | 75% artifact, not approved target |
| Staging candidate | Not found | Not found | Not found | Required Phase 3E target | Unknown | No staging host/database/user evidence found. | 0% available |
| Backup MySQL candidate | Not found | Not found | Not found | Acceptable Phase 3E target if restored and read-only | Unknown | No restored MySQL backup connection/config found. | 0% available |

## Environment Classification

Production candidate:
- `public_html/api/config.php`
- Host: `localhost`
- Database: `akinalin_wp282`
- User: redacted
- Secrets: present and redacted
- Risk: high
- Classification: do not use for Phase 3E without explicit written production approval. Current Phase 3F rules forbid production connection.

Staging candidate:
- None discovered.
- No `AK_CLASSIFIER_DB_HOST`, `AK_CLASSIFIER_DB_NAME`, or `AK_CLASSIFIER_DB_USER` values are configured.
- No `classifier-config.php` or equivalent staging read-only config was found.

Local candidate:
- `public_html/api/config.example.php` and `public_html/install-schema.php` are templates, not usable read-only database targets.
- The local `config.php` is production-like, not a safe local/staging source.

Backup candidate:
- Supabase export artifacts exist and may be useful for historical reference or conversion.
- No restored MySQL backup database was found.
- Phase 3E classifier expects MySQL tables (`ak_payments`, `ak_expenses`, `ak_payment_plans`, `ak_financial_entries`, etc.), so raw export files alone are not an approved classifier target.

## Production Risk Assessment

`public_html/api/config.php` is the highest-risk item discovered.

Risk indicators:
- Real-looking database username/password are present.
- Database name is `akinalin_wp282`, matching production/import documentation.
- The file comment describes production-server usage.
- `ENABLE_ADMIN_SQL_EDITOR` is enabled in the local config.
- It is not a dedicated read-only classifier account.

Decision:
- Do not run `finance:classify` with `public_html/api/config.php`.
- Do not execute Phase 3A reconciliation SQL against this config.
- Do not use any production-like app credential for classifier or reconciliation work.

## Approved Classification Target

Approved target: **none yet**.

A target can be approved for Phase 3E only when all of the following are true:

1. It is explicitly identified as staging or a restored backup.
2. It is not the live production database.
3. It contains the relevant MySQL `ak_` finance tables.
4. It has Phase 3B schema applied if settlement-table classification is expected.
5. The classifier account has `SELECT` only.
6. The connection is provided through `AK_CLASSIFIER_DB_*` variables or a dedicated classifier config file, not through app production config.
7. The database snapshot date and source are recorded.

Recommended classifier configuration shape:

```php
<?php
return [
    'host' => 'staging-or-backup-host',
    'database' => 'staging_or_backup_database',
    'user' => 'dedicated_readonly_user',
    'password' => 'redacted',
];
```

## Remaining Blockers

- No verified staging database is configured.
- No restored MySQL backup database is configured.
- No dedicated read-only classifier user is available in the current environment.
- No evidence exists that any discovered MySQL candidate is not production.
- Supabase export files are not directly usable by the Phase 3D classifier.
- The production-like local `config.php` contains sensitive secrets and should be removed from version control consideration and protected locally.

## GO / CONDITIONAL GO / NO-GO for Rerunning Phase 3E

Decision: **NO-GO**.

Reason:
- There is no approved staging/backup classification target.
- The only concrete MySQL config found is production-like and unsafe for this phase.

Conditional GO criteria:
- Provide a staging/restored-backup MySQL target.
- Provide a dedicated `SELECT`-only user.
- Confirm the target is not production.
- Set `AK_CLASSIFIER_DB_HOST`, `AK_CLASSIFIER_DB_NAME`, `AK_CLASSIFIER_DB_USER`, and `AK_CLASSIFIER_DB_PASS`, or provide a redacted path to a classifier config file.
- Re-run Phase 3E without using production app credentials.

## Validation

| Command | Result | Notes |
| --- | --- | --- |
| `npm run build` | PASS | Vite production build completed. |
| `npm run test` | PASS | 3 test files passed, 16 tests passed. |
| PHP lint | PASS | `php -l` passed for 51 PHP files. |
| `npm run finance:parity` | PASS | 15 passed, 0 failed. |

PHP note:
- PHP 8.4.22 is installed through WinGet.
- This shell required a temporary PATH prepend for npm scripts to find `php`.

## Safety Confirmation

- Production connection: not attempted.
- Staging connection: not attempted.
- Backup database connection: not attempted.
- Classifier execution against DB: not attempted.
- Phase 3A reconciliation SQL execution: not attempted.
- Data writes: none.
- Schema changes: none.
- Code/runtime changes: none.
