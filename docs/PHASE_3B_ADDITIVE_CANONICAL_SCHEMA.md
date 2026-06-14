# Phase 3B — Additive Canonical Schema and Constraint Foundation

Implementation date: 14 June 2026

## Executive Summary

- **What was added:** Nullable canonical identity, provenance, ownership, classification, currency, reconciliation, archive, and reversal fields were added to the installer definition for `ak_financial_entries` and `ak_payment_plans`. A versioned migration adds the same fields to existing databases. The new `ak_payment_plan_settlements` table persists plan-to-ledger allocations with history-preserving constraints.
- **What was not changed:** No existing column or legacy table was removed. No finance data was backfilled. No API endpoint, UI component, route, dashboard/report calculation, allocation helper, or runtime write path was changed.
- **Why this is backward compatible:** Existing writes do not need to provide canonical values because all newly added fields on existing tables are nullable. Existing columns and indexes remain available. The settlement table is not read or written by the current application.

This phase creates storage capacity only. It does not make current ledger entries canonical by itself and does not validate or migrate legacy accounting evidence.

## Migration Files

Forward migration:

`public_html/migrations/2026_06_14_001_canonical_cashflow_foundation.sql`

Rollback review script:

`public_html/migrations/2026_06_14_001_canonical_cashflow_foundation_rollback.sql`

Read-only deployment validation:

`docs/sql/phase_3b_schema_validation.sql`

Fresh installations use the updated definitions in:

`public_html/install-schema.php`

## New Canonical Fields

### `ak_financial_entries`

| Field group | Fields | Purpose |
|---|---|---|
| Transaction identity | `business_transaction_id`, `event_type` | Groups accounting legs and classifies the canonical event |
| Source provenance | `source_type`, `source_id`, `source_version` | Connects a future canonical entry to its migration/runtime source |
| Relationships | `payment_plan_id`, `parent_entry_id`, `reversal_entry_id` | Connects plans, adjustments, refunds, and reversals |
| Counterparty | `counterparty_type`, `counterparty_id` | Provides a normalized owner contract beside compatibility owner columns |
| Account/scope | `account_type`, `allocation_scope`, `allocation_note` | Separates Resmi/Gayri Resmi and project/overhead/unallocated scope |
| Dates | `transaction_date`, `due_date` | Separates canonical cash date and forecast due date from legacy `entry_date` |
| Currency | `exchange_rate`, `base_amount` | Stores locked TRY conversion inputs for future canonical reporting |
| Cost classification | `category_code`, `subcategory_code` | Supports controlled reporting categories |
| Document | `document_id` | Reserves a stable canonical document relationship |
| Migration/reconciliation | `migration_confidence`, `reconciliation_status` | Records classification and review state |
| Lifecycle/audit | `archived_at`, `archived_by`, `canceled_at`, `canceled_by`, `cancellation_reason` | Supports non-destructive lifecycle handling |

All fields are nullable in Phase 3B. Required-value enforcement belongs after classification and canonical write paths exist.

### `ak_payment_plans`

| Field group | Fields | Purpose |
|---|---|---|
| Transaction identity | `business_transaction_id` | Gives the obligation a stable business identity |
| Counterparty | `counterparty_type`, `counterparty_id` | Normalizes customer/personnel/expense-card ownership |
| Accounting classification | `direction`, `currency` | Identifies receivable/payable direction and transaction currency |
| Project scope | `allocation_scope`, `allocation_note` | Distinguishes project obligation, company overhead, and unresolved allocation |
| Cost classification | `category_code`, `subcategory_code` | Supports payable and project-cost classification |
| Migration/reconciliation | `migration_confidence`, `reconciliation_status` | Records evidence quality and review state |
| Lifecycle/audit | `archived_at`, `archived_by`, `canceled_at`, `canceled_by`, `cancellation_reason` | Replaces future destructive lifecycle handling |

The legacy `paid_amount`, `status`, owner IDs, account type, maturity fields, and calculation behavior remain unchanged.

## Settlement Table

`ak_payment_plan_settlements` represents a persisted allocation from one canonical ledger entry to one payment plan.

Required business fields:

- `payment_plan_id`
- `financial_entry_id`
- positive `allocated_amount`
- `currency`
- `account_type`

Audit/reversal fields:

- `created_by`, `created_at`
- `reversed_at`, `reversed_by`, `reversal_reason`

Finance history uses `ON DELETE RESTRICT` and `ON UPDATE RESTRICT`. A referenced plan, ledger entry, or administrator cannot be silently removed while a settlement row depends on it.

The generated `active_pair_guard` is an implementation field. It is `1` for active settlements and `NULL` after reversal. The unique key on plan, entry, and guard prevents duplicate active allocation for the same pair while preserving multiple historical reversed rows.

`allocated_amount > 0` is expressed as a database check constraint. Deployment validation must confirm the target MySQL/MariaDB version enforces check constraints; the future canonical service must validate the same rule independently.

