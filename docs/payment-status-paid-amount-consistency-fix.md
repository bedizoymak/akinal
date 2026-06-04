# Root Cause

- Customer payment rows used allocated tahsilat records for `Odenen` and `Kalan`, even when the plan status was manually set to `Odendi`.
- The status helper returned `Odendi`, but the row amount fields still showed unpaid values, which also affected summary totals and chart segments.

# Changes Made

- Manual `Odendi` payment plans now set `Odenen = Tutar` and `Kalan = 0`.
- Customer summary `Tahsil Edilen` now uses enriched payment row totals, so manual paid rows count as collected.
- Overdue, future payment split, and chart calculations inherit the same corrected paid/remaining values.
- `Resmi Hesap` and `Gayri Resmi Hesap` separation remains unchanged.
- UI design, API behavior, and layout were not changed.

# Validation

- `npm run build`
