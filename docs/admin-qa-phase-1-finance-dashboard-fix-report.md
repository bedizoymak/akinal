# Admin QA Phase 1 Finance Dashboard Fix Report

Date: 2026-06-01

QA source: `C:\Users\Ebru\Downloads\Admin syfs.pdf`

## Problem Summary

Phase 1 addressed the finance/dashboard issues called out from the Admin QA PDF:

- Dashboard overdue receivables showed `0` while payment plan details had records.
- Dashboard recent financial movements rendered empty despite existing finance records.
- Monthly finance summary rendered empty despite financial entries.
- Project extract status displayed the raw stored value and could look out of sync with the admin status labels.
- Project financial total cards could overflow with large TRY values and needed clearer per-currency handling.

Reports/export, project creation UX, customer creation UX, and chart behavior were left untouched.

## Root Causes

- `AdminDashboard.tsx` hardcoded `overduePlans`, `recentMovements`, and `monthlyFinancials` to empty arrays/zero values after loading the dashboard API.
- `/api/admin/dashboard.php` did not return payment-plan follow-up data, recent `ak_financial_entries`, or monthly finance aggregates.
- Dashboard totals still relied on legacy `ak_payments` / `ak_expenses` only, even after the finance ledger migration introduced `ak_financial_entries`.
- Project statement status used the raw `project_status` value instead of the same display-label mapping used elsewhere in admin project UI.
- `AdminMetricCard` always routed values through the single-line auto-fit wrapper, which was not suitable for multi-line per-currency totals.

## Files Changed

- `public_html/api/admin/dashboard.php`
- `src/pages/admin/AdminDashboard.tsx`
- `src/lib/apiTypes.ts`
- `src/components/admin/AdminPage.tsx`
- `src/components/admin/finance/FinancialStatementPage.tsx`

## Fixes Implemented

### Dashboard Overdue Receivables

- Added MySQL queries for overdue and upcoming `ak_payment_plans`.
- Calculates remaining amount as `plan amount - paid amount`.
- Excludes paid/canceled plans.
- Dashboard now uses returned `overdue_plans`, `upcoming_plans`, `overdue_collections`, and `expected_payments`.

### Recent Financial Movements

- Added latest `ak_financial_entries` data to `GET /api/admin/dashboard.php`.
- Dashboard now renders the latest finance movements with title, project, date, direction, group, and currency.
- Movement amounts now use their own currency instead of forcing TRY.

### Monthly Finance Summary

- Added last-six-month TRY aggregates from `ak_financial_entries`.
- Dashboard now maps API `month_key` rows into its existing chart structure instead of rendering a forced empty state.
- Chart implementation itself was not changed in this phase.

### Project Extract Status

- Project extract now displays `displayLabel(project.project_status)` so the status matches admin project list/edit labeling.

### Multi-Currency Project Totals

- Project statement summary cards continue to calculate totals per currency using existing ledger helpers.
- Currency totals are rendered as separate wrapped lines, preventing TRY/USD/EUR from being merged into a single TRY net value.
- Metric cards now handle complex React values without forcing them into the single-line auto-fit path.

## Endpoint Changes

`GET /api/admin/dashboard.php` now additionally returns:

- `summary.planned_income`
- `summary.month_income`
- `summary.month_expenses`
- `summary.month_net`
- `summary.overdue_collections`
- `summary.expected_payments`
- `summary.financial_entry_count`
- `overdue_plans`
- `upcoming_plans`
- `recent_movements`
- `monthly_financials`

## Validation

- `npm run build` passed.
- PHP syntax lint could not be run locally because `php` is not installed in this environment.
- PDF file presence was verified at `C:\Users\Ebru\Downloads\Admin syfs.pdf`; no local PDF text extraction tool was available.

## Known Limitations

- The dashboard monthly chart remains TRY-focused to avoid silently mixing USD/EUR into a TRY graph.
- Reports/export, creation UX, and charts were intentionally not modified per Phase 1 scope.

## Result

Phase 1 finance/dashboard QA fixes are implemented. The dashboard now reads overdue/payment-plan details and ledger-based financial movement data from MySQL, while project extract financial cards display multi-currency totals without overflowing or mixing currencies.