## Index and Constraint Strategy

Financial-entry indexes support:

- source reconciliation by `source_type, source_id`
- business transaction grouping
- event-type filtering
- plan linkage
- normalized counterparty filtering
- project and transaction-date reporting
- canonical account filtering
- reconciliation queues

Payment-plan indexes support:

- normalized counterparty filtering
- business transaction grouping
- reconciliation queues

Settlement indexes support:

- plan and ledger traversal
- currency and account review
- duplicate active-pair prevention

Phase 3B intentionally does not make source identity unique. Existing data has not been classified, and a premature unique constraint could block deployment or encode a false reconciliation decision. A later phase may add uniqueness after migration evidence is approved.

Canonical fields do not yet have strict enum checks or non-null constraints. Tightening them before legacy classification would violate backward compatibility.

## Backward Compatibility

- Existing `INSERT` and `UPDATE` statements continue to use their current columns.
- Nullable canonical columns do not introduce required runtime inputs.
- Existing `entry_date`, `currency_tag`, `group_tag`, owner IDs, plan status, and manual paid fields remain intact.
- Legacy `ak_payments` and `ak_expenses` remain unchanged.
- No current query reads `ak_payment_plan_settlements`.
- Dashboard, Finance, Reports, cards, statements, reminders, and customer FIFO logic continue using existing paths.
- Installer changes affect fresh database shape only; the disabled setup tool and its credential placeholders remain unchanged.

Fresh installations include the foundation but still run the current application behavior until later phases explicitly switch write/read paths.

## Deployment Order

1. Record the exact application commit and database engine/version.
2. Create and verify a restorable database backup.
3. Run the Phase 3A inventory on a staging clone or recent backup.
4. Resolve or formally classify Phase 3A blockers before migration approval.
5. Apply the forward migration on staging using a database account with temporary DDL permission.
   The migration uses temporary stored procedures for cross-version idempotency, so the deployment account also needs temporary `CREATE ROUTINE`/`ALTER ROUTINE` permission.
6. Run `docs/sql/phase_3b_schema_validation.sql`.
7. Confirm expected columns, indexes, `RESTRICT` foreign keys, positive-amount check, generated active-pair guard, and an empty settlement table.
8. Run application build/tests/PHP lint and authenticated staging smoke tests.
9. Verify existing finance CRUD, dashboard, reports, statements, and reminders return unchanged results.
10. Apply to production only after written approval and a new backup.
11. Remove DDL permission from the normal application database account after deployment.

No production database was accessed during this implementation.

## Rollback Strategy

The rollback is intended only before canonical writes begin.

- It first checks whether `ak_payment_plan_settlements` exists and contains rows.
- If any settlement row exists, rollback stops with `SQLSTATE 45000`.
- It removes the empty settlement table, Phase 3B indexes, and Phase 3B columns.
- It does not remove or modify legacy finance tables/columns.
- It does not delete settlement data silently.
- It uses `information_schema` checks so missing Phase 3B indexes/columns do not cause repeated rollback failures.

Before rollback:

1. Stop application writes.
2. Take a new backup.
3. Confirm no canonical code has written values to the added columns.
4. Run the schema validation helper and settlement row-count check.
5. Execute rollback on staging first.

If canonical fields contain data or downstream code depends on them, do not run the automatic rollback. Use a separately reviewed data-preservation plan.

## Validation Results

- `npm run build`: passed. Vite 5.4.21 transformed 2,637 modules and completed the production build in 10.48 seconds.
- `npm run test`: passed. Vitest 3.2.6 reported 2 test files passed and 6 tests passed.
- `php -l` for all `public_html` PHP files: passed. All 48 PHP files completed syntax validation successfully.
- Forward/rollback SQL safety review: passed. The forward migration contains no data-changing DML statements, the rollback drops no legacy finance table, and rollback refuses to continue when settlement rows exist.
- Installer/migration parity: passed for all 27 required financial-entry fields and all 16 required payment-plan fields.
- Read-only schema-validation SQL review: passed. All five statements begin with `SELECT` and contain no data/schema-changing operations.
- `git diff --check`: passed; Git emitted only the existing Windows line-ending normalization warning for `public_html/install-schema.php`.
- Migration execution against staging/MySQL: Manual verification required.

## Recommended Phase 3C

Proceed with **Phase 3C — Canonical Domain Service, Validation, and Contract Tests** after the migration is successfully applied and verified on staging.

Phase 3C should:

1. Define server-side enums and validation for event type, direction, status, account, currency, allocation scope, counterparty, and reconciliation state.
2. Add transactional settlement creation/reversal services with over-allocation, cross-account, currency, counterparty, and project checks.
3. Preserve current runtime reads and calculations behind a feature flag.
4. Add unit and disposable-MySQL integration tests for immutability, idempotency, settlement caps, reversal, and rollback behavior.
5. Avoid migrating data or switching reports until Phase 3D dry-run classification is approved.
