# Root Cause

- Finance chart `kalan` segments included overdue remaining amounts.
- Overdue was then rendered again as `Geciken odeme`, so the same unpaid amount appeared in two chart segments.

# Changes Made

- Split chart data into mutually exclusive buckets:
  - paid
  - overdue unpaid remaining
  - future unpaid/partial remaining
  - today due unpaid/partial remaining
- Updated Musteri combined chart so `Resmi kalan` and `Gayri resmi kalan` only represent future remaining amounts.
- Added separate today-due chart segment.
- Updated Personel and Tedarikci chart data to use the same non-overlapping bucket split.
- Kept summary card values intact:
  - paid total
  - all unpaid balance
  - overdue remaining
  - planned future remaining
  - nearest future payment
- Chart percentages now calculate from non-overlapping visible segments.

# Validation

- `npm run build`
