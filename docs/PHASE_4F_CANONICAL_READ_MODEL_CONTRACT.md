# Phase 4F - Canonical Read Model Contract

**Date:** 2026-06-15  
**Scope:** Specification and parity only  
**Runtime behavior changed:** No  
**Database activity:** None  
**Final decision:** `READY_FOR_PHASE_4G`

## Purpose

Cashflow reports must use one financial mathematics contract across customer, project, personnel, supplier/vendor, category, dashboard, report, and export surfaces.

This document defines the authoritative read-model rules. It does not authorize cutover, migrations, schema changes, production writes, UI behavior changes, or production activation of canonical settlement.

## Source Hierarchy

1. Canonical payment plans define obligations, due dates, account type, currency, owner, project, and planned state.
2. Canonical financial entries define posted or forecast financial events.
3. Canonical settlements define allocation between an obligation and a posted event.
4. Legacy payments, expenses, and manual ledger rows are parity/audit evidence until reconciled.
5. A legacy row and a canonical row that represent the same business event must never both contribute to an authoritative metric.

## Global Dimensions

Every metric is computed by these dimensions before display:

| Dimension | Rule |
| --- | --- |
| `as_of_date` | Required for overdue, remaining, and aging metrics. Use one server-side date per response. |
| `currency` | Compute in original currency buckets first. Do not sum TRY, USD, and EUR together unless an approved base-currency metric explicitly uses validated exchange data. |
| `account_type` | `resmi` and `gayri_resmi` are separate buckets. They must not settle, aggregate, or net each other. |
| `owner` | Customer, project, employee/personnel, supplier/vendor, and category scopes must be explicit. |
| `project_id` | Project attribution must come from the obligation or event under the metric scope. Missing project rows stay in an unassigned bucket. |
| `category_code` | Use controlled canonical category codes for expense/category metrics. Free-form labels are display-only. |

## Status Contract

| Object | Included | Excluded |
| --- | --- | --- |
| Realized entries | `posted`, legacy `Gerçekleşti` only when not duplicated by canonical evidence | `draft`, `forecast`, `Planlandı`, `canceled`, `İptal`, `reversed`, `archived` |
| Forecast entries | `forecast`, legacy `Planlandı` only when no active plan exists for the same obligation | `posted`, `Gerçekleşti`, `draft`, `canceled`, `İptal`, `reversed`, `archived` |
| Plans | Active non-canceled, non-archived plans | `canceled`, legacy `İptal`, archived plans |
| Settlements | Rows with `reversed_at IS NULL` | Reversed settlements |
| Reversal entries | Used only to offset or explain the original event | Never counted as new income or new expense by itself |
| Archived records | Excluded from active totals, retained for audit/history | Active card balances, overdue queues, payable/receivable queues |

## Reversal Contract

- Posted financial entries are immutable for accounting purposes.
- Corrections use a reversal entry linked to the original entry.
- The original reversed entry is excluded from active realized totals after reversal.
- Reversed settlement rows are excluded from settled, paid, remaining, and overdue formulas.
- Reversal reports must preserve both original and reversal rows for audit drill-down.

## Duplicate Contract

A business event is duplicate-risk when two or more rows share enough identity to represent the same receipt, payment, expense, payroll, or settlement. Identity signals include:

- `business_transaction_id`
- `source_type + source_id`
- same owner, project, amount, currency, account type, direction, event type, and transaction date
- a legacy row and canonical row linked through migration or shadow metadata

Duplicate-risk rows are excluded from authoritative totals until classified. They must appear in parity reports as `duplicate/double-count risk`.

## Currency Contract

- Authoritative card totals are per currency.
- Base TRY totals are allowed only when each contributing row has validated `base_amount` and, for foreign currency, a positive `exchange_rate`.
- If any row in a metric scope lacks currency confidence, that row is excluded from the authoritative metric and reported as unresolved parity debt.
- Settlements require exact currency match between plan, entry, and settlement.

## Archive And Deletion Contract

- Hard-deleted legacy records cannot be used as live financial truth. They may only appear through existing audit evidence if available.
- Archived plans, entries, owners, projects, suppliers, or categories do not contribute to active balances.
- Historical cards may include archived entities only when the report explicitly requests historical/audit mode.
- Archive state must not erase financial drill-down identity.

## Customer Card Contract

Customer card metrics are scoped by customer, account type, currency, and optional project.

