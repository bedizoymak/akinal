# Phase 4F - Metric Formula Catalog

**Date:** 2026-06-15  
**Scope:** Authoritative formulas for parity and future read-model implementation  
**Runtime behavior changed:** No  
**Database activity:** None

## Shared Definitions

| Symbol | Definition |
| --- | --- |
| `ACTIVE_PLAN(scope)` | Payment plan in scope, not canceled, not legacy `İptal`, not archived. |
| `ACTIVE_SETTLEMENT(plan)` | Settlement for a plan where `reversed_at IS NULL`. |
| `SETTLED(plan)` | Sum `allocated_amount` from `ACTIVE_SETTLEMENT(plan)`. |
| `REMAINING(plan)` | `max(0, plan.amount - SETTLED(plan))`. |
| `POSTED_ENTRY(scope)` | Financial entry in scope with canonical `posted` or legacy `Gerçekleşti`, not canceled, not reversed, not archived, and not duplicate-risk. |
| `FORECAST_ENTRY(scope)` | Financial entry in scope with canonical `forecast` or legacy `Planlandı`, not canceled, not archived, and not represented by an active plan. |
| `REVERSAL_EFFECT(entry)` | The active reversal/refund/correction amount linked to the original entry. |
| `DUPLICATE_RISK(row)` | Row classified as possible double-count with another legacy/canonical event. |
| `UNRESOLVED(row)` | Row lacking required owner, project, account type, currency, category, or source identity confidence. |

All formulas are computed per `currency` and `account_type` unless explicitly stated otherwise.

## Universal Rules Per Metric

| Rule Type | Contract |
| --- | --- |
| Included statuses | Active plans, active settlements, posted entries for realized metrics, forecast entries only for planned metrics without a plan. |
| Excluded statuses | `draft`, `canceled`, legacy `İptal`, `reversed`, `archived`, hard-deleted rows without audit evidence, duplicate-risk rows, unresolved rows. |
| Currency rules | Original-currency buckets are authoritative. Base totals require validated `base_amount` and `exchange_rate` when applicable. |
| Reversal rules | Reversed originals and reversed settlements are excluded from active totals. Reversal entries are netting evidence, not new business volume. |
| Archive rules | Archived rows are excluded from active totals and included only in explicit historical/audit mode. |
| Duplicate rules | Duplicate-risk rows are excluded and reported in parity backlog until classified. |

## Customer Card Metrics

| Metric | Formula | Included Statuses | Excluded Statuses | Currency | Reversal | Archive | Duplicate |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Total contracted amount | `sum(ACTIVE_PLAN(customer, receivable).contract_amount or amount)` | Active customer receivable plans | Canceled, `İptal`, archived | Per currency | Reversed settlements do not reduce contract amount; canceled corrections require replacement plan | Exclude archived | Exclude duplicate-risk plans |
| Total planned receivable | `sum(ACTIVE_PLAN(customer, receivable).amount) + sum(FORECAST_ENTRY(customer, income) not represented by plan)` | Active receivable plans, non-duplicate forecast income without plan | Posted-only events, canceled, reversed, archived | Per currency | Forecast reversal/cancel removes from total | Exclude archived | Exclude duplicate forecasts |
| Total realized collection | `sum(POSTED_ENTRY(customer_receipt)) - sum(active customer refunds/reversal effects)` | Posted customer receipt entries | Forecast, draft, canceled, reversed originals, archived | Per currency | Net active reversal/refund effects | Exclude archived | Exclude duplicate legacy/canonical receipts |
| Remaining receivable | `sum(REMAINING(plan)) for ACTIVE_PLAN(customer, receivable)` | Active customer receivable plans and active settlements | Canceled, `İptal`, archived, reversed settlements | Per currency | Reversed settlements increase remaining amount back | Exclude archived | Exclude duplicate plans/settlements |
| Overdue receivable | `sum(REMAINING(plan)) where plan.due_date < as_of_date` | Active receivable plans with positive remaining amount | Paid, canceled, archived | Per currency | Reversed settlements may make a plan overdue again | Exclude archived | Exclude duplicate plans |
| Official receivable | Customer receivable formulas where `account_type = resmi` | Active official customer plans/settlements | Unofficial and excluded statuses | Per currency | Same as receivable | Exclude archived | Exclude duplicate-risk |
| Unofficial receivable | Customer receivable formulas where `account_type = gayri_resmi` | Active unofficial customer plans/settlements | Official and excluded statuses | Per currency | Same as receivable | Exclude archived | Exclude duplicate-risk |
| Unallocated collections | `sum(max(0, posted_receipt.amount - active settlements for receipt))` | Posted customer receipts with unapplied amount | Forecast, canceled, reversed, archived | Per currency | Reversed settlements reopen availability; reversed entries excluded | Exclude archived | Exclude duplicate receipts |

