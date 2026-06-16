# Phase 3H Connectivity Audit

Date: 2026-06-15
Scope: verify whether the local staging database is usable by the canonical classifier.

## Environment Variables

Requested environment variables:

| Variable | Value |
| --- | --- |
| `PHASE3E_DB_HOST` | not set |
| `PHASE3E_DB_NAME` | not set |
| `PHASE3E_DB_USER` | not set |
| `DB_HOST` | not set |
| `DB_NAME` | not set |
| `DB_USER` | not set |

Additional classifier-relevant variables checked:

| Variable | Value |
| --- | --- |
| `AK_CLASSIFIER_DB_HOST` | not set |
| `AK_CLASSIFIER_DB_NAME` | not set |
| `AK_CLASSIFIER_DB_USER` | not set |
| `AK_CLASSIFIER_DB_PASS` | not set |

Password variables were checked and masked; no password values were present in this shell.

## Database Connectivity

Connectivity status: **not attempted**.

Reason:
- No database host, database name, or database user is configured in the current shell.
- The staging safety rule cannot be evaluated because no candidate database name exists.
- `mysql` CLI is not available on PATH.
- PHP 8.4.22 is available and now loads both `pdo_mysql` and `mysqli`.

Required read-only checks remain pending:

```sql
SELECT DATABASE();
SHOW TABLES;
```

Table count: not available.

## Schema Verification

Schema verification status: **not executed**.

Required table checks remain pending:

| Table | Status | Row count |
| --- | --- | ---: |
| `ak_payment_plans` | not checked | not available |
| `ak_financial_entries` | not checked | not available |
| `ak_payments` | not checked | not available |
| `ak_expenses` | not checked | not available |

Reason:
- No safe staging connection is configured.
- No production-like fallback was used.

## Classifier Readiness

Classifier readiness: **NO-GO**.

The classifier expects either:
- `AK_CLASSIFIER_DB_HOST`
- `AK_CLASSIFIER_DB_NAME`
- `AK_CLASSIFIER_DB_USER`
- `AK_CLASSIFIER_DB_PASS`

or an explicit `--config=...` argument.

Current status:
- `PHASE3E_DB_*` variables are not set.
- `DB_*` variables are not set.
- `AK_CLASSIFIER_DB_*` variables are not set.
- There is no active environment mapping from `PHASE3E_DB_*` to `AK_CLASSIFIER_DB_*`.
- `finance:classify` is still falling back to help/no-database mode.

Exact validation output:

```text
> vite_react_shadcn_ts@0.0.0 finance:classify
> php tools/canonical-cashflow-classifier.php

Canonical cashflow classifier (CLI, read-only)

Usage:
  php tools/canonical-cashflow-classifier.php --help
  php tools/canonical-cashflow-classifier.php --config=C:\path\to\readonly-config.php --pretty
  php tools/canonical-cashflow-classifier.php --no-output --pretty

Config file must return:
  <?php return ['host' => 'localhost', 'database' => '...', 'user' => 'readonly', 'password' => '...'];

Environment alternative:
  AK_CLASSIFIER_DB_HOST
  AK_CLASSIFIER_DB_NAME
  AK_CLASSIFIER_DB_USER
  AK_CLASSIFIER_DB_PASS

Safety:
  - No database connection is attempted when configuration is absent.
  - The session starts a read-only transaction before queries run.
  - The query library accepts SELECT/WITH statements only.
  - JSON exports default to tools/output/, which is ignored by Git.
```

## Blockers

1. No `PHASE3E_DB_*`, `DB_*`, or `AK_CLASSIFIER_DB_*` environment variables are set.
2. The classifier does not read `PHASE3E_DB_*` directly.
3. No staging database name is available to verify the required `staging`, `phase3e`, or `local` naming rule.
4. No evidence exists that any configured target is non-production.
5. `mysql` CLI is not available on PATH; PHP PDO can now be used once safe staging credentials exist.
6. `finance:classify` remains in no-config help mode.

## GO / NO-GO

Decision: **NO-GO**.

The local staging database is not currently usable by the canonical classifier.

Required before GO:

1. Configure a database whose name contains `staging`, `phase3e`, or `local`.
2. Confirm the database name is not `akinalin_wp282`.
3. Create/use a `SELECT`-only database account.
4. Map the approved staging credentials to classifier variables:

```powershell
$env:AK_CLASSIFIER_DB_HOST = $env:PHASE3E_DB_HOST
$env:AK_CLASSIFIER_DB_NAME = $env:PHASE3E_DB_NAME
$env:AK_CLASSIFIER_DB_USER = $env:PHASE3E_DB_USER
$env:AK_CLASSIFIER_DB_PASS = $env:PHASE3E_DB_PASS
```

5. Re-run this audit and confirm read-only `SELECT DATABASE()`, `SHOW TABLES`, and required table row counts.

## Local PHP MySQL Extension Fix

PHP CLI originally had no loaded `php.ini`, although the WinGet installation included both extension DLLs.

Local CLI configuration created at:

`C:\Users\Ebru\AppData\Local\Microsoft\WinGet\Packages\PHP.PHP.8.4_Microsoft.Winget.Source_8wekyb3d8bbwe\php.ini`

Enabled configuration:

```ini
[PHP]
extension_dir = "ext"
extension = mysqli
extension = pdo_mysql
```

Verification output:

```text
mysqli
pdo_mysql
```

Extension status: **PASS**.

Classifier rerun status: still in safe help/no-database mode because no `AK_CLASSIFIER_DB_*` variables are configured.

## Safety Confirmation

- Production connection: not attempted.
- `INSERT`: not executed.
- `UPDATE`: not executed.
- `DELETE`: not executed.
- `ALTER`: not executed.
- Migration execution: not performed.
- Runtime changes: none.
