# Phase 4A - Canonical Settlement Write Path

**Date:** 2026-06-15  
**Status:** Design and implementation plan only  
**Prerequisite:** Phase 3H is `CONDITIONAL GO`; `DEMO_DATA` is included in migration scope.

## Current Write Paths

### Runtime API mutations

| Table | Endpoint and operations | Current behavior | Canonical gap |
|---|---|---|---|
| `ak_payments` | `public_html/api/admin/payments.php`: POST, PATCH, DELETE | Writes customer collections directly. After each mutation, recalculates customer-plan statuses from linked and unlinked payments. | No canonical ledger entry or settlement is created. Mutations are not wrapped with plan synchronization in one transaction. Deletion destroys the operational cash record. |
| `ak_payment_plans` | `public_html/api/admin/payment-plans.php`: POST, PATCH, DELETE | Creates and edits customer, employee, or supplier obligations. Allows manual `paid_amount` and status input. Delete is blocked only by linked `ak_payments`. | Paid state can exist without settlement evidence. Canonical ledger and settlement references are not considered by update/delete guards. |
| `ak_expenses` | `public_html/api/admin/expenses.php`: POST, PATCH, DELETE | Writes realized general, project, or customer expenses directly. | No account type, currency, supplier identity, canonical ledger entry, or settlement link. Destructive edit/delete remains possible. |
| `ak_financial_entries` | `public_html/api/admin/financial-statement.php`: POST, PATCH, DELETE | Independently creates, edits, and deletes planned or realized ledger rows. | Does not use the canonical service, provenance fields, immutability rules, reversals, or settlement allocation. |
| `ak_payment_plans.status` | `payments.php` and `payment-plans.php` | Recomputed from `ak_payments`, unlinked collections, and manual `paid_amount`; already-paid plans are skipped. | Multiple authorities can determine status. Allocation order for unlinked collections is implicit and not persisted. |

The frontend reaches these paths through `src/lib/apiClient.ts`: payment-plan mutations at lines 473-492, payment mutations at lines 498-524, financial-entry mutations at lines 551-577, and expense mutations at lines 583-609. UI components call these API functions; they do not write the database directly.

### Non-runtime and historical write sources

- `public_html/install-schema.php` creates and evolves the four tables during installation.
- `public_html/migrations/2026_06_14_001_canonical_cashflow_foundation.sql` is the additive canonical schema migration; it adds canonical fields and `ak_payment_plan_settlements`.
- `migration-tools/convert-supabase-json-to-mysql.mjs` generates import SQL for mapped legacy and ledger tables.
- `migration-tools/output/import-demo-data.sql` contains generated upserts for `DEMO_DATA`. It is migration input, not a runtime path, and is now in scope for classification and migration.
- `public_html/api/admin/run-demo-import.php` can execute an approved demo import file and is therefore a privileged bulk-write path that must remain disabled during canonical cutover except for an explicitly approved environment.
- Historical Supabase migrations and manual seed files contain legacy schema/data writes but are not active MySQL runtime paths.

### Hidden schema mutation risk

`payments.php`, `payment-plans.php`, `financial-statement.php`, and `customers.php` contain request-time `SHOW COLUMNS` checks followed by `ALTER TABLE` statements. These helpers can change schema during ordinary API requests. Phase 4 implementation must remove request-time schema ownership and require explicit, versioned migrations before canonical writes are enabled.

### Current accounting conflict

`ak_payments`, `ak_expenses`, and `ak_financial_entries` are independently writable and are combined by several read/report paths. One business event can therefore be represented twice. Plan state can also be driven by manual fields, linked payments, or unlinked customer collections. There is no persisted allocation explaining how a realized amount settled a specific obligation.

## Canonical Write Path

### Ownership model

