# Phase 4H - Financial Surface Convergence

**Date:** 2026-06-15  
**Scope:** Read-model convergence audit and safe helper consolidation  
**Database activity:** None  
**Migrations:** None  
**Production writes:** None  
**Schema changes:** None  
**Canonical activation:** No  
**Final decision:** `BLOCKED`

## Executive Summary

Phase 4H moved the remaining shared frontend ledger and legacy plan-status helper paths closer to the canonical read-model contract, but a full financial-surface convergence is not complete yet.

The frontend shared ledger summaries now use `canonicalReadModel`, and the compatibility paid/status helpers now delegate plan state derivation to `deriveCanonicalReadPlanState()`. This reduces duplicate calculation paths across financial statement pages, customer/project/personnel/supplier card summaries, reports, and KPI pages that consume `src/lib/finance.ts`.

However, several production financial surfaces still depend on backend PHP SQL aggregates or page-local legacy calculations. Because the stated goal is every financial screen, dashboard, report, export, and summary, Phase 4H must be marked `BLOCKED` until those remaining surfaces are routed through a server-side canonical read model or explicitly retained as legacy/audit-only.

## Files Changed

| File | Change |
| --- | --- |
| `src/lib/finance.ts` | Routed ledger realized/planned helpers through `calculateCanonicalCardMetrics()`. Routed `effectivePaidForPlan()` and `derivePlanStatus()` through canonical read-model plan state. |
| `src/components/admin/finance/FinancialStatementPage.tsx` | Routed statement summary realized/planned totals through `calculateCanonicalCardMetrics()` per currency. |
| `src/lib/canonicalReadModel.ts` | Existing Phase 4G shared contract remains the calculation boundary for converged frontend helpers. |
| `src/test/canonical-read-model.test.ts` | Existing Phase 4G parity tests continue covering customer, project, personnel, supplier, category, duplicate-risk, and plan-state math. |

## Surface Audit

| Surface | Current State After Phase 4H | Status |
| --- | --- | --- |
| Financial statement pages | Shared summary metrics for realized/planned totals route through `canonicalReadModel` | Partially converged |
| Customer cards | Paid/status helpers now route through canonical plan state, but screen-level chart/account summaries still use page-local aggregation | Partially converged |
| Project cards | Shared statement summary uses canonical ledger metrics; backend/project report sources still need read endpoint convergence | Partially converged |
| Personnel cards | Shared statement summary uses canonical ledger metrics | Partially converged |
| Supplier cards | Shared statement summary uses canonical ledger metrics; supplier identity remains expense-card based | Partially converged |
| Expense category views | Category test contract exists, but live expense reports still aggregate legacy `ak_expenses` rows directly | Blocked |
| Dashboard widgets | `AdminDashboard` consumes PHP `dashboard.php` aggregate fields that are still SQL/legacy calculated | Blocked |
| Finance dashboard/KPI summaries | `AdminFinance` uses `summarizeLedgerFinance()` for ledger metrics, but plan/payment queues still use legacy allocation helpers | Partially converged |
| Reports | General/project summaries use converged finance helpers; customer payment, overdue, collections, expense report rows still do local legacy sums | Partially converged |
| Export/PDF generation | Exports use the same row objects as report screens, so any local legacy report calculation remains in exported values | Blocked |

## Before And After Parity

| Area | Before | After |
| --- | --- | --- |
| Ledger realized income | Local direct status/direction filters | `calculateCanonicalCardMetrics(...).realizedIncome` |
| Ledger realized expense | Local direct status/direction filters | `calculateCanonicalCardMetrics(...).realizedExpense` |
| Ledger planned income | Local direct `Planlandı`/`Gelir` filters | `calculateCanonicalCardMetrics(...).totalPlannedReceivable` |
| Ledger planned expense | Local direct `Planlandı`/`Gider` filters | `calculateCanonicalCardMetrics(...).plannedCategoryCost` |
| Legacy effective paid amount | Manual paid/link/FIFO amount returned directly | Manual/link/FIFO evidence converted into synthetic settlement evidence and passed through canonical plan state |
| Legacy plan status | Local status branching | Canonical `deriveCanonicalReadPlanState()` mapped back to Turkish display labels |
| Financial statement summary | Page-local realized/planned filters | Canonical metric path per currency |

## Remaining Direct Calculation Paths

The following paths still contain direct financial calculations and must be handled before final read cutover:

- `public_html/api/admin/dashboard.php`: dashboard SQL aggregates and overdue/upcoming plan logic.
- `public_html/api/admin/finance-summary.php`: backend summary calculations.
- `public_html/api/admin/financial-statement.php`: legacy payment/expense union rows and manual statement logic.
- `public_html/api/admin/notifications.php`: overdue/upcoming plan calculations.
- `src/pages/admin/AdminDashboard.tsx`: displays backend aggregate fields.
- `src/pages/admin/AdminCustomers.tsx`: customer list totals still aggregate page-local plan/payment data.
- `src/pages/admin/AdminCustomerDetail.tsx`: account summaries and charts still aggregate enriched plans locally.
- `src/pages/admin/AdminFinance.tsx`: overdue/upcoming lists still use legacy allocation evidence.
- `src/pages/admin/AdminReports.tsx`: customer payment, overdue, collections, expense, and export rows still use local legacy sums.
- `src/pages/admin/AdminExpenses.tsx`: expense totals/month totals still aggregate legacy expense rows directly.

## Validation

| Check | Result |
| --- | --- |
| `npm run finance:parity` | PASS, 15 passed, 0 failed |
| `npm run finance:shadow-test` | PASS, 9 scenarios plus duplicate-risk probe |
| `npm run build` | PASS |
| `npm run test` | PASS, 4 files, 23 tests |
| `npx tsc --noEmit` | PASS |

## Safety Confirmation

- No SQL executed.
- No production data read or modified.
- No migrations added.
- No schema changes.
- No canonical activation.
- No write-path changes.
- No new DB connection path.

## Final Decision

`BLOCKED`

The shared frontend helper boundary is converged further, but every production financial surface is not yet using the canonical read-model contract. Phase 5A should not begin until the blockers in `docs/PHASE_4H_CUTOVER_BLOCKERS.md` are resolved or explicitly accepted as legacy/audit-only.

