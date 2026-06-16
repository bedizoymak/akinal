# Phase 3E - Staging Classification Run and Migration Decision Register

Date: 2026-06-14
Scope: read-only staging/backup classification readiness check.

## Executive Summary

Phase 3E is **NO-GO**.

The local code and classifier safety gates are ready, but the requested staging classification could not be executed because no verified staging or database-backup classifier configuration is available on this machine.

No production database was accessed. No staging database was accessed. No `INSERT`, `UPDATE`, `DELETE`, DDL, migration, schema change, data change, UI change, or runtime behavior change was performed.

## Classification Results

`npm run finance:classify` was executed.

Result: blocked in safe no-database mode.

Observed behavior:
- The classifier printed usage/help text.
- No database connection was attempted.
- No JSON classification export was produced.
- No sensitive row data was read.

Reason:
- `AK_CLASSIFIER_DB_HOST`, `AK_CLASSIFIER_DB_NAME`, and `AK_CLASSIFIER_DB_USER` are not set.
- No explicit `--config=...` file for a staging/backup read-only database was found or provided.
- The local `public_html/api/config.php` was intentionally not used because it is not proven to target staging or a backup.

Classification statistics:

| Metric | Result |
| --- | ---: |
| Exact matches | Not available - staging classifier did not run |
| Probable matches | Not available - staging classifier did not run |
| Ambiguous matches | Not available - staging classifier did not run |
| No matches | Not available - staging classifier did not run |
| Manual review items | Not available - staging classifier did not run |

## Reconciliation Results

The Phase 3A reconciliation query library exists at:

- `docs/sql/phase_3a_reconciliation_inventory.sql`

Execution status: blocked.

Reason:
- No verified staging/backup database connection is available.
- Running these queries against local production-like PHP config would violate the Phase 3E rule: staging or database backup only.

Phase 3A query sets pending execution:

- A01-A05: core row counts, ownership/status/group/currency/project linkage.
- B01-B05: probable duplicate payment, expense, and planned obligation matches.
- C01-C07: project linkage anomalies.
- D01-D03: owner linkage and orphan reference anomalies.
- E01-E03: official/unofficial account consistency.
- F01-F03: currency anomalies.
- G01-G04: manual paid amount and settlement-evidence risks.
- H01-H03: cheque/senet maturity risks.
- I01-I05: realized inventory and overhead candidates.
- J01-J05: detached history and archive-protection inventory.

## Migration Blockers

Current blockers:

1. No verified staging/backup database connection is available for the classifier.
2. No dedicated read-only staging/backup database user is configured in `AK_CLASSIFIER_DB_*` or a classifier config file.
3. Phase 3A reconciliation queries have not been executed against staging/backup data.
4. Classification statistics and anomaly totals are unavailable.
5. Migration decision register cannot be data-backed until the above are resolved.

## Manual Review Queue

Manual review queue could not be generated from data.

Expected queue categories once staging classification runs:

- Ambiguous legacy payments with multiple probable ledger matches.
- Legacy payments with no ledger match.
- Legacy expenses with category uncertainty or no ledger match.
- Payment plans with manual paid state but no realized evidence.
- Plans without exactly one owner.
- Ledger entries missing event type, project scope, or valid counterparty.
- Cheque/senet rows with missing maturity or paid-before-maturity conflict.
- Entries with unsupported currency or mixed-currency owner/project risk.

## Data Cleanup Requirements

Data cleanup requirements cannot be finalized without staging output.

Expected cleanup decision areas:

- Resolve unlinked project scope on payment plans, payments, expenses, and ledger entries.
- Resolve missing or multiple owner assignments.
- Confirm official/unofficial account mapping between payments, plans, and ledger entries.
- Confirm currency policy for non-TRY ledger rows and mixed-currency owners/projects.
- Resolve duplicate risks before creating canonical source links.
- Replace manual paid assumptions with explicit settlement evidence where possible.
- Review cheque/senet maturity evidence before canonical cash-realization decisions.
- Define approved handling for company-overhead records.

## Anomaly Inventory

The anomaly inventory is pending database execution.

| Category | Status |
| --- | --- |
| Project linkage issues | Pending staging/backup query run |
| Owner linkage issues | Pending staging/backup query run |
| Currency issues | Pending staging/backup query run |
| Official/unofficial violations | Pending staging/backup query run |
| Duplicate risks | Pending staging/backup query run |
| Manual paid risks | Pending staging/backup query run |
| Cheque/senet maturity issues | Pending staging/backup query run |

## Canonical Migration Readiness

Readiness: **not ready**.

The code-level foundation validates, but the migration cannot be approved without a real staging/backup classification run and exported Phase 3A reconciliation results.

Readiness gates still required:

1. Provide a verified staging or restored-backup database.
2. Provide a dedicated read-only classifier user.
3. Run `npm run finance:classify` with explicit staging/backup config.
4. Execute every Phase 3A query set A01-J05 against the same staging/backup snapshot.
5. Record classification totals, anomaly counts, and manual review records.
6. Approve migration policies for ambiguous, no-match, manual-paid, currency, project, owner, and cheque/senet cases.

## GO / CONDITIONAL GO / NO-GO

Decision: **NO-GO**.

Reason:
- Validation passed locally, but no staging/backup data classification occurred.
- The migration decision register cannot be data-backed yet.

This is a process/data availability NO-GO, not a code-validation failure.

## Recommended Phase 4

Do not start Phase 4 migration work yet.

Recommended next step:

Prepare a staging database or restored backup with a dedicated read-only account, then rerun Phase 3E using:

```powershell
$env:AK_CLASSIFIER_DB_HOST = "<staging-or-backup-host>"
$env:AK_CLASSIFIER_DB_NAME = "<staging-or-backup-database>"
$env:AK_CLASSIFIER_DB_USER = "<readonly-user>"
$env:AK_CLASSIFIER_DB_PASS = "<readonly-password>"
npm run finance:classify -- --pretty
```

Then run all Phase 3A query sets A01-J05 against the same snapshot and update this register with actual counts, blockers, manual review rows, and the migration decision.

## Validation

| Command | Result | Notes |
| --- | --- | --- |
| `npm run build` | PASS | Vite production build completed. |
| `npm run test` | PASS | 3 test files passed, 16 tests passed. |
| `npm run finance:parity` | PASS | 15 passed, 0 failed. |
| `npm run finance:classify` | SAFE BLOCKED | No DB config; help text printed; no connection attempted. |
| PHP lint | PASS | `php -l` passed for 51 PHP files. |

PHP note:
- PHP 8.4.22 is installed through WinGet.
- This shell required a temporary PATH prepend to run npm finance scripts with `php`.

## Execution Safety Confirmation

- Production execution: no.
- Staging/backup execution: no, because no verified config is available.
- Database writes: none.
- Schema changes: none.
- Migration execution: none.
- Runtime behavior changes: none.
