# Phase 4J Backend Canonical Read-Model Facade

## Scope

- Phase: 4J
- Objective: eliminate backend PHP direct financial calculations by introducing a server-side canonical read-model facade.
- Scoped endpoints: dashboard, reports, notifications, payments, payment plans, financial statement.
- Rules followed: no production writes, no migrations, no schema changes, no canonical activation, no write cutover, no runtime DDL.
- Database execution during implementation: none.

## Executive Summary

Phase 4J introduced a backend canonical read-model facade and routed the remaining backend read-side financial summaries and payment-plan state calculations through it.

The facade centralizes:

- payment-plan paid/remaining/overdue state derivation
- dashboard financial totals
- dashboard monthly financial chart totals
- reports aggregate financial totals
- notification due-state classification
- payment and payment-plan GET response status derivation
- customer financial statement plan-state derivation

API response shapes remain stable. Existing write behavior remains active, but write-side legacy mutation was not converted because Phase 4J explicitly forbids write cutover.

## Implemented Files

| File | Change | Status |
| --- | --- | --- |
| `public_html/api/admin/backend-canonical-read-model.php` | Added read-only backend canonical facade | PASS |
| `public_html/api/admin/dashboard.php` | Routed financial summary, overdue/upcoming plans, and monthly financials through facade | PASS |
| `public_html/api/admin/reports.php` | Routed report financial aggregates through facade | PASS |
| `public_html/api/admin/notifications.php` | Routed payment-plan due-state classification through facade | PASS |
| `public_html/api/admin/payments.php` | Routed GET payment-plan state through facade; removed runtime DDL helper | PASS |
| `public_html/api/admin/payment-plans.php` | Routed GET payment-plan state and write-side status derivation through facade; removed runtime DDL helper | PASS |
| `public_html/api/admin/financial-statement.php` | Routed customer statement payment-plan state through facade; removed runtime DDL helper | PASS |
| `tools/backend-canonical-read-model-parity-test.php` | Added fixture-based backend parity test without database access | PASS |

## Facade Contract

The backend facade is read-only and does not activate canonical settlement. It reads existing legacy/canonical-compatible rows and derives stable output fields.

| Function | Purpose |
| --- | --- |
| `canonical_read_dashboard_summary()` | Computes dashboard total payments, expenses, net, month totals, overdue collections, expected payments, and financial entry count |
| `canonical_read_reports_aggregates()` | Computes report aggregate totals without SQL financial aggregates |
| `canonical_read_monthly_financials()` | Computes monthly income/expense/net series in PHP |
| `canonical_read_customer_plan_buckets()` | Produces overdue/upcoming customer receivable buckets |
| `canonical_read_notification_plan_states()` | Produces remaining payment-plan states for notification generation |
| `canonical_read_plan_states()` | Central payment-plan paid/remaining/account-type aware state engine |
| `canonical_read_legacy_status_from_paid()` | Maps canonical plan states back to existing Turkish API status labels |

## Before/After Parity Map

| Surface | Before | After |
| --- | --- | --- |
| Dashboard financial totals | SQL `SUM()` over payments, expenses, and ledger rows plus PHP reductions | `canonical_read_dashboard_summary()` |
| Dashboard monthly chart | SQL `UNION ALL`, `SUM()`, and `GROUP BY` | `canonical_read_monthly_financials()` |
| Dashboard overdue/upcoming plans | Local FIFO-like classifier | `canonical_read_customer_plan_buckets()` |
| Reports aggregates | SQL `COUNT()`/`SUM()` helpers for payments and expenses | `canonical_read_reports_aggregates()` |
| Notifications payment due state | Local paid/remaining classifier | `canonical_read_notification_plan_states()` |
| Payments GET plan state | Raw legacy plan status | `canonical_read_plan_states()` plus legacy status mapping |
| Payment Plans GET plan state | Raw legacy plan status | `canonical_read_plan_states()` plus legacy status mapping |
| Financial Statement customer plans | Raw legacy plan status and runtime DDL guard | Read-only plan query plus canonical state mapping |

## Runtime DDL Removal

Removed runtime schema-altering helpers from scoped endpoint files:

- `payments.php`
- `payment-plans.php`
- `financial-statement.php`

The endpoints no longer call `SHOW COLUMNS`/`ALTER TABLE` guards in the Phase 4J read paths.

## Remaining Non-Financial Aggregates

`dashboard.php` still uses SQL aggregate counters for non-financial admin statistics:

- project counts
- contact request counts
- notification counts
- customer count

These are intentionally out of scope for cashflow math and do not affect the canonical financial read model.

## Remaining Blockers And Constraints

| Item | Status | Notes |
| --- | --- | --- |
| Legacy write endpoints still mutate `ak_payment_plans.status` after payment changes | Remaining constraint | The calculation now calls the facade, but removing the mutation is a write cutover and is not allowed in Phase 4J |
| `notifications.php?generate=1` still writes notification rows | Existing behavior retained | Notification due-state math uses the facade, but write behavior is unchanged |
| Financial statement POST/PATCH/DELETE still writes/deletes `ak_financial_entries` | Existing behavior retained | Write cutover was explicitly out of scope |
| Recent movement feed still merges ledger, payment, and expense rows | Remaining parity surface | It is a movement list, not a financial aggregate, but should be reviewed before final cutover |
| Production-side parity against live SQL Editor path | Not executed | No local SQL was run; server-side parity should be run only through the hosting-side path when explicitly requested |

## Validation

| Validation | Result |
| --- | --- |
| PHP lint: backend facade | PASS |
| PHP lint: dashboard endpoint | PASS |
| PHP lint: reports endpoint | PASS |
| PHP lint: notifications endpoint | PASS |
| PHP lint: payments endpoint | PASS |
| PHP lint: payment plans endpoint | PASS |
| PHP lint: financial statement endpoint | PASS |
| PHP lint: backend parity test | PASS |
| `php tools/backend-canonical-read-model-parity-test.php` | PASS |
| `npm run finance:parity` | PASS |
| `npm run finance:shadow-test` | PASS |
| `npm run test` | PASS |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS |

## Final Decision

READY_FOR_PHASE_5A
