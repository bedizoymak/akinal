# Phase 3D — Read-Only Migration Classification and PHP Parity Harness

Implementation date: 14 June 2026

## Executive Summary

- **What was added:** A CLI-only read-only finance classifier, a labeled SQL query library, a credential-free PHP parity harness, safe npm commands, and ignore rules for sensitive generated exports.
- **What was not changed:** No UI, HTTP endpoint, runtime API, finance calculation, schema, migration data, production credential, or existing database row was changed.
- **Why this is safe:** The classifier refuses web execution, does nothing without explicit classifier-only configuration, starts a read-only database transaction, accepts only `SELECT`/`WITH` query-library statements, and rolls the transaction back after reading. The parity harness uses fixtures and never connects to a database.

No real database classification was executed in this repository phase. Production/staging results remain **Manual verification required**.

## CLI Classifier

Classifier:

`tools/canonical-cashflow-classifier.php`

Query library:

`tools/sql/canonical_cashflow_classifier_queries.sql`

### How it runs

Safe help/no-configuration mode:

```powershell
npm run finance:classify -- --help
```

Read-only configuration file:

```php
<?php
return [
    'host' => 'localhost',
    'database' => 'staging_database',
    'user' => 'dedicated_readonly_user',
    'password' => 'local-secret',
];
```

Execution:

```powershell
php tools/canonical-cashflow-classifier.php --config=C:\secure\classifier-config.php --pretty
```

Environment variables may be used instead:

- `AK_CLASSIFIER_DB_HOST`
- `AK_CLASSIFIER_DB_NAME`
- `AK_CLASSIFIER_DB_USER`
- `AK_CLASSIFIER_DB_PASS`

The tool does not load `public_html/api/config.php` automatically. Production credentials are never required or inferred.

### What it reads

- `ak_payments`
- `ak_expenses`
- `ak_payment_plans`
- `ak_financial_entries`
- `ak_payment_plan_settlements`
- customer, employee, expense-card, and project master IDs

If the additive Phase 3B settlement table does not exist, the classifier records an empty settlement source and continues. Any other SQL/schema failure stops execution.

### What it outputs

JSON contains:

- source row counts
- classification counts
- amount totals separated by source/type/currency
- legacy payment classifications
- legacy expense classifications
- payment-plan evidence/anomaly classifications
- ledger classifications
- blocker and manual-review counts
- readiness: `ready`, `conditional`, or `blocked`

By default, a timestamped sensitive report is written under `tools/output/`. `--no-output` prints JSON only.

### Why it is read-only

- Web execution is refused.
- Query statements are loaded from a source-controlled library.
- Only statements beginning with `SELECT` or `WITH` are accepted.
- Data/schema-changing keywords are rejected.
- The PDO session uses `SET SESSION TRANSACTION READ ONLY`.
- Reads occur inside a transaction that is rolled back.
- The script contains no database write operation.

## Classification Model

### Exact

An exact legacy match requires persisted provenance:

- ledger `source_type = legacy_payment` and `source_id = payment.id`, or
- ledger `source_type = legacy_expense` and `source_id = expense.id`.

Amount/date/title similarity is never exact evidence.

### Probable

A single candidate matches conservative identity attributes such as owner, amount, direction, realized state, TRY currency assumption, and nearby date. Expense candidates also require normalized title equality.

Probable matches require manual approval.

### Ambiguous

More than one possible ledger candidate exists, or multiple provenance rows claim the same source. Ambiguous matches are migration blockers.

### No match

No persisted source link or probable candidate exists. A later migration decision may create a canonical entry, exclude the source, or request more evidence.

### Blocker

Examples:

- ambiguous duplicate
- project/account conflict
- missing or multiple plan owner
- paid plan without defensible evidence
- invalid ledger direction/status/group/currency
- cheque/senet maturity contradiction

### Manual review

Manual review covers probable/no-match legacy rows, manual paid states, missing project attribution, category uncertainty, and duplicate candidates.

## Legacy Payment Classification

Each payment reports:

