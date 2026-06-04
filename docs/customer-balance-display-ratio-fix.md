# Root Cause

- Balance cards displayed only unpaid remaining balance.
- The requested finance-card view needs a paid-versus-total ratio while keeping existing future, overdue, and upcoming calculations unchanged.

# Changes Made

- Added all-record totals from every payment row in the selected account tab.
- Updated Musteri Bakiyesi display to:
  - paid total / all payment records total
- Updated Personel and Tedarikci shared balance cards to use the same ratio display.
- Kept existing summary logic unchanged for:
  - Planlanan Alacak / future unpaid
  - Tahsil Edilen / paid total
  - Vadesi Gecen Tutar / overdue remaining
  - Yaklasan Odeme / nearest future unpaid

# Validation

- `npm run build`
