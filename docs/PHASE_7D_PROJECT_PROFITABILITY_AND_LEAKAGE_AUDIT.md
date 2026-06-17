# Phase 7D Project Profitability And Leakage Audit

## Scope

- Phase: `PHASE_7D_PROJECT_PROFITABILITY_AND_LEAKAGE_AUDIT`
- Goal: verify project profitability, project cost leakage, project receivables/payables, official/unofficial project movements, and realized vs planned treatment.
- Production data writes: none
- Migrations/schema changes: none
- Config/env changes: none
- Settlement activation: not enabled

## Finding

A real read-model calculation bug was found and fixed.

Project cards and project drilldown profit components were using:

```text
ak_payments - ak_expenses
```

Hosted read-only SQL showed this did not reconcile with project-linked realized canonical financial entries:

| Source | Hosted amount |
| --- | ---: |
| Legacy project payments revenue | 82,968,250 |
| Legacy project expenses cost | 36,427,500 |
| Realized project financial-entry revenue | 67,748,995 |
| Realized project financial-entry expense | 31,427,269 |
| Planned project obligations | 5,523,334 |

Because Phase 7B and Phase 7C now use `ak_financial_entries` for planned payable pressure and forward cash risk, project profitability needed to use the same canonical realized source. Otherwise management could see one project profit in cards/drilldowns and a different project cash pressure in command/forecast surfaces.

## Fix Applied

Project profitability read model now uses:

- realized project revenue from `ak_financial_entries`
- realized project expenses from `ak_financial_entries`
- planned obligations only in outstanding payables and cash exposure
- official/unofficial project revenue, expense, profit, and cash exposure split fields

Project drilldowns were also aligned:

- `project.revenue_rows`: realized project-linked income entries
- `project.expense_rows`: realized project-linked expense entries
- `project.profit_components`: realized project-linked income minus realized project-linked expense

The UI now exposes project cash exposure plus official/unofficial project profit in project cards.

## Documented Formulas

Project Total Revenue:

```text
sum(ak_financial_entries.amount)
where project_id is not null
  and direction = 'Gelir'
  and status = 'Gerçekleşti'
```

Project Realized Expenses:

```text
sum(ak_financial_entries.amount)
where project_id is not null
  and direction = 'Gider'
  and status = 'Gerçekleşti'
```

Project Planned Obligations:

```text
sum(remaining payable obligations)
where project_id matches
  and obligation comes from active non-customer payment plans
   or planned expense financial entries not represented by an active matching payable plan
```

Project Outstanding Receivables:

```text
sum(project-linked customer receivable remaining amount)
where customer payment plan is active
```

Project Outstanding Payables:

```text
sum(project-linked payable obligation remaining amount)
```

Project Net Profit:

```text
project_total_revenue - project_realized_expenses
```

Project Cash Exposure:

```text
outstanding_receivables - outstanding_payables
```

Project Current Cash Position:

```text
project_net_profit + project_cash_exposure
```

Official Project Profit:

```text
official_project_revenue - official_project_expenses
```

Unofficial Project Profit:

```text
unofficial_project_revenue - unofficial_project_expenses
```

Combined Project Profit:

```text
official_project_profit + unofficial_project_profit
```

Official/Unofficial Project Cash Exposure:

```text
project-linked outstanding receivables by account type
- project-linked outstanding payables by account type
```

## Realized vs Planned Treatment

| Source | Profit treatment | Cash pressure treatment |
| --- | --- | --- |
| Realized income entries | Counted in project revenue | Already realized in cash position |
| Realized expense entries | Counted in project expenses | Already realized in cash position |
| Planned customer receivables | Not counted as realized revenue | Counted in outstanding receivables |
| Planned supplier/personnel/general obligations | Not counted as realized expenses | Counted in outstanding payables |
| Cancelled rows | Excluded | Excluded |

Planned obligations now affect project cash exposure and management payment pressure without falsely inflating realized paid expense totals.

## Hosted Evidence After Fix

Authenticated hosted dashboard API returned project cards and drilldowns with the corrected fields:

