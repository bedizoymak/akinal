# Phase 3C — Canonical Domain Service, Validation, and Contract Tests

Implementation date: 14 June 2026

## Executive Summary

- **What was added:** An isolated PHP canonical finance domain service, a pure TypeScript parity contract, and focused contract tests for canonical ledger validation, settlement compatibility, maturity policy, status derivation, immutability, and reversal requirements.
- **What was not changed:** No existing endpoint includes or calls the service. No database data, schema, UI, route, dashboard/report calculation, finance helper, legacy write path, or production credential was changed.
- **Why runtime behavior is unchanged:** The PHP service is a standalone function library. The TypeScript helper is imported only by its test file. No application page or API module imports either contract.

The new layer defines the rules required for later canonical writes without activating those writes.

## Backend Service

Backend file:

`public_html/api/admin/canonical-finance-service.php`

### Enum functions and constants

The service defines controlled values for:

- event type
- direction
- status
- account type
- allocation scope
- counterparty type
- currency
- reconciliation status
- migration confidence

`canonical_enum_values()` exposes the approved values by contract name.

### Payload validation

- `canonical_validate_ledger_payload()`
- `canonical_validate_payment_plan_fields()`
- `canonical_validate_settlement_payload()`
- `canonical_validate_counterparty_consistency()`
- `canonical_validate_project_scope()`
- `canonical_validate_account_type_consistency()`
- `canonical_validate_currency_consistency()`
- `canonical_validate_cheque_senet_maturity_policy()`
- `canonical_validate_immutable_posted_entry()`
- `canonical_validate_reversal_adjustment_requirements()`

Validation functions return English error lists and do not emit HTTP responses. This keeps the service independent from current API behavior and lets a future endpoint map errors to Turkish UI messages.

### Settlement totals and calculations

- `canonical_get_plan_settlement_total()`
- `canonical_get_entry_settlement_total()`
- `canonical_calculate_remaining_plan_amount()`
- `canonical_calculate_available_entry_amount()`
- `canonical_derive_plan_status_from_settlements()`

The two database helpers require an explicitly supplied `PDO` instance and execute only aggregate `SELECT` statements against active, non-reversed settlements.

### Settlement assertions

- `canonical_assert_no_over_allocation()`
- `canonical_assert_same_account_type()`
- `canonical_assert_same_currency()`
- `canonical_assert_same_counterparty()`
- `canonical_assert_same_project()`

Assertions throw `DomainException` when a future transaction would violate the canonical contract. They do not write records.

## Validation Contract

### Event types

`customer_receipt`, `customer_refund`, `personnel_payment`, `supplier_payment`, `general_expense`, `expense_refund`, `forecast_income`, `forecast_expense`, `adjustment`, `reversal`, `transfer`, `opening_balance`, and `currency_difference`.

### Directions and statuses

- Directions: `income`, `expense`, `transfer`
- Statuses: `draft`, `forecast`, `posted`, `canceled`, `reversed`, `archived`

### Ownership

- Customer, employee, and supplier types require `counterparty_id`.
- Internal and none counterparties must not carry a counterparty ID.
- Canonical IDs must match compatibility fields when both are supplied.
- Settlement plan and entry counterparties must match.

### Project scope

- `project` requires `project_id`.
- `company_overhead` must not carry `project_id`.
- `company_overhead` and `unallocated` require an explanation.
- Settlement project and allocation scope must match unless an explicitly approved exception is supplied.

### Account and currency

- Account values are `resmi` or `gayri_resmi`.
- Currency values are TRY, USD, or EUR.
- Plan, ledger entry, and settlement must use the same account type and currency.
- Posted foreign-currency entries require a positive exchange rate.
- Posted entries require a positive base amount.

### Reconciliation and migration

- Reconciliation: `pending`, `matched`, `ambiguous`, `excluded`, `approved`
- Migration confidence: `exact`, `probable`, `ambiguous`, `manual`

The service validates these values when provided but does not classify existing data.

## Settlement Contract

A future settlement transaction must:

1. Use a positive allocation amount.
2. Not exceed the plan's unsettled amount.
3. Not exceed the ledger entry's unallocated amount.
4. Match account type.
5. Match currency.
6. Match counterparty.
7. Match project and allocation scope unless a reviewed exception is recorded.

Status derivation returns separate `status`, `remaining_amount`, and `is_overdue` values:

- no settlement and future due date: `pending`
- no settlement and past due date: `overdue`
- settlement below plan amount: `partial`
- settlement equal to plan amount: `paid`
- a past-due partial plan remains `partial` with `is_overdue = true`

