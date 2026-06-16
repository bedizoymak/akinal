# Phase 5A Controlled Canonical Read Cutover Plan

## Scope

- Phase: 5A
- Objective: plan a safe read-side cutover from legacy financial calculations to the canonical read-model facade.
- Status: planning only.
- Rules followed: no production writes, no migrations, no schema changes, no activation, no local SQL.
- Source documents:
  - `docs/PHASE_4J_BACKEND_CANONICAL_READ_MODEL_FACADE.md`
  - `docs/ENGINEERING_GUARDRAILS.md`

## Current State

Phase 4J already routed backend read-side financial calculations through `public_html/api/admin/backend-canonical-read-model.php` while keeping response shapes stable.

The cutover plan must therefore be conservative: introduce read flags and verification gates around the facade, not a new database path, schema, or write model.

## Read Surfaces Covered By Canonical Facade

| Surface | Endpoint/File | Canonical Facade Coverage | Status |
| --- | --- | --- | --- |
| Dashboard financial totals | `public_html/api/admin/dashboard.php` | `canonical_read_dashboard_summary()` | Covered |
| Dashboard month chart | `public_html/api/admin/dashboard.php` | `canonical_read_monthly_financials()` | Covered |
| Dashboard overdue/upcoming collections | `public_html/api/admin/dashboard.php` | `canonical_read_customer_plan_buckets()` | Covered |
| Reports financial aggregates | `public_html/api/admin/reports.php` | `canonical_read_reports_aggregates()` | Covered |
| Notifications due-state classification | `public_html/api/admin/notifications.php` | `canonical_read_notification_plan_states()` | Covered |
| Payments GET plan state | `public_html/api/admin/payments.php` | `canonical_read_plan_states()` and `canonical_read_legacy_status_from_paid()` | Covered |
| Payment Plans GET plan state | `public_html/api/admin/payment-plans.php` | `canonical_read_plan_states()` and `canonical_read_legacy_status_from_paid()` | Covered |
| Customer financial statement plan state | `public_html/api/admin/financial-statement.php` | `canonical_read_plan_states()` and legacy status mapping | Covered |

## Frontend Read Surfaces Already Aligned

| Surface | Canonical Alignment | Status |
| --- | --- | --- |
| Customer list | `summarizePaymentPlansWithCanonicalState()` | Covered |
| Expense KPIs | `summarizeLegacyExpenseRowsWithCanonicalAdapter()` | Covered |
| Customer payment report | `summarizePaymentPlansWithCanonicalState()` | Covered |
| Expense report totals | `summarizeLegacyExpenseRowsWithCanonicalAdapter()` | Covered |
| Financial statement cards | `calculateCanonicalCardMetrics()` compatibility path | Covered with compatibility caveats |
| Admin finance summary | `summarizeLedgerFinance()` and canonical-compatible adapters | Covered with compatibility caveats |

## Remaining Legacy Read Dependencies

| Dependency | Why It Remains | Cutover Risk |
| --- | --- | --- |
| `ak_payments` rows in reports, statements, dashboard movement feed, and frontend compatibility adapters | Legacy receipts are still the live write source | Duplicate risk with ledger rows if canonical entries become authoritative without classification |
| `ak_expenses` rows in reports, statements, finance page, and expense cards | Legacy expenses are still the live write source | Supplier/category totals remain weaker until expense identity is canonicalized |
| `ak_payment_plans.paid_amount` | Compatibility evidence for partial payment state | Can diverge from settlement-backed truth |
| Turkish legacy statuses: `Ödendi`, `Kısmi Ödendi`, `Bekliyor`, `Vadesi Geçti`, `İptal` | API response compatibility | UI can remain stable, but status mapping must be monitored |
| Financial statement recent movement union | Movement feed still shows ledger rows plus legacy payment/expense rows | Can visually duplicate the same business event |
| Notification generation writes | Existing `notifications.php?generate=1` behavior writes notification rows | Not a read cutover problem, but verification must avoid uncontrolled generation |
| Legacy write-side plan status sync | Existing payment/payment-plan write endpoints still update plan statuses | Removing it is write cutover and must not happen in Phase 5A |
| Supplier/vendor identity via `ak_expense_cards` | Supplier master model is not yet fully separated from expense category card | Supplier card acceptance must remain limited |

## Feature-Flagged Cutover Strategy

### Flags

Introduce read-only flags in a later implementation phase:

| Flag | Default | Purpose |
| --- | --- | --- |
| `CANONICAL_READ_MODEL_ENABLED` | `false` | Enables canonical facade as the authoritative read source for covered financial summaries |
| `CANONICAL_READ_MODEL_SHADOW_COMPARE` | `true` | Computes legacy-compatible and canonical outputs side-by-side for comparison where legacy formulas still exist |
| `CANONICAL_READ_MODEL_FAIL_CLOSED` | `true` | Falls back to legacy-compatible read path or blocks activation if canonical output is missing required fields |
| `CANONICAL_READ_MODEL_LOG_MISMATCHES` | `true` | Records parity mismatches without printing secrets |

Do not reuse `CANONICAL_SETTLEMENT_ENABLED`. Settlement/write activation and read-model activation must remain separate.

### Rollout Sequence