| Evidence | Value |
| --- | ---: |
| Project cards returned | 6 |
| Project revenue rows returned | 8 |
| Project expense rows returned | 8 |
| Project profit component rows returned | 8 |
| Most expensive project rows | 6 |
| Top profitable project rows | 6 |
| Top loss-making project rows | 1 |

Top visible project after fix:

| Metric | Value |
| --- | ---: |
| total_revenue | 3,741,637 |
| total_expenses | 1,857,613 |
| net_profit | 1,884,024 |
| cash_exposure | 12,043,771 |
| current_cash_position | 13,927,795 |
| official_project_profit | 1,326,169 |
| unofficial_project_profit | 557,855 |

Hosted read-only SQL reconciliation after fix:

| Metric | Value |
| --- | ---: |
| project_realized_revenue | 67,748,995 |
| project_realized_expense | 31,427,269 |
| project_planned_obligations | 5,523,334 |
| official_revenue | 45,420,644 |
| unofficial_revenue | 22,328,351 |
| official_expense | 21,349,832 |
| unofficial_expense | 10,077,437 |
| project-linked expense with zero realized revenue projects | 0 |
| non-cancelled financial rows without project_id | 44 |

Rows without `project_id` are not forced into project profitability. They remain data-quality/overhead review items if the business expects them to belong to a project.

## Leakage Checks

| Check | Result | Notes |
| --- | --- | --- |
| Project with expenses but no revenue | PASS | Hosted count: `0` |
| Project with revenue but missing collection plan | PASS | Outstanding receivables remain separate from realized revenue |
| High planned obligations but low expected collections | PASS | Planned obligations now affect cash exposure and payment pressure |
| Official/unofficial imbalance visibility | PASS | Project card exposes official/unofficial profit and cash exposure fields |
| Realized expenses duplicated through supplier/project surfaces | PASS | Project realized expense uses project-linked realized entries once |
| Personnel cost counted twice | PASS | Project expense uses the project-linked realized entry once, not a separate personnel aggregate |
| Supplier purchase counted as both purchase and expense incorrectly | PASS | Supplier card and project card share source rows but project profit counts only project-linked realized expense once |
| Planned obligation counted as realized paid amount | PASS | Planned obligations are excluded from realized expenses |
| Overdue receivables with continuing payables | PASS | Receivable/payable pressure is visible through cash exposure and forecast surfaces |
| Negative profitability hidden | PASS | Management dashboard returned one loss-making project row |
| Project-linked entries missing from card totals | Fixed | Project cards now use project-linked financial entries |
| No project_id but business-critical rows | REVIEW | 44 non-cancelled financial rows lack project linkage and should remain overhead/data-quality review items |
| Cancelled rows included | PASS | Cancelled financial rows are excluded |

## Surface Reconciliation

| Surface | Result |
| --- | --- |
| Project cards | PASS |
| Project drilldowns | PASS |
| Cashflow Command Center | PASS |
| Cashflow Action Center | PASS |
| Management Dashboard | PASS |
| Net Cash Forecast | PASS |

Project cards, drilldowns, command center project lists, action center project risk list, and management dashboard project lists now use the same project card read model.

## Files Changed

- `public_html/api/admin/dashboard.php`
- `src/lib/apiTypes.ts`
- `src/pages/admin/AdminDashboard.tsx`
- `docs/PHASE_7D_PROJECT_PROFITABILITY_AND_LEAKAGE_AUDIT.md`

Deployed:

- `public_html/api/admin/dashboard.php`
- current `dist/` frontend build assets

Protected files were not modified or uploaded:

- `public_html/api/config.php`
- `public_html/api/config.local.php`
- `.env`
- `.env.local`

## Validation

| Check | Result |
| --- | --- |
| `php -l public_html/api/admin/dashboard.php` | PASS |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS |
| `npm run test` | PASS, 23 tests |
| `npm run finance:parity` | PASS, 15 checks |
| `npm run finance:shadow-test` | PASS |
| Authenticated hosted dashboard API | PASS |
| Authenticated canonical diagnostics endpoint | PASS |
| Hosted PHP admin log review | PASS, no fatal/parse errors or warnings in reviewed tail |
| Dashboard deployed asset labels | PASS |

## Decision

PROFITABILITY_VERIFIED
