# Root Cause

- Payment plans could be opened from `Müşteri Detayı`, but the in-card edit modal only supported save/cancel.
- Deleting a planned payment still required access to the removed standalone payment plans page.

# Changes Made

- Added a red `Sil` button to the payment edit modal footer for existing planned payment records.
- Added confirmation text: `Bu ödeme kaydını silmek istediğinize emin misiniz?`
- Deletion uses the existing payment-plan delete API and does not delete actual tahsilat records.
- After confirmed deletion, customer detail reloads so summary cards, chart data, `Hesap Özeti`, and `Gelecek Ödemeler` are recalculated from fresh data.
- Added a clear destructive toast message if deletion fails because the record is referenced or the API rejects the request.
- Resmi / Gayri Resmi separation remains unchanged because reload uses the existing `account_type` filters.

# Validation

- `npm run build`
- `git status`

# Commit Hash

- Pending