- `ak_payment_plans` remains the canonical obligation and due-date schedule.
- `ak_financial_entries` becomes the canonical accounting and cash ledger.
- `ak_payment_plan_settlements` becomes the only authority allocating posted ledger value to plans.
- `ak_payments` and `ak_expenses` remain traceable legacy/operational source records during transition. They must not create a second independently counted event.

### Proposed backend service

Add a transaction-oriented service after this plan is approved, built beside `canonical-finance-service.php` rather than embedding SQL separately in each endpoint. Suggested operations:

1. `createCanonicalEntry(PDO $db, array $command)` validates and inserts one ledger entry.
2. `settlePlan(PDO $db, array $command)` allocates a posted ledger entry to one plan.
3. `createLegacyBackedEntry(PDO $db, string $sourceType, string $sourceId)` creates or returns the unique canonical representation of a legacy payment or expense.
4. `reverseCanonicalEntry(PDO $db, array $command)` inserts a reversal and deactivates affected settlements without deleting the original event.
5. `derivePlanState(PDO $db, string $planId, string $asOfDate)` derives paid, partial, pending, and overdue state from active settlements.

### Atomic settlement sequence

Within one database transaction:

1. Start a transaction and select the plan and ledger entry `FOR UPDATE`.
2. Verify both rows exist and are eligible: plan active; entry posted, non-reversed, and non-canceled.
3. Normalize and validate owner, project scope, account type, currency, direction, and event type through `canonical-finance-service.php`.
4. Lock and sum active settlements for both rows.
5. Reject non-positive allocation, plan over-settlement, or ledger over-allocation.
6. Insert one immutable `ak_payment_plan_settlements` row with actor, source, timestamp, and optional approved exception reason.
7. Recalculate the plan's derived settlement totals and status from persisted allocations.
8. Commit only after every write succeeds; otherwise roll back the entire transaction.

The same transaction must create the ledger entry and settlement when a user records a new payment against a plan. A retry must be idempotent through a request/idempotency key or a unique source identity.

### Event mapping

| Source action | Canonical entry | Settlement behavior |
|---|---|---|
| Customer collection | `customer_receipt`, income, posted | Settle matching customer receivable plan when selected or explicitly allocated. |
| Customer refund | `customer_refund`, expense, posted | Reverse or negatively compensate prior receipt through an explicit linked event; never edit original posted cash. |
| Personnel payment | `personnel_payment`, expense, posted | Settle employee obligation plan. |
| Supplier payment | `supplier_payment`, expense, posted | Settle expense-card/supplier obligation plan. |
| General/project expense | `general_expense`, expense, posted | Usually no plan settlement; use project or company-overhead allocation scope. |
| Forecast | `forecast_income` or `forecast_expense`, forecast | Never counts as realized settlement. |
| Cheque/senet | Forecast/obligation until explicitly cleared at or after maturity | Settlement occurs only when the instrument becomes posted realized value. |
| Correction | `adjustment` or `reversal` with parent and reason | Preserve original event and settlement audit history. |

## Data Integrity Rules

1. Every posted canonical entry has one business identity, positive amount, supported currency, account type, direction, event type, transaction date, and valid ownership/allocation scope.
2. Exactly one counterparty applies when the event type requires a customer, employee, or supplier. Compatibility owner columns must agree with canonical counterparty fields.
3. Plan, ledger entry, and settlement must have identical account type and currency.
4. Counterparty and project must match unless an authorized, recorded exception is approved.
5. Total active settlements cannot exceed either plan amount or ledger entry amount.
6. Plan status and paid amount are derived from active settlements. Manual paid state is migration evidence only, not future settlement authority.
7. Posted entries and settlements are immutable. Corrections use reversal/adjustment records; hard delete is prohibited after posting.
8. `source_type` plus `source_id` uniquely identifies a migrated or dual-written legacy event. A retry returns the existing canonical row.
9. Official and unofficial (`resmi`/`gayri_resmi`) values cannot cross a settlement boundary.
10. TRY, USD, and EUR are supported. Foreign-currency posted entries require a positive exchange rate and base amount under an approved rounding policy.
11. A cheque or senet is not realized merely because it exists or has matured; explicit cleared/paid evidence is required.
12. `DEMO_DATA` follows the same constraints as other migration-scope data and must retain a queryable source marker.
13. Every write records actor, origin, request identity, and timestamps sufficient for audit and replay analysis.
14. No runtime endpoint may execute DDL. Missing schema is a deployment failure, not a request-time repair condition.

