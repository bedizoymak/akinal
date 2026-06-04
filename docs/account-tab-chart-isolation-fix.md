# Root Cause

- Musteri chart data was built as a combined Resmi + Gayri Resmi chart outside the account tab loop.
- Cards and tables were account-filtered, but the chart still included inactive account data.

# Changes Made

- Split Musteri chart data by account type:
  - `resmi`
  - `gayri_resmi`
- Rendered the chart inside each tab using only that tab's account data.
- Kept Personel and Tedarikci chart logic per-tab, already using the same selected account dataset as cards and tables.
- Cards, tables, and chart now share selected account-type filtering.

# Validation

- `npm run build`
