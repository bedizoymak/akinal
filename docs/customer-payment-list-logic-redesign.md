# Root Cause

- Customer detail showed planned payment rows and actual tahsilat rows as two separate action areas.
- This made `Ödeme Ekle` and `Yeni Tahsilat Ekle` feel like parallel flows in the same layout, even though the requested customer card view should classify planned payment records by timing/payment state.

# Changes Made

- Removed the separate `Yeni Tahsilat Ekle` button from the customer detail account area.
- Kept one action button: `Ödeme Ekle`.
- Split customer payment plan rows into `Hesap Özeti` and `Gelecek Ödemeler`.
- `Hesap Özeti` now includes paid rows, due-today rows, past-due unpaid rows, and future rows that were paid early.
- `Gelecek Ödemeler` now includes only future-dated unpaid rows.
- Past-due unpaid rows show the `Geciken Ödeme` tag.
- Resmi / Gayri Resmi account separation remains unchanged.

# Validation

- `npm run build`
