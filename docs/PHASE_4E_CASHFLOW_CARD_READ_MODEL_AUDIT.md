# Phase 4E - Cashflow Card Read Model Audit

**Date:** 2026-06-15  
**Scope:** Audit and alignment plan only  
**Runtime behavior changed:** No  
**Database activity:** None  
**Final decision:** `READY_FOR_PHASE_4F`

## Executive Summary

The project can proceed to Phase 4F, but the current card read models are not yet production-safe as authoritative cashflow reports.

Customer, project, personnel, and supplier/vendor cards have a useful shared UI base in `FinancialStatementPage`, and Phase 4D shadow outputs prove the canonical model can match synthetic legacy scenarios. The live read layer, however, still mixes legacy payments/expenses and manual ledger entries differently across screens. That creates double-count risk, inconsistent paid/remaining logic, and incomplete official/unofficial separation.

Phase 4F should therefore implement a canonical read-model specification and parity harness first. It must not cut over UI reads yet.

## Sources Reviewed

- `docs/PHASE_4A_CANONICAL_SETTLEMENT_PLAN.md`
- `docs/PHASE_4B_CASHFLOW_LOGIC_AUDIT_AND_ROADMAP.md`
- `docs/PHASE_4D_SHADOW_WRITE_REPORT.md`
- `src/components/admin/finance/FinancialStatementPage.tsx`
- `src/lib/finance.ts`
- `src/pages/admin/AdminFinance.tsx`
- `src/pages/admin/AdminDashboard.tsx`
- `src/pages/admin/AdminReports.tsx`
- `public_html/api/admin/dashboard.php`
- `public_html/api/admin/financial-statement.php`
- `public_html/api/admin/finance-summary.php`
- `public_html/api/admin/payment-plans.php`
- `public_html/api/admin/notifications.php`

Canonical/shadow outputs were used for comparison rules only. No production data was queried or changed.

## Current Read Model Map

| Surface | Current sources | Current formula style | Main risk |
| --- | --- | --- | --- |
| Customer card | `ak_financial_entries`, legacy `ak_payments`, `ak_payment_plans` | Ledger movement table plus plan/payment allocation in UI | Manual paid, linked payments, unlinked FIFO, and ledger rows can disagree |
| Project card | `ak_financial_entries`, legacy `ak_payments`, legacy `ak_expenses`, plans | Ledger-style summaries and project-scoped converted legacy rows | Legacy + ledger can double-count project income/expense |
| Personnel card | `ak_financial_entries`, `ak_payment_plans` | Employee-owned ledger and plan rows | No legacy personnel payment table; paid evidence can be manual plan state |
| Supplier/vendor card | `ak_financial_entries`, `ak_payment_plans`, expense-card identity | Supplier modeled through `expense_card_id` | Supplier identity and expense category remain conflated |
| Expense category views | `ak_expenses`, converted ledger rows, ledger category text/codes | Free-form categories plus canonical codes not yet authoritative | Category totals can omit supplier/payable context and account type |
| Finance dashboard | `ak_payments`, `ak_expenses`, `ak_financial_entries`, plans | Aggregated legacy plus ledger totals | Highest double-count risk |
| Reports | Mix of finance helpers and ledger summaries | Screen-specific summaries | Metrics can differ from card totals |

## Card Audit

### Customer Card

What works:

- Plans and payments are scoped by customer and account type.
- Official/unofficial tabs exist.
- Partial and paid states are displayed.
- Due-date and overdue concepts are represented.

Risks:

- `effectivePaidForPlan()` can use manual `paid_amount`, linked payments, or allocated unlinked payments.
- Unlinked FIFO allocation is still a read-model behavior; it is not canonical settlement evidence.
- Ledger entries and legacy payments can both represent the same receipt.
- Customer balance can differ between card, dashboard, reports, and notifications.
- Refund/reversal handling is not yet a first-class read-model metric.

Canonical target:

- Customer balance must be derived from active receivable plans minus active settlements, separated by currency and account type.
- Unallocated receipts must appear separately and never silently settle plans by due date.
- Legacy/manual paid state must be displayed as migration evidence, not final truth.

### Project Card

What works:

- Project financial statements can show customer, personnel, and supplier/expense-card movement types.
- Realized and planned ledger movements are separated.
- Project charts and metric cards exist.

Risks:

- Project profitability currently risks mixing legacy payments/expenses and ledger rows.
- Realized net and forecast completion profit are not consistently separated.
- Remaining receivables/payables are not always settlement-based.
- Project-less company overhead can be omitted or misassigned.
- Foreign currency and official/unofficial values can be visually aggregated without canonical conversion policy.

Canonical target:

- Project card must show:
  - realized income;
  - realized expense;
  - remaining receivables;
  - remaining payables;
  - realized net cash;
  - forecast completion profit.
- Every metric must drill down to the exact canonical rows/settlements that produced it.

### Personnel Card

What works:

- Personnel has a dedicated card route.
- Personnel-owned plans and ledger entries can be displayed.
- Planned and realized employee costs can be represented.

Risks:

- Personnel paid state can come from manual plan status without a posted payment event.
- Purpose/project/account type are not guaranteed complete.
- Personnel payments are not represented in legacy `ak_payments`, so legacy compatibility is asymmetric.
- Overdue logic uses card-local calculations rather than a shared backend read model.