1. Add flag reads without enabling them in production.
2. Keep canonical facade available but non-authoritative unless `CANONICAL_READ_MODEL_ENABLED=true`.
3. Run local fixture parity:
   - `php tools/backend-canonical-read-model-parity-test.php`
   - `npm run finance:parity`
   - `npm run finance:shadow-test`
   - `npm run test`
   - `npx tsc --noEmit`
   - `npm run build`
4. Upload to hosting with `CANONICAL_READ_MODEL_ENABLED=false`.
5. Run server-side read-only verification through the existing hosting path.
6. Enable shadow comparison only, if supported, without changing UI-visible output.
7. Compare covered surfaces:
   - dashboard totals
   - dashboard monthly chart
   - overdue/upcoming collections
   - reports aggregates
   - notifications due-state candidates
   - payments plan state
   - payment-plans plan state
   - customer financial statement plan state
8. Enable authoritative canonical reads for one low-risk surface first, preferably reports aggregates.
9. Expand to dashboard totals and monthly chart.
10. Expand to overdue/upcoming collections and notification due-state classification.
11. Expand to payments/payment-plans/financial-statement read payloads.
12. Keep write-path behavior unchanged until a dedicated write cutover phase.

## Rollback Strategy

Rollback must be immediate and read-only:

1. Set `CANONICAL_READ_MODEL_ENABLED=false`.
2. Keep `CANONICAL_SETTLEMENT_ENABLED=false`.
3. Do not alter schema or data.
4. Clear any application/server cache if present.
5. Re-test the same read surfaces with legacy-compatible output.
6. Preserve mismatch logs for analysis.
7. If a deployed file causes PHP runtime errors, revert only the Phase 5B read-flag wiring files, not unrelated finance work.

Rollback succeeds when:

- dashboard loads
- reports load
- notifications load
- payments and payment plans load
- financial statements load
- no production data changes were made

## Production Verification Checklist

All production DB verification must run server-side through the known-working hosting path. Local `localhost` PDO tests are not authoritative.

### Before Activation

- Confirm SQL Editor works against `akinalin_wp282`.
- Confirm deployed `public_html/api/config.php` is the active source of truth.
- Confirm `CANONICAL_SETTLEMENT_ENABLED=false`.
- Confirm `CANONICAL_READ_MODEL_ENABLED=false`.
- Confirm no migrations are pending for this phase.
- Confirm no runtime DDL exists in scoped read endpoints.
- Confirm PHP lint passes for changed PHP files.
- Confirm build/test suite passes.

### Shadow Verification

Run read-only comparisons for:

- dashboard summary totals
- dashboard monthly financials
- overdue collections count and amount
- upcoming collections count and amount
- reports aggregate totals
- notification candidate counts
- payment plan derived status buckets
- customer statement plan states

Acceptable mismatch threshold before cutover: zero unexplained mismatches.

### After Partial Activation

- Verify response shape is unchanged.
- Verify dashboard cards render.
- Verify reports/export UI still renders.
- Verify notifications page still renders.
- Verify payments page plan selectors still render.
- Verify payment plans page statuses still render.
- Verify customer financial statement plan cards still render.
- Confirm no production writes occurred during read verification.

## GO Criteria

Phase 5B may proceed only if all conditions are true:

1. Phase 4J facade files are deployed and PHP-lint clean.
2. `CANONICAL_SETTLEMENT_ENABLED=false`.
3. `CANONICAL_READ_MODEL_ENABLED=false` by default.
4. Server-side SQL Editor path confirms the production database is `akinalin_wp282`.
5. No local `localhost` DB result is used as proof.
6. Fixture parity passes locally.
7. Server-side read-only parity shows zero unexplained mismatches for covered read surfaces.
8. API response shapes are unchanged.
9. No runtime DDL remains in scoped read endpoints.
10. Rollback is a flag-only operation.
11. Recent movement duplicate-risk behavior is documented and accepted as non-authoritative display until a later phase.
12. Supplier/vendor card limitations are documented and accepted until supplier identity is canonicalized.

## NO-GO Criteria

Do not proceed to Phase 5B if any condition is true:

1. SQL Editor cannot verify the production DB path.
2. Any verification is attempted using local `DB_HOST=localhost` as proof.
3. Any migration or schema change is required.
4. Any production write is needed to make reads work.
5. Any covered endpoint changes response shape unexpectedly.
6. Any canonical read output misses required dashboard/report/payment-plan fields.
7. Any official/unofficial account type mismatch appears.
8. Any overdue/upcoming count differs without a documented reason.
9. Any payment-plan remaining amount differs without a documented reason.
10. Any duplicate/double-count risk appears in authoritative totals.
11. Rollback requires code deployment, schema changes, or data mutation instead of a flag flip.

## Phase 5B Implementation Target

Phase 5B should implement the disabled read-cutover flags and shadow comparison harness around the backend facade.

It should not:

- enable canonical settlement
- change write behavior
- run migrations
- alter schema
- mutate production financial data
- remove legacy write-side status sync

It should:

- add read flags
- keep defaults disabled
- expose safe parity diagnostics
- preserve API shapes
- document server-side production verification results

## Final Decision

READY_FOR_PHASE_5B