## Project Card Metrics

| Metric | Formula | Included Statuses | Excluded Statuses | Currency | Reversal | Archive | Duplicate |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Realized income | `sum(POSTED_ENTRY(project, income)) - refunds/reversal effects` | Posted income/customer receipt entries scoped to project | Forecast, draft, canceled, reversed originals, archived | Per currency | Net active reversals/refunds | Exclude archived | Exclude duplicate income |
| Realized expense | `sum(POSTED_ENTRY(project, expense/payment)) - expense refund effects` | Posted personnel, supplier, general, government, permit, payroll, subcontractor, material, utility, logistics, office expenses | Forecast, draft, canceled, reversed originals, archived | Per currency | Net active reversals/refunds | Exclude archived | Exclude duplicate expense |
| Remaining receivable | `sum(REMAINING(plan)) for ACTIVE_PLAN(project, receivable)` | Active project customer receivable plans | Canceled, `İptal`, archived, reversed settlements | Per currency | Reversed settlements restore remaining | Exclude archived | Exclude duplicate plans |
| Remaining payable | `sum(REMAINING(plan)) for ACTIVE_PLAN(project, payable)` | Active project personnel/supplier/expense payable plans | Canceled, `İptal`, archived, reversed settlements | Per currency | Reversed settlements restore remaining | Exclude archived | Exclude duplicate plans |
| Realized net cash | `realized income - realized expense` | Realized income and expense inputs | Any excluded input row | Per currency | Uses netted realized inputs | Exclude archived inputs | Exclude duplicate inputs |
| Forecast completion profit | `realized income + remaining receivable - realized expense - remaining payable` | Active realized and remaining inputs | Any excluded input row | Per currency | Uses netted realized/remaining inputs | Exclude archived inputs | Exclude duplicate inputs |
| Official profitability | Project profitability formulas where `account_type = resmi` | Official active inputs | Unofficial and excluded inputs | Per currency | Same as project formulas | Exclude archived | Exclude duplicate-risk |
| Unofficial profitability | Project profitability formulas where `account_type = gayri_resmi` | Unofficial active inputs | Official and excluded inputs | Per currency | Same as project formulas | Exclude archived | Exclude duplicate-risk |

## Personnel Card Metrics

| Metric | Formula | Included Statuses | Excluded Statuses | Currency | Reversal | Archive | Duplicate |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Planned payroll | `sum(ACTIVE_PLAN(employee, payroll/payable).amount) + eligible forecast payroll entries without plan` | Active payroll/personnel payable plans, unmatched payroll forecasts | Posted-only events, canceled, `İptal`, archived | Per currency | Canceled/reversed forecast removed | Exclude archived | Exclude duplicate payroll obligations |
| Realized payroll | `sum(POSTED_ENTRY(personnel_payment)) - payroll reversal/refund effects` | Posted personnel payment entries | Forecast, draft, canceled, reversed originals, archived | Per currency | Net active reversals/refunds | Exclude archived | Exclude duplicate payments |
| Remaining payable | `sum(REMAINING(plan)) for ACTIVE_PLAN(employee, payable)` | Active personnel payable plans and active settlements | Canceled, `İptal`, archived, reversed settlements | Per currency | Reversed settlements restore payable | Exclude archived | Exclude duplicate plans |
| Overdue payable | `sum(REMAINING(plan)) where plan.due_date < as_of_date` | Active payable plans with positive remaining | Paid, canceled, archived | Per currency | Reversed settlements can make overdue again | Exclude archived | Exclude duplicate plans |
| Project allocation | Group planned, realized, remaining, overdue by `project_id`; missing project goes to unassigned | Active inputs for each metric | Excluded inputs | Per currency | Same as component metrics | Exclude archived | Exclude duplicate inputs |
| Official/unofficial split | Personnel formulas filtered by `account_type` | Active inputs in selected account type | Opposite account type and excluded statuses | Per currency | Same as component metrics | Exclude archived | Exclude duplicate inputs |

