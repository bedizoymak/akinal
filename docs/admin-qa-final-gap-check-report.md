# Admin QA Final Gap Check Report

Date: 2026-06-01

QA source: `C:\Users\Ebru\Downloads\Admin syfs.pdf`

Note: The PDF file is present locally, but `pdftotext` is not installed in this environment, so this pass used the available QA scope, prior Phase 1-6 reports, and direct repository inspection.

## Executive Summary

Most Phase 1-6 implementation items are now represented in the codebase, but two confirmed gaps remain:

1. The new/edit project form still exposes both `Konum` and `İl/İlçe`.
2. The “PDF Olarak İndir” action still opens the browser print dialog instead of generating and downloading a real PDF file.

No code was changed in this pass.

## Remaining Confirmed Gaps

### 1. Project Form Location UX

Status: **Still partially unresolved**

Current implementation:

- `src/pages/admin/AdminProjectEdit.tsx` still renders a required manual `Konum *` input.
- The same form also renders searchable `İl` and `İlçe` controls.
- `applyLocation()` auto-generates `location` only when `Konum` is empty or still matches the previous generated value.
- `save()` still blocks when `data.location` is empty.

Current code references:

- `src/pages/admin/AdminProjectEdit.tsx`
  - `shouldSyncLocation()`
  - `applyLocation()`
  - `if (!data.location.trim()) ... "Konum zorunludur."`
  - `<Label>Konum *</Label>`

Recommendation:

- Make `Konum` auto-generated from `İlçe, İl` and remove it from the primary editable UI, or show it as a read-only/generated preview.
- Keep a small advanced/manual override only if legacy/custom public display names are needed.
- The safest behavior is:
  - If district and city exist: `location = "{district}, {city}"`
  - If only city exists: `location = "{city}"`
  - If legacy `location` exists without city/district: preserve it for existing projects.

Reason:

- Having both `Konum` and `İl/İlçe` visible makes the source of truth unclear and can create mismatched public project locations.

### 2. PDF Export / Download

Status: **Still unresolved for real PDF download**

Current implementation:

- `src/pages/admin/AdminReports.tsx` has a button labeled `PDF Olarak İndir`.
- That button calls `printCurrentReport(title)`.
- `src/lib/finance.ts` implements `printCurrentReport()` with `window.print()`.
- The Phase 3 report also documents this as a known limitation.

Current code references:

- `src/pages/admin/AdminReports.tsx`
  - `PDF Olarak İndir` button calls `printCurrentReport(title)`
  - `Yazdır` button also calls `printCurrentReport(title)`
- `src/lib/finance.ts`
  - `printCurrentReport()` sets `document.title`, calls `window.print()`, then restores the title.

Recommendation:

- Rename the current PDF button to `PDF / Yazdır` if keeping browser print.
- Or implement true PDF generation with a dedicated client or server PDF generator.
- A real fix should produce a downloaded `.pdf` file without depending on the browser print dialog.

Reason:

- The current behavior improves the default print-to-PDF filename, but it is not a real direct PDF download.

## Phase 1-6 Re-Test Summary

### Phase 1: Finance Dashboard Issues

Status: **No new code gap found in this pass**

Observed current implementation:

- Dashboard endpoint combines ledger, payments, expenses, overdue plans, recent movements, and monthly financials in `public_html/api/admin/dashboard.php`.
- Dashboard UI renders overdue receivables, recent movements, and monthly finance chart from MySQL-backed API data in `src/pages/admin/AdminDashboard.tsx`.
- Multi-currency project financial cards use per-currency totals in `src/components/admin/finance/FinancialStatementPage.tsx`.

Residual risk:

- This pass did not connect to production data, so numeric correctness should still be verified with live records.

### Phase 2: Charts and Expenses

Status: **No new code gap found in this pass**

Observed current implementation:

- Dashboard monthly chart consumes `monthly_financials`.
- Finance and report views normalize MySQL `ak_payments`, `ak_expenses`, and `ak_financial_entries`.
- Empty chart states are present in financial statement chart cards.
- Expenses are loaded from `/api/admin/expenses.php`.

Residual risk:

- Legacy payments/expenses are still treated as TRY because those legacy tables do not carry currency fields.

### Phase 3: PDF / Export

Status: **Partially fixed, one confirmed remaining gap**

Fixed:

- CSV export uses UTF-8 BOM and dated filenames.
- MySQL payment/expense data is included in report calculations.
- Empty CSV exports now produce a useful file.

Remaining:

- Real PDF download is not implemented. The PDF button still opens the print dialog.

### Phase 4: Project Location UX

Status: **Partially fixed, one confirmed remaining gap**

Fixed:

- Province and district selectors are searchable.
- Known invalid province/district combinations are blocked.
- Existing legacy city/district values are preserved.

Remaining:

- Manual `Konum *` still appears next to `İl/İlçe`.
- `Konum` remains required and can diverge from city/district.

### Phase 5: Quick Create UX

Status: **No new code gap found in this pass**

Observed current implementation:

- Customer quick-create component exists and is used in:
  - Collections
  - Payment plans
  - Expenses
  - Project financial statement customer selector
- Expense category quick-create exists and is used in expenses.
- Newly created values are selected immediately.

Known limitation:

- New expense categories become persistent after an expense is saved with that category because categories remain plain `ak_expenses.category` strings.

### Phase 6: Personnel Project Labels

Status: **No new code gap found in this pass**

Observed current implementation:

- Empty `project_id` now resolves to `Proje bağlantısı yok`.
- Missing/deleted project references resolve to `Silinmiş proje`.
- Valid project references still resolve through the project lookup map.

Known limitation:

- Deleted project names cannot be recovered unless the old project still exists or movement rows later store denormalized project titles.

## Recommended Next Fix Order

1. **Project location source of truth**
   - Make `location` generated/read-only from `city` and `district`, or remove it from the normal form UI.
   - Preserve legacy `location` values for old projects.

2. **True PDF download**
   - Decide between client-side PDF generation and server-side rendering.
   - Replace the misleading `PDF Olarak İndir` print behavior with a real `.pdf` download, or rename the current button to reflect print behavior.

3. **Live data verification**
   - Re-test dashboard totals, monthly chart, recent movements, personnel finance rows, and report exports against the production MySQL dataset.

## Conclusion

The current codebase is close, but not fully QA-complete against the highlighted final concerns. The two remaining confirmed issues are both UX/behavior gaps rather than Supabase/MySQL migration blockers:

- Project location field ambiguity.
- PDF export still using print dialog.
