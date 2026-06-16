# Phase 4G - Read Model Parity Implementation

**Date:** 2026-06-15  
**Scope:** Read-model parity remediation only  
**Runtime behavior changed:** Limited to shared frontend ledger summary math  
**Database activity:** None  
**Migrations:** None  
**Production writes:** None  
**Canonical activation:** No  
**Final decision:** `READY_FOR_PHASE_4H`

## Summary

Phase 4G added a shared canonical read-model calculation layer and parity tests for the financial card mathematics defined in Phase 4F.

The implementation keeps canonical settlement disabled. It does not introduce a new database connection path, does not run SQL, does not modify production data, and does not change schema.

## Implemented

### Shared Read Model

Created `src/lib/canonicalReadModel.ts` with:

- canonical category code list;
- account type normalization;
- currency normalization;
- direction normalization;
- active plan filter;
- posted entry filter;
- forecast entry filter;
- active settlement filter;
- settlement-backed remaining and overdue calculations;
- customer, project, personnel, supplier, and category metric calculations;
- parity comparison reporter;
- duplicate-risk and unresolved legacy counters.

### Duplicate Calculation Reduction

The older ledger summary helpers in `src/lib/finance.ts` now delegate realized/planned ledger totals to `calculateCanonicalCardMetrics()`:

- `realizedIncomeFromLedger()`
- `realizedExpenseFromLedger()`
- `plannedIncomeFromLedger()`
- `plannedExpenseFromLedger()`

The shared financial statement page summary in `src/components/admin/finance/FinancialStatementPage.tsx` now uses the canonical read-model metric path for:

- realized income;
- realized expense;
- planned income;
- planned expense.

This covers the shared statement surface used by customer, project, personnel, and supplier/expense-card finance cards.

### Parity Tests

Created `src/test/canonical-read-model.test.ts` with synthetic fixture coverage for:

- customer balance;
- official vs unofficial split;
- project profitability;
- personnel payroll/payable;
- supplier payable/material category;
- derived paid/partial/pending/overdue/canceled plan state;
- duplicate/double-count exclusion;
- unresolved legacy row counters;
- parity amount mismatch reporting.

## Before And After

| Area | Before | After |
| --- | --- | --- |
| Ledger realized income/expense | Repeated direct filters in multiple helpers | Shared canonical read-model metric path |
| Ledger planned income/expense | Repeated direct filters in multiple helpers | Shared canonical read-model metric path |
| Financial statement summary | Local `Gerçekleşti`/`Planlandı` filters | Canonical metric function per currency |
| Customer balance fixture | Not covered by canonical read-model tests | Covered by settlement-backed remaining and overdue tests |
| Project profitability fixture | Shadow test only | Read-model test covers realized net and forecast completion profit |
| Personnel payable fixture | Shadow test only | Read-model test covers planned, realized, remaining, overdue |
| Supplier/material fixture | Shadow test only | Read-model test covers payable, payment, and category impact |
| Duplicate/double-count risk | Shadow classifier only | Read-model counters and parity mismatch test added |

## Formula Behavior

| Requirement | Implementation |
| --- | --- |
| Planned vs realized | Plans drive obligations; posted entries drive realized; forecast entries are separate planned evidence when no plan is in scope. |
| Official vs unofficial | Metrics can be filtered by `resmi` or `gayri_resmi`; account splits are computed separately. |
| Overdue | `remaining > 0` and `due_date < as_of_date`. |
| Allocation | Remaining and plan state use active settlements only. |
| Profitability | `realized income - realized expense` and `realized income + remaining receivable - realized expense - remaining payable` are separate. |
| Double-count risk | Duplicate-risk rows are excluded from canonical totals and counted in parity output. |
| Reversal/archive/cancel | Reversed, canceled, archived, and legacy `İptal` rows are excluded from active totals. |
| Currency | Metrics are filtered per currency bucket. |

## Validation

| Check | Result |
| --- | --- |
| `npm run test -- canonical-read-model` | PASS, 7 tests |
| `npm run test` | PASS, 4 files, 23 tests |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS |
| `npm run finance:parity` | PASS, 15 passed, 0 failed |
| `npm run finance:shadow-test` | PASS, 9 scenarios plus duplicate-risk probe |
| `npm run finance:transaction-test` | PASS before read-model consolidation; no transaction code changed in Phase 4G |
| `npm run lint` | FAIL due to pre-existing broad lint debt, mostly `@typescript-eslint/no-explicit-any` and hook dependency warnings in existing admin files |

The lint failure is not introduced by the Phase 4G read-model files. It remains a project-wide cleanup gate.

## Safety Notes

- No SQL was executed.
- No production data was read or modified.
- No migrations were added.
- No runtime DDL was added.
- No canonical write/read cutover was activated.
- `CANONICAL_SETTLEMENT_ENABLED` remains off by default.
- Hosting-side SQL rules remain unchanged.

## Final Decision

`READY_FOR_PHASE_4H`

Phase 4G is ready to proceed into a controlled Phase 4H read cutover plan. This decision does not authorize production activation by itself; Phase 4H must still handle backend endpoint ownership, production parity approval, and unresolved legacy classification.