## Supplier/Vendor Card Metrics

| Metric | Formula | Included Statuses | Excluded Statuses | Currency | Reversal | Archive | Duplicate |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Contracted payable | `sum(ACTIVE_PLAN(supplier, payable).contract_amount or amount)` | Active supplier/vendor payable plans | Canceled, `İptal`, archived | Per currency | Reversed settlements do not reduce contract amount | Exclude archived | Exclude duplicate obligations |
| Realized payment | `sum(POSTED_ENTRY(supplier_payment/material/service)) - supplier refund/reversal effects` | Posted supplier/material/service payments | Forecast, draft, canceled, reversed originals, archived | Per currency | Net active reversals/refunds | Exclude archived | Exclude duplicate payments |
| Remaining payable | `sum(REMAINING(plan)) for ACTIVE_PLAN(supplier, payable)` | Active supplier/vendor payable plans and active settlements | Canceled, `İptal`, archived, reversed settlements | Per currency | Reversed settlements restore payable | Exclude archived | Exclude duplicate plans |
| Overdue payable | `sum(REMAINING(plan)) where plan.due_date < as_of_date` | Active payable plans with positive remaining | Paid, canceled, archived | Per currency | Reversed settlements can make overdue again | Exclude archived | Exclude duplicate plans |
| Material/service breakdown | Group contracted, realized, remaining, overdue by `category_code` and `subcategory_code` | Active supplier inputs with category confidence | Unmapped/unresolved category rows from authoritative totals | Per currency | Same as component metrics | Exclude archived | Exclude duplicate inputs |
| Project allocation | Group supplier metrics by `project_id`; missing project goes to unassigned | Active supplier inputs | Excluded inputs | Per currency | Same as component metrics | Exclude archived | Exclude duplicate inputs |
| Official/unofficial split | Supplier formulas filtered by `account_type` | Active inputs in selected account type | Opposite account type and excluded statuses | Per currency | Same as component metrics | Exclude archived | Exclude duplicate inputs |

## Category Metrics

| Metric | Formula | Included Statuses | Excluded Statuses | Currency | Reversal | Archive | Duplicate |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Planned category cost | `sum(ACTIVE_PLAN(payable) where category_code = code)` | Active payable plans in category | Canceled, `İptal`, archived | Per currency/account type | Settlement reversal does not change planned cost | Exclude archived | Exclude duplicate plans |
| Realized category cost | `sum(POSTED_ENTRY(expense/payment) where category_code = code) - refunds/reversals` | Posted expense/payment entries in category | Forecast, draft, canceled, reversed originals, archived | Per currency/account type | Net active reversals/refunds | Exclude archived | Exclude duplicate expenses |
| Remaining category payable | `sum(REMAINING(plan)) where category_code = code` | Active payable plans and active settlements | Canceled, `İptal`, archived, reversed settlements | Per currency/account type | Reversed settlements restore remaining | Exclude archived | Exclude duplicate inputs |
| Overdue category payable | `sum(REMAINING(plan)) where due_date < as_of_date and category_code = code` | Active payable plans with positive remaining | Paid, canceled, archived | Per currency/account type | Reversed settlements can make overdue again | Exclude archived | Exclude duplicate inputs |

Required category codes:

`demolition`, `excavation`, `machine_rental`, `iron`, `cement`, `concrete`, `construction_stage`, `permit`, `government_fee`, `payroll`, `subcontractor`, `supplier_material`, `logistics`, `utility`, `office`, `other`

## Derived Plan State

| State | Formula |
| --- | --- |
| `paid` | `SETTLED(plan) >= plan.amount` within currency precision. |
| `partial` | `SETTLED(plan) > 0` and `< plan.amount`. |
| `overdue` | `REMAINING(plan) > 0` and `plan.due_date < as_of_date`. |
| `pending` | `SETTLED(plan) = 0` and not overdue. |
| `canceled` | Plan is canceled, legacy `İptal`, or archived. |

Manual `paid_amount` and legacy status labels are compatibility evidence only. They do not override active settlements.

## Parity Output Requirements

Each parity comparison must report:

- metric name
- card type and owner ID
- project ID or unassigned marker
- account type
- currency
- canonical amount
- legacy/current amount
- delta
- included row count
- excluded duplicate-risk count
- unresolved legacy count
- status/currency/account/project mismatch classifications