Canonical target:

- Personnel card must show obligation, posted payment, remaining payable, overdue amount, purpose, project, account type, currency, and settlement trail.

### Supplier/Vendor Card

What works:

- Supplier-like cards exist through `ak_expense_cards`.
- Supplier/vendor plans and ledger entries can be shown by `expense_card_id`.
- Material/service cost can be manually represented.

Risks:

- `ak_expense_cards` is both a supplier/vendor-like card and an expense category/card concept.
- Legacy `ak_expenses` has no account type, paid/planned state, supplier identity, or settlement link.
- Current adapters often assume legacy expense is official, TRY, realized, and supplier-less.
- Supplier payable and expense category totals can be conflated.

Canonical target:

- Supplier/vendor read model must distinguish vendor identity from expense category.
- Material/service, project, account type, posted payment, remaining payable, and settlement trail must be separate fields.

### Expense Category Views

What works:

- Expense categories exist in UI constants and legacy expense rows.
- Project and date filters exist in reporting surfaces.

Risks:

- Categories are not normalized to stable canonical category codes everywhere.
- Legacy expenses do not carry official/unofficial account type.
- Expense category totals can double-count when matching ledger entries also exist.
- Government payments, permits, demolition, machine rental, iron, cement, construction stages, and similar categories are not enforced as controlled codes.

Canonical target:

- Category views must use stable `category_code` and `subcategory_code`, with display labels separate from stored values.
- Unknown or legacy-only category/account assumptions must be marked as unresolved until classified.

## Cross-Cutting Risk Matrix

| Check | Current status | Risk |
| --- | --- | --- |
| Planned vs actual | Present but split between plans and ledger statuses | Same event can be forecast and posted in separate models |
| Paid vs unpaid | Present but multi-authority | Manual paid, linked payments, FIFO, and settlements conflict |
| Overdue | Present | Partial overdue can be handled differently by card/dashboard/notifications |
| Official vs unofficial | Present for plans/payments/ledger | Missing for legacy expenses |
| Project profitability | Present | Realized net and forecast profit are not consistently separated |
| Customer balance | Present | Not settlement-authoritative |
| Personnel cost | Partially present | Missing canonical paid evidence in legacy paths |
| Supplier/material cost | Partially present | Supplier identity and category are conflated |
| Duplicate/double-count | Known and detectable via shadow harness | Still possible in live aggregate reads |

## Required Unified Read Model

Before UI cutover, define one backend-owned read model per card:

1. `cashflow_card_owner`: customer, project, employee, supplier/vendor, category.
2. `as_of_date`: one explicit date used for overdue and remaining calculations.
3. `currency`: no cross-currency summing without approved base conversion.
4. `account_type`: `resmi` and `gayri_resmi` must remain separate buckets.
5. `realized_income`: posted income entries, excluding reversed/canceled.
6. `realized_expense`: posted expense entries, excluding reversed/canceled.
7. `planned_receivable`: active income plans.
8. `planned_payable`: active expense plans.
9. `settled_amount`: active settlements only.
10. `remaining_receivable`: active receivable plans minus settlements.
11. `remaining_payable`: active payable plans minus settlements.
12. `overdue_amount`: remaining active plans with due date before `as_of_date`.
13. `unallocated_posted_amount`: posted entries not settled to a plan.
14. `duplicate_risk_count`: legacy and canonical rows likely representing the same business event.
15. `unresolved_legacy_count`: rows missing account, owner, category, project, or currency confidence.

## Phase 4F Acceptance Criteria

Phase 4F should be a read-model parity/spec phase, not cutover.

Required:

- Create a canonical card read-model contract document or fixtures.
- Add test fixtures for customer, project, personnel, supplier, category, official, unofficial, partial, overdue, reversal, and duplicate-risk cases.
- Compare current read outputs against canonical/shadow expected outputs.
- Produce mismatch reports by card and metric.
- Keep live UI unchanged.
- Keep canonical feature flag disabled.
- Do not migrate, alter schema, or write production data.

Pass gates:

- Every metric has a named owner and formula.
- Every formula identifies included and excluded statuses.
- Official/unofficial buckets never merge.
- Planned, posted, settled, remaining, overdue, reversed, canceled, archived, and unallocated states are defined.
- Duplicate/double-count risk is reported, not hidden.
- Legacy expense account type and supplier uncertainty remains explicit.
- Project profitability separates realized cash from forecast completion profit.

## Blockers For Future Cutover

These do not block Phase 4F, but they block read cutover:

1. No production-safe canonical read endpoint exists yet.
2. Live aggregates still combine legacy and ledger sources.
3. Legacy expenses lack account type and supplier identity.
4. Supplier/vendor master data is not distinct from expense cards.
5. Runtime DDL remains in several request paths.
6. Hosting-side isolated fixture tests have not yet been run.
7. Source identity uniqueness is not yet schema-enforced.

## Final Decision

`READY_FOR_PHASE_4F`

The read-model audit is complete enough to proceed to Phase 4F: a canonical card read-model parity/specification phase. This decision does not authorize read cutover, write cutover, migration, schema changes, production data writes, or production activation of canonical settlement.
