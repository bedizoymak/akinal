# Admin QA Phase 6 Personnel Project Label Fix Report

## Problem Summary

Personnel finance records could show a generic unknown project label when the movement did not have a `project_id` or when the referenced project was no longer available in the lookup list.

This was most visible on personnel statement/detail flows where project context is displayed per financial movement.

## Root Cause

The shared financial statement helper treated both cases the same:

- Empty `project_id`.
- Non-empty `project_id` that does not resolve to a project row.

Both fell back to a generic unknown label, which made old records look broken even when they simply had no project relation.

## Files Changed

- `src/lib/financialEntries.ts`
- `docs/admin-qa-phase-6-personnel-project-fix-report.md`

## Personnel Screens Checked

- `src/pages/admin/AdminEmployees.tsx`
- `src/pages/admin/AdminEmployeeFinance.tsx`
- `src/components/admin/finance/FinancialStatementPage.tsx`
- `src/lib/apiClient.ts`
- `public_html/api/admin/employees.php`
- `public_html/api/admin/financial-statement.php`

## Fix

Updated project label resolution for financial statement rows:

- Empty `project_id` now displays `Proje bağlantısı yok`.
- Missing/deleted project references now display `Silinmiş proje`.
- Valid `project_id` values continue to resolve through the existing project lookup returned by `/api/admin/financial-statement.php`.

## API and Database Impact

No API contract changes were required.

No schema changes were made.

Existing behavior preserved:

- `ak_employees` remains unchanged.
- `ak_financial_entries.project_id` remains nullable.
- Old personnel finance records without a project relation continue to load.

## Validation Steps

- Searched personnel list, detail/statement, form, API client, and PHP endpoints for project/personnel mapping.
- Confirmed `/api/admin/financial-statement.php` already returns project lookup data from `ak_projects`.
- Confirmed personnel records are loaded from `ak_employees` and personnel movement rows from `ak_financial_entries`.
- Ran `npm run build` successfully.

## Known Limitations

- If an old movement references a project ID that has been deleted or is absent from `ak_projects`, the UI now labels it as `Silinmiş proje`. The original project title cannot be recovered unless it exists in the database or is denormalized into historical movement rows in a future schema change.

## Result

Personnel finance rows no longer show an unknown project label for empty project relations. Valid project mappings still resolve normally, and old records remain compatible.