## Migration Strategy

### Stage 0 - Approval gate

- Approve this plan and the exact Phase 3B schema version.
- Complete automated classification and Phase 3A reconciliation when hosting execution becomes available.
- Freeze changes to finance semantics while implementation is developed.

### Stage 1 - Schema deployment, separately approved

- Back up the database and record schema/data checksums and row counts.
- Apply the additive canonical foundation migration in staging first.
- Validate columns, indexes, foreign keys, settlement table, and unique provenance constraints.
- Remove request-time `ALTER TABLE` behavior only after the explicit migration is confirmed everywhere.

### Stage 2 - Historical canonicalization

- Migrate `DEMO_DATA` and non-demo records using the same classifier decisions.
- Exact matches: attach provenance without creating duplicates.
- Approved probable matches: attach after review and preserve approval metadata.
- No-match legacy payments/expenses: create one canonical posted entry with deterministic source identity.
- Ambiguous rows: do not migrate until resolved.
- Plans marked paid manually: create settlements only when defensible realized evidence exists; otherwise retain as unresolved migration state.
- Run in deterministic, restartable batches with dry-run manifests and per-batch reconciliation.

### Stage 3 - Shadow canonical writes

- Introduce the canonical transaction service behind a disabled server-side feature flag.
- In staging, route payment, expense, ledger, and plan-settlement commands through the service while legacy reads remain unchanged.
- Compare legacy outputs, canonical entries, settlement totals, plan states, and reports after every scenario.
- Do not allow two independent writes. A legacy compatibility row and canonical entry must be created by one transaction and one command.

### Stage 4 - Read cutover

- Change finance/report reads to canonical ledger and settlements after parity thresholds pass.
- Keep legacy tables readable for audit, but remove them from totals to eliminate double counting.
- Monitor count, amount, owner, project, account, currency, and status reconciliation.

### Stage 5 - Write cutover

- Make the canonical service the only finance mutation boundary.
- Reject direct legacy mutations outside the service.
- Replace destructive posted-entry deletion with reversal commands.
- Retain a short compatibility window only if one atomic transaction maintains both representations.

### Migration acceptance gates

- Zero ambiguous records in the cutover batch.
- Zero duplicate source identities.
- Zero over-allocated plans or entries.
- Zero account/currency/counterparty crossing.
- Canonical totals reconcile to approved source totals by event class and currency.
- All manual-paid plans have approved evidence or an explicit unresolved disposition.
- `DEMO_DATA` counts and totals reconcile independently.

## Rollback Strategy

### Before write cutover

- Disable the canonical feature flag.
- Keep existing endpoints and reads unchanged.
- Roll back only the additive schema with the reviewed Phase 3B rollback script if no canonical production writes exist.

### During shadow writes

- Stop new finance mutations before rollback.
- Reconcile each compatibility record to its canonical source identity.
- Disable canonical reads and return to legacy reads.
- Preserve canonical rows for investigation; do not delete posted audit history automatically.
- If a failed transaction partially wrote data, treat that as a defect because the service must use one transaction. Repair only from an approved reconciliation manifest.

### After read or write cutover

- Roll back application routing first, not financial history.
- Restore legacy read paths only if compatibility writes remained complete and reconciled.
- Represent financial corrections with canonical reversals, not destructive deletion.
- Use the pre-cutover backup only for catastrophic database recovery, with an explicit outage and replay plan for transactions created after the backup.
- Do not run the schema rollback while any canonical settlement or provenance row is authoritative.

## Risks

