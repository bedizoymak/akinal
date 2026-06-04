# Root Cause

- Payment edit modals allowed `Iptal` as a selectable status.
- `Kismi Odendi` had no explicit persisted partial amount field, so rows could not reliably calculate `Odenen`, `Kalan`, summaries, charts, or future/current grouping after refresh.

# Changes Made

- Removed `Iptal` from payment plan status dropdowns.
- Added required `Odenen Tutar` input when status is `Kismi Odendi`.
- Validated partial amount as greater than `0` and less than total `Tutar`.
- Persisted payment plan `paid_amount` and normalized it by status:
  - `Odendi` stores full amount as paid.
  - `Kismi Odendi` stores the entered partial amount.
  - `Bekliyor` and `Vadesi Gecti` store zero manual paid amount.
- Updated Musteri, Personel, and Tedarikci card calculations to use the same partial amount source for rows, summaries, charts, `Hesap Ozeti`, and `Gelecek Odemeler`.

# Validation

- `npm run build`
