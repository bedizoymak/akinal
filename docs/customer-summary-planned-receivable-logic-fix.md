# Root Cause

- `Planlanan Alacak` was calculated from all payment plan rows in the selected account tab.
- Manual or fully paid `Ödendi` rows still contributed to planned receivable, even though they should only count as collected.

# Changes Made

- `Planlanan Alacak` now includes only future-dated unpaid remaining payment rows.
- `Tahsil Edilen` continues to use paid/manual `Ödendi` amounts from the selected account.
- `Müşteri Bakiyesi` now uses unpaid remaining amounts only.
- `Vadesi Geçen Tutar` remains limited to past-due unpaid remaining amounts.
- `Yaklaşan Ödeme` now selects the nearest future unpaid payment.
- `Resmi Hesap` and `Gayri Resmi Hesap` separation is unchanged.

# Validation

- `npm run build`