- exact/probable/ambiguous/no-match class
- candidate ledger IDs
- project mismatch
- Resmi/Gayri Resmi mismatch
- implicit TRY assumption
- manual-review and blocker flags

The candidate rule checks customer, realized income direction/status, amount, TRY, and a one-day date tolerance. Project/account differences are reported separately rather than hidden by the candidate class.

## Legacy Expense Classification

Each expense reports:

- exact/probable/ambiguous/no-match class
- candidate ledger IDs
- project mismatch
- assumed `resmi` and TRY
- category uncertainty
- manual-review and blocker flags

Every legacy expense remains manual-review because the source lacks authoritative account type and currency.

## Payment Plan Classification

The plan classifier identifies:

- active receivable/payable plans
- manual paid states
- paid plans without realized evidence
- overdue remaining amount after partial evidence
- cheque/senet maturity problems
- missing project
- missing or multiple owner
- persisted settlements
- explicitly linked legacy payments
- probable realized ledger evidence

Manual `paid_amount` is not treated as canonical settlement evidence.

## Ledger Classification

Ledger rows report:

- missing `event_type`
- unsupported direction/status/group/currency
- missing counterparty
- missing project scope
- likely forecast versus likely posted state
- likely duplicate relationship to legacy rows
- manual-review and blocker flags

This is a classifier, not a migration writer. It never fills canonical columns.

## PHP Parity Harness

Harness:

`tools/canonical-finance-parity-harness.php`

Run:

```powershell
npm run finance:parity
```

The harness imports the isolated PHP canonical service and executes 15 fixture checks matching the TypeScript contract matrix:

- valid customer receipt
- unsupported currency
- invalid account type/counterparty
- project and company-overhead scope
- cheque/senet maturity policy
- settlement account/currency separation
- over-allocation
- partial/full/overdue status derivation
- posted-entry immutability
- reversal requirements
- official/unofficial isolation

It exits non-zero on failure and requires no credentials or database.

## Generated Export Policy

The following are ignored:

- `tools/output/`
- `docs/exports/`
- `*.classification.json`

Generated reports may contain names, identifiers, descriptions, project relationships, and financial values. They must remain outside Git and should be stored only in access-controlled operational storage. Source scripts and SQL remain tracked.

## How To Run Safely

1. Use a recent staging clone or backup, not production first.
2. Create a dedicated database user with `SELECT` only.
3. Keep the config file outside the repository.
4. Run `npm run finance:parity`.
5. Run classifier help mode and review options.
6. Execute with `--no-output` first if terminal retention is controlled.
7. If exporting, verify the target is ignored and access-controlled.
8. Review blocker totals before detailed personal/financial rows.
9. Do not modify data while reviewing classifications.
10. Record engine version, database snapshot date, commit, command, and report checksum.

## Validation Results

- PHP parity harness: passed, 15/15 fixture tests.
- Classifier help/no-database mode: passed without loading credentials or connecting.
- Tool PHP syntax: passed for both new CLI files.
- Classifier SQL safety: passed, 9/9 statements are read-only with zero forbidden operations.
- Classifier source safety: passed with zero database write calls detected.
- `npm run build`: passed. Vite 5.4.21 transformed 2,637 modules and completed the production build in 11.96 seconds.
- `npm run test`: passed. Vitest reported 3 test files and 16 tests passed.
- Full `public_html` PHP lint: passed for all 49 files.
- `git diff --check`: passed; Git emitted only Windows line-ending normalization warnings.
- Real staging classification: Manual verification required.

## Recommended Phase 3E

Proceed with **Phase 3E — Staging Classification Run and Migration Decision Register**.

Phase 3E should:

1. Apply and validate Phase 3B on a staging clone.
2. Run the classifier with a dedicated read-only database user.
3. Store the sensitive JSON outside Git and record its checksum.
4. Produce a redacted aggregate decision register for exact, probable, ambiguous, no-match, and blocker groups.
5. Resolve every ambiguous duplicate, manual paid state, project/account conflict, and maturity anomaly.
6. Approve migration treatment per record group before any write-capable migration runner is implemented.
