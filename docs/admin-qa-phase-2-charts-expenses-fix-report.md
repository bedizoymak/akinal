# Admin QA Phase 2 Charts and Expenses Fix Report

Date: 2026-06-01

QA source: `C:\Users\Ebru\Downloads\Admin syfs.pdf` if available; Phase 2 scope was also followed directly from the requested issue list.

## Problem Summary

Phase 2 focused only on chart and expense consistency:

- Finance charts could show wrong or empty income/expense data.
- Expense records from `ak_expenses` were loaded but not included in finance dashboard calculations.
- Dashboard monthly/recent finance data needed to match MySQL records.
- TRY/USD/EUR values must not be mixed into one chart total.
- Empty charts should still show a real empty state when there is no applicable data.

PDF/export, project/customer forms, and personnel modules were not changed.

## Root Causes

- `AdminFinance.tsx` loaded `ak_expenses` and `ak_payments`, but chart/stat calculations only used `ak_financial_entries`.
- `GET /api/admin/dashboard.php` included ledger entries but did not include legacy payment and expense rows in recent movement or monthly chart aggregates.
- `GET /api/admin/financial-statement.php` returned only `ak_financial_entries`, so project/customer finance screens did not show related `ak_payments` or `ak_expenses`.

## Files Changed

- `public_html/api/admin/dashboard.php`
- `public_html/api/admin/financial-statement.php`
- `src/pages/admin/AdminFinance.tsx`
- `src/components/admin/finance/FinancialStatementPage.tsx`
- `src/lib/apiTypes.ts`

## Fixes Implemented

### Finance Summary Charts

- Normalized `ak_payments` into realized TRY income rows for finance summary calculations.
- Normalized `ak_expenses` into realized TRY expense rows for finance summary calculations.
- Existing `summarizeLedgerFinance` currency filtering remains in place, so USD/EUR ledger entries are not mixed into TRY charts.
- Existing chart empty-state behavior remains: charts with no positive values show an explicit empty state.

### Dashboard Charts and Recent Movements

- Dashboard recent movements now include:
  - `ak_financial_entries`
  - `ak_payments` as realized TRY income
  - `ak_expenses` as realized TRY expense
- Dashboard monthly finance summary now aggregates:
  - realized TRY ledger income/expense
  - payment income from `ak_payments`
  - expense totals from `ak_expenses`
- Dashboard current-month cards now include payment and expense table totals.

### Project/Customer Finance Screens

- Project and customer financial statement endpoints now include related legacy payments and expenses as read-only rows.
- Legacy rows are labeled as managed from their source modules:
  - payments: Tahsilatlar modülünden yönetilir
  - expenses: Giderler modülünden yönetilir
- Edit/delete buttons remain available only for native `ak_financial_entries` rows.

## Currency Handling

- `ak_payments` and `ak_expenses` do not store currency, so they are treated as TRY.
- `ak_financial_entries` keeps its own `currency_tag`.
- Existing chart calculations continue to filter by currency instead of summing TRY/USD/EUR together.

## Validation

- `npm run build` passed.
- PHP lint could not be run locally because `php` is not installed in this environment.

## Known Limitations

- Legacy payment/expense rows shown inside financial statements are read-only from that screen and must be edited from Tahsilatlar/Giderler.
- Because `ak_payments` and `ak_expenses` have no currency field, they are displayed as TRY.
- Reports/export were intentionally not changed in this phase.

## Result

Phase 2 chart and expense fixes are implemented. Finance and dashboard chart calculations now include MySQL payment and expense records while preserving per-currency ledger separation and true empty states.
