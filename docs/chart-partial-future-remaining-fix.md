# Root Cause

- Müşteri chart used the visible `futurePlans` table rows for the future/kalan segment.
- `futurePlans` intentionally excludes future-dated partial payments because partial payments appear in `Hesap Özeti`.
- This caused the chart to omit the remaining amount of future partial payment rows.
- Personel and Tedarikçi chart logic already uses all future unpaid/partial remaining rows through `futureUnpaidPlans`.

# Changes Made

- Added a chart-only future row set for Müşteri finance summaries.
- Chart future/kalan now includes all future remaining amounts:
  - Bekliyor remaining
  - Kısmi Ödendi remaining
- Kept the existing `Hesap Özeti` and `Gelecek Ödemeler` table split unchanged.
- Confirmed Personel and Tedarikçi chart buckets already include future partial remaining amounts.

# Validation

- `npm run build`
