# Admin QA Final PDF Download Gap Fix Report

Date: 2026-06-01

## Problem

The admin reports button labeled `PDF Olarak İndir` used `window.print()` through `printCurrentReport()`.

That opened the browser print dialog instead of downloading a real PDF file directly.

## Scope

Fixed final QA gap 2 only:

- Admin report PDF download behavior.
- CSV export remains intact.
- Existing print behavior remains available through the separate `Yazdır` button.

No other QA phases were changed.

## Files Changed

- `package.json`
- `package-lock.json`
- `src/lib/finance.ts`
- `src/pages/admin/AdminReports.tsx`
- `docs/admin-qa-final-pdf-download-gap-fix-report.md`

## Implementation

Added `pdfmake` with bundled Roboto fonts for browser-side PDF generation.

Why:

- Roboto supports Turkish characters such as `İ`, `ı`, `ş`, `ğ`, `ö`, `ü`, and `ç`.
- The app can generate a real `.pdf` download without relying on the print dialog.
- The PDF dependency is loaded with dynamic imports only when the admin clicks `PDF Olarak İndir`.

## Behavior After Fix

### PDF Olarak İndir

- Generates a direct `.pdf` file download.
- Uses a dated readable filename, for example:
  - `proje-finans-raporu-2026-06-01.pdf`
  - `musteri-odeme-raporu-2026-06-01.pdf`
- Includes:
  - Company label
  - Report title
  - Date range
  - Creation date
  - Filtered table rows
  - Page footer

### CSV Olarak İndir

- Still uses the existing CSV export flow.
- Still creates dated UTF-8 CSV files.

### Yazdır

- Still uses `printCurrentReport()`.
- Print behavior is now only behind the separate `Yazdır` button.

## Reports Covered

Direct PDF download now exists for:

- Proje Finans Raporu
- Müşteri Ödeme Raporu
- Tahsilat Raporu
- Gider Raporu
- Genel Finans Özeti
- Vadesi Geçen Ödemeler Raporu

## Turkish Character Handling

PDF generation uses pdfmake's embedded Roboto virtual font files.

This avoids the previous print-dialog dependency and keeps Turkish text renderable inside the generated PDF.

## Validation

- Ran `npm run build` successfully.
- Confirmed `PDF Olarak İndir` no longer calls `printCurrentReport()`.
- Confirmed the separate `Yazdır` button still calls `printCurrentReport()`.
- Confirmed CSV export code path remains present.

## Known Notes

- The build now emits large lazy-loaded `pdfmake` chunks. They are dynamically imported by `exportPDF()`, so report PDF code is loaded when needed instead of being part of the initial admin page bundle.

## Result

Final QA gap 2 is fixed. Admin report PDF export now downloads a real PDF file directly while preserving CSV and separate print behavior.