This preserves both payment progress and overdue remaining balance instead of collapsing them into one ambiguous label.

## Cheque/Senet Policy

- An issued or received cheque/senet is not realized cash.
- It becomes realized only when the maturity date has arrived and the instrument is explicitly cleared or paid.
- A matured but unpaid instrument remains an obligation/receivable.
- A protested or returned instrument must not remain posted cash and requires an explicit reversal flow.
- Cheque requires `cheque_maturity_date`; senet requires `promissory_maturity_date`.

The validator accepts an explicit as-of date for deterministic tests and future reconciliation runs.

## Immutability and Reversal Rules

A posted entry cannot destructively change:

- business transaction identity
- event type
- direction
- amount
- currency
- account type
- transaction date
- counterparty
- project
- allocation scope

Reversal and adjustment events require:

- `parent_entry_id`
- an explicit reason

The original posted entry remains intact. Actual reversal insertion is intentionally deferred because Phase 3C does not enable canonical writes.

## Tests Added

TypeScript contract:

`src/lib/canonicalFinanceContract.ts`

Tests:

`src/test/canonical-finance-contract.test.ts`

Coverage includes:

- valid customer receipt
- unsupported currency
- invalid account type
- invalid counterparty
- project required unless company overhead
- company-overhead validation
- cheque/senet realization policy
- plan/settlement account mismatch
- plan/settlement currency mismatch
- official/unofficial crossing
- over-allocation
- partial and full settlement statuses
- overdue remaining balance on partial settlement
- posted-entry immutability
- reversal parent/reason requirements

The TypeScript helper mirrors the PHP rules but is not a replacement for future PHP integration tests. The PHP service remains the authoritative backend contract once enabled.

## Runtime Integration Status

Runtime integration is **not enabled**.

- Existing finance endpoints do not include `canonical-finance-service.php`.
- Dashboard, Finance, Reports, cards, and statements still use legacy calculations.
- Payments, expenses, payment plans, and financial-statement endpoints still use their existing write behavior.
- No canonical settlement is inserted, updated, or reversed.
- No data migration or backfill runs.
- The TypeScript contract is test-only and is not included in UI application paths.

An HTTP dry-run endpoint was not created. Even read-only finance diagnostics would add a production route, authorization surface, parameter-validation burden, and potential disclosure path before the service has PHP integration tests. Phase 3D can use CLI/read-only reconciliation tooling without expanding the web API.

## Risks / Limitations

1. PHP behavior is syntax-validated but does not yet have executable PHP unit/integration tests.
2. TypeScript parity tests can drift from PHP unless both contracts are reviewed together.
3. No transaction service exists yet for atomic settlement creation/reversal.
4. Database constraints do not enforce all domain enums or cross-table compatibility.
5. `approved_project_exception` is only a service input contract; no permission/audit model exists yet.
6. Counterparty existence is not queried by pure payload validators.
7. Exchange-rate source and rounding policy still require implementation.
8. Current live endpoints can still edit/delete legacy and ledger records under old behavior.
9. The Phase 3B migration must be applied and verified before database-backed settlement helpers can run.
10. No production or staging finance data was accessed.

## Validation Results

- `npm run build`: passed. Vite 5.4.21 transformed 2,637 modules and completed the production build in 10.07 seconds.
- `npm run test`: passed. Vitest reported 3 test files and 16 tests passed, including 10 new canonical contract tests.
- PHP syntax validation: passed. All 49 PHP files under `public_html` passed `php -l`.
- Runtime isolation/read-only check: passed. No live PHP endpoint or UI module imports the new canonical service/helper, and the service contains no data-changing SQL.
- `git diff --check`: passed; Git emitted only the existing Windows line-ending normalization warning for `public_html/install-schema.php`.
- Database-backed canonical helper execution: Manual verification required after Phase 3B staging deployment.

## Recommended Phase 3D

Proceed with **Phase 3D — Read-Only Migration Classification and PHP Parity Harness**.

Phase 3D should:

1. Build a CLI-only, read-only classifier for legacy payments, expenses, plans, and ledger entries.
2. Produce exact/probable/ambiguous classifications without inserting canonical rows.
3. Add a PHP test harness that executes the canonical service directly with fixtures.
4. Compare PHP and TypeScript contract outputs for the same fixture matrix.
5. Quantify migration batches, duplicate candidates, project/account/currency gaps, and manual settlement treatments.
6. Keep all live reads and writes unchanged until classification and parity results are approved.