| Risk | Severity | Control |
|---|---|---|
| Double counting during dual representation | Critical | Unique provenance, one atomic command, canonical-only totals after read cutover. |
| Partial write across ledger, legacy row, settlement, and plan | Critical | Single PDO transaction, row locks, failure rollback, integration fault tests. |
| Concurrent over-allocation | Critical | `FOR UPDATE`, active-allocation sums inside the lock, database uniqueness constraints. |
| Destructive editing/deletion of posted history | Critical | Immutability and reversal-only policy. |
| Manual plan status conflicts with evidence | High | Derive future state solely from settlements; migrate manual state as review metadata. |
| Implicit allocation of unlinked payments | High | Require explicit allocation or preserve unallocated canonical entry; never silently consume plans by date order. |
| Request-time DDL | High | Remove schema mutation helpers after versioned deployment validation. |
| Legacy expenses lack account type/currency/supplier | High | Conservative defaults only with recorded migration decision; otherwise manual review. |
| Project or owner mismatch | High | Service validation and approved exception audit fields. |
| Cheque/senet recognized too early | High | Maturity plus explicit clearance rule. |
| PHP/TypeScript contract drift | Medium | Shared fixtures and PHP integration tests; backend remains authoritative. |
| `DEMO_DATA` obscures real-data metrics | Medium | Preserve marker and report demo/non-demo reconciliations separately. |
| Rollback loses transactions after backup | Critical | Routing rollback first; backup restore only with replay ledger and outage procedure. |

## Test Plan

### Unit and contract tests

- Extend PHP parity coverage for valid and invalid entry creation, plan settlement, over-allocation, account/currency/owner/project mismatch, maturity, idempotency, immutability, and reversal.
- Keep TypeScript fixtures aligned for client-side feedback, while treating PHP results as authoritative.
- Test rounding and exchange-rate behavior at currency precision boundaries.

### Database integration tests

- Run against an isolated MySQL database with the exact migrated schema.
- Verify commit and rollback across ledger insert, compatibility insert, settlement insert, and plan-state derivation.
- Run concurrent settlement attempts proving that only available value can commit.
- Verify repeated requests return the same source-backed entry and do not duplicate allocations.
- Verify hard delete/update rejection for posted entries and active settlements.

### Migration tests

- Dry-run every classification class and produce deterministic manifests.
- Migrate a restored copy, rerun the same batch, and prove idempotency.
- Reconcile pre/post row counts and amounts by source, event type, direction, status, currency, account type, owner, and project.
- Reconcile `DEMO_DATA` separately while keeping it inside migration scope.
- Verify ambiguous and blocked rows remain untouched.

### API and regression tests

- Exercise customer receipt, partial/full plan settlement, unallocated receipt, employee payment, supplier payment, general expense, refund, reversal, cheque, and senet flows.
- Confirm Turkish end-user errors remain stable and no internal identifiers or SQL errors are exposed.
- Verify dashboards, statements, reports, notifications, exports, and payment-plan views do not double count.
- Verify upload/document references survive canonicalization and reversal.

### Operational validation

- `npm run build`
- `npm run test`
- `npm run finance:parity`
- PHP lint for all PHP files
- Migration dry run and rollback rehearsal on a disposable staging restore
- Before/after reconciliation with signed-off totals and blocker count of zero for the cutover batch

## Final Recommendation

**Proceed with implementation only after explicit approval of this plan.** The current code is not safe for canonical settlement activation because four tables remain independently mutable, plan status has multiple authorities, posted ledger rows can be destructively changed, and request handlers can execute DDL.

Phase 4A implementation should first create the isolated atomic settlement service and integration tests behind a disabled feature flag. Schema deployment, historical migration, read cutover, and write activation must remain separate approvals. Phase 3H's `CONDITIONAL GO` supports design and controlled staging implementation; it does not yet authorize migration or production writes.

This document changes no runtime code, schema, database data, or migration state.
