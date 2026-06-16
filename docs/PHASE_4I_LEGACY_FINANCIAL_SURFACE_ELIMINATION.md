# Phase 4I Legacy Financial Surface Elimination

## Scope

- Phase: 4I
- Objective: remove remaining direct legacy financial calculations from backend endpoints, exports, reports, notifications, dashboard, customer, and expense surfaces.
- Rules followed: no SQL, no migrations, no production writes, no schema changes, no canonical activation, no write cutover.
- Canonical activation state: disabled.

## Executive Summary

Phase 4I eliminated several remaining frontend direct financial calculation paths by routing customer, expense, and report totals through documented canonical read-model adapters.

The system is not yet fully converged. Backend PHP endpoints still contain direct SQL aggregate calculations and legacy settlement/status logic that cannot be safely replaced in this phase without a backend read-model adapter contract and endpoint-level parity harness. Because those paths feed dashboards, reports, notifications, and financial statement APIs, the phase is BLOCKED for Phase 5A readiness.

## Implemented Changes

| Area | Before | After | Status |
| --- | --- | --- | --- |
| Shared finance helpers | Mixed compatibility helpers and direct row reductions | Added canonical adapter summaries for payment plans and legacy expense rows | PASS |
| Customer list | Customer balance calculated from local plan/payment reductions | Customer due, paid, and remaining values flow through `summarizePaymentPlansWithCanonicalState()` | PASS |
| Expense page KPIs | Totals, month total, project count, and category count calculated directly in page component | KPI totals flow through `summarizeLegacyExpenseRowsWithCanonicalAdapter()` | PASS |
| Customer payment report | Debt, collected, remaining, and overdue calculated with local `sumBy`/reduce logic | Report totals flow through `summarizePaymentPlansWithCanonicalState()` | PASS |
| Expense report total | Export/report total calculated with direct row reduction | Total flows through `summarizeLegacyExpenseRowsWithCanonicalAdapter()` | PASS |

## Files Changed

- `src/lib/finance.ts`
  - Added `summarizePaymentPlansWithCanonicalState()`.
  - Added `summarizeLegacyExpenseRowsWithCanonicalAdapter()`.
  - Added adapter result types for canonical plan and amount summaries.
- `src/pages/admin/AdminCustomers.tsx`
  - Replaced customer list balance reductions with canonical plan summary adapter.
- `src/pages/admin/AdminExpenses.tsx`
  - Replaced direct expense KPI reductions with canonical expense summary adapter.
- `src/pages/admin/AdminReports.tsx`
  - Replaced customer payment report totals and expense report total with canonical adapters.

## Before/After Parity

| Surface | Legacy Calculation Risk | Phase 4I Result |
| --- | --- | --- |
| Customer list card totals | Planned, paid, and remaining values could drift from canonical overdue/status rules | Routed through canonical plan state adapter |
| Expense dashboard KPIs | Expense totals could drift from canonical posted/reversed/archive handling | Routed through canonical expense adapter |
| Customer payment report/export | Report math duplicated customer-card payment logic | Routed through canonical plan state adapter |
| Expense report/export | Export total duplicated expense page math | Routed through canonical expense adapter |
| Financial statement page | Already partially routed through canonical helpers in earlier phases | No additional cutover performed |
| Dashboard widgets | Backend still returns direct SQL aggregate totals | BLOCKED |
| Backend reports API | Backend still performs direct SQL aggregates | BLOCKED |
| Backend notifications API | Backend still computes overdue/upcoming payment states directly | BLOCKED |

## Remaining Direct Financial Calculation Paths

The following paths still need remediation before Phase 5A can be considered production-safe:

- `public_html/api/admin/dashboard.php`
  - Direct SQL aggregates for payments, expenses, ledger totals, monthly totals, and overdue customer amounts.
- `public_html/api/admin/reports.php`
  - Direct report SQL aggregates for income, expenses, project profitability, and customer balances.
- `public_html/api/admin/notifications.php`
  - Direct overdue/upcoming logic based on payment plan state and paid amounts.
- `public_html/api/admin/payments.php`
  - Legacy payment write-path and plan status synchronization remain active.
- `public_html/api/admin/payment-plans.php`
  - Legacy planned/paid/status logic remains active.
- `public_html/api/admin/financial-statement.php`
  - Still joins and unions legacy payments, expenses, and financial ledger rows.
- `src/pages/admin/AdminDashboard.tsx`
  - Consumes backend aggregate fields, so it cannot be fully canonicalized until the dashboard API is routed through the read-model adapter.
- `src/pages/admin/AdminCustomerDetail.tsx`
  - Still contains compatibility allocation and display logic that depends on legacy API payload shape.
- `src/components/admin/finance/FinancialStatementPage.tsx`
  - Still has compatibility paths for legacy account summaries/charts.
- `src/pages/admin/AdminFinance.tsx`
  - Still depends on legacy payment-plan queues and compatibility allocation wrappers.

## Source-of-Truth Conflicts Still Present

| Conflict | Risk | Required Resolution |
| --- | --- | --- |
| Backend SQL aggregates vs canonical read model | Dashboard/report/export values can disagree with card values | Add backend canonical read-model adapter or API facade |
| Legacy plan `paid_amount` vs allocated payment totals | Partial payments and overpayment states can diverge | Centralize status derivation through canonical contract |
| Legacy payments/expenses vs ledger entries | Same business event can appear in multiple surfaces | Introduce endpoint parity guard before cutover |
| Notification overdue logic vs card overdue logic | User alerts can disagree with customer card | Route notifications through canonical due-state adapter |
| Supplier/vendor cost still expense-row driven | Supplier payable card remains incomplete | Add supplier identity adapter and parity fixtures |

## Validation

| Command | Result |
| --- | --- |
| `npm run finance:parity` | PASS |
| `npm run finance:shadow-test` | PASS |
| `npm run test` | PASS |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS |

No SQL was executed during this phase.

## Phase 5A Blockers

1. Backend financial endpoints still calculate totals directly from legacy tables.
2. Dashboard and notification surfaces still depend on backend-calculated financial summaries.
3. Financial statement API still mixes legacy payment, expense, and ledger rows.
4. Legacy write-path status synchronization remains active and cannot be removed without an explicit write-cutover phase.
5. Supplier/vendor card math still needs a canonical identity model and parity fixture coverage.
6. Production-side read parity was not run because Phase 4I explicitly prohibited SQL.

## Required Next Step

Before Phase 5A, implement a backend canonical read-model facade for dashboard, reports, notifications, financial statement, customer detail, project detail, personnel, supplier, and export endpoints. Keep canonical activation disabled until parity is proven against the existing SQL Editor/server-side connection path.

## Final Decision

BLOCKED