| Metric | Formula |
| --- | --- |
| Total contracted amount | Sum active customer receivable contract/plan amounts approved as customer obligations. Exclude canceled/archived and duplicate-risk rows. |
| Total planned receivable | Sum active customer receivable plans by due date. Forecast entries count only if no active plan represents the same obligation. |
| Total realized collection | Sum active posted customer receipt entries, minus active customer refund/reversal effects, excluding unclassified duplicate legacy rows. |
| Remaining receivable | Sum `max(0, plan.amount - active settlements for the plan)` for active customer receivable plans. |
| Overdue receivable | Sum remaining receivable for active plans where `due_date < as_of_date`. |
| Official receivable | Same receivable formulas filtered to `account_type = resmi`. |
| Unofficial receivable | Same receivable formulas filtered to `account_type = gayri_resmi`. |
| Unallocated collections | Sum active posted customer receipt entries where available posted amount is not fully settled to active plans. |

Customer collections must never be silently allocated by FIFO. Allocation must be settlement-backed.

## Project Card Contract

Project card metrics are scoped by project, account type, currency, category, and counterparty as needed.

| Metric | Formula |
| --- | --- |
| Realized income | Posted income entries for the project, including customer receipts allocated or directly attributed to the project, excluding reversals and duplicates. |
| Realized expense | Posted expense/payment entries for the project, including personnel, supplier, subcontractor, government, permit, utility, logistics, office, and other costs. |
| Remaining receivable | Active project-scoped customer receivable plans minus active settlements. |
| Remaining payable | Active project-scoped personnel/supplier/expense payable plans minus active settlements. |
| Realized net cash | `realized income - realized expense`. |
| Forecast completion profit | `realized income + remaining receivable - realized expense - remaining payable`. |
| Official profitability | Same formulas filtered to `account_type = resmi`. |
| Unofficial profitability | Same formulas filtered to `account_type = gayri_resmi`. |

Realized net cash and forecast completion profit are separate metrics. They must not be merged under one profitability label.

## Personnel Card Contract

Personnel card metrics are scoped by employee/personnel owner, project, account type, currency, and purpose/category.

| Metric | Formula |
| --- | --- |
| Planned payroll | Sum active payroll/personnel payable plans. |
| Realized payroll | Sum active posted personnel payment entries, net of reversals/refunds. |
| Remaining payable | Sum `max(0, plan.amount - active settlements for the plan)` for active payroll/personnel payable plans. |
| Overdue payable | Sum remaining payable where `due_date < as_of_date`. |
| Project allocation | Break planned, realized, remaining, and overdue payroll by project, with unassigned project rows shown separately. |
| Official/unofficial split | Compute every personnel metric separately for `resmi` and `gayri_resmi`. |

Manual paid state is not authoritative unless backed by an active settlement.

## Supplier/Vendor Card Contract

Supplier/vendor card metrics are scoped by supplier/vendor owner, material/service category, project, account type, and currency.

| Metric | Formula |
| --- | --- |
| Contracted payable | Sum active supplier/vendor payable contract or plan amounts. |
| Realized payment | Sum active posted supplier/material/service payment entries, net of reversals/refunds. |
| Remaining payable | Sum `max(0, plan.amount - active settlements for the plan)` for active supplier/vendor payable plans. |
| Overdue payable | Sum remaining payable where `due_date < as_of_date`. |
| Material/service breakdown | Group contracted, realized, remaining, and overdue metrics by canonical category and subcategory. |
| Project allocation | Group supplier/vendor metrics by project, with unassigned project rows shown separately. |
| Official/unofficial split | Compute every supplier/vendor metric separately for `resmi` and `gayri_resmi`. |

Supplier/vendor identity and expense category are separate concepts. A category card is not a supplier master.

## Category Model Contract

Required canonical category codes:

| Code | Meaning |
| --- | --- |
| `demolition` | Demolition and dismantling |
| `excavation` | Excavation and earthworks |
| `machine_rental` | Machine and equipment rental |
| `iron` | Iron/rebar/steel material |
| `cement` | Cement material |
| `concrete` | Concrete material or concrete delivery |
| `construction_stage` | Stage-based construction labor/material package |
| `permit` | Permit and license expenses |
| `government_fee` | Tax, municipality, title deed, SGK, and other government payments |
| `payroll` | Personnel payroll and employee payments |
| `subcontractor` | Subcontractor services |
| `supplier_material` | Supplier material purchases not covered by a more specific code |
| `logistics` | Transport, freight, delivery, and site logistics |
| `utility` | Electricity, water, natural gas, internet, site utility expenses |
| `office` | Office and administrative expenses |
| `other` | Explicitly reviewed fallback category |

Category metrics must expose unresolved legacy/free-form categories separately until mapped.

## Phase 4G Readiness

Phase 4F authorizes Phase 4G to build parity fixtures and read-model comparison code only. It does not authorize UI cutover, production data writes, schema changes, migrations, production canonical activation, or direct production DB tests outside the hosting-side SQL rule.

## Final Decision

`READY_FOR_PHASE_4G`

