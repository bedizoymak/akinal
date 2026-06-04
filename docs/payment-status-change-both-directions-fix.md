# Root Cause

- Payment plan saves immediately ran the customer/account status sync after insert or edit.
- When a user changed `Odendi` back to `Bekliyor`, the sync could overwrite the manual status during the same request.
- That made the frontend continue treating the row as paid, so `Odenen`, `Kalan`, summaries, and charts stayed stale.

# Changes Made

- Payment plan create/edit now preserves the manually selected status.
- Actual tahsilat record changes still keep their existing status sync behavior.
- Customer detail calculations continue to treat manual `Odendi` as fully paid and non-`Odendi` statuses as paid only by linked tahsilat.
- `Odendi -> Bekliyor`, `Odendi -> Vadesi Gecti`, `Odendi -> Kismi Odendi`, and `Bekliyor -> Odendi` now recalculate from the saved status and linked tahsilat state.
- `Resmi Hesap` and `Gayri Resmi Hesap` separation is unchanged.

# Validation

- `npm run build`
- `php -l public_html/api/admin/payment-plans.php`
