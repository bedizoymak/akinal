# Root Cause

- The previous payment-plan save path collapsed every non-`İptal` manual status back to `Bekliyor`.
- Recalculation after tahsilat changes did not treat manual `Ödendi` as an explicit completion.
- As a result, a manually completed past-due plan could be recalculated as `Vadesi Geçti`.

# Changes Made

- Manual plan statuses are accepted again: `Ödendi`, `Bekliyor`, `Vadesi Geçti`, `Kısmi Ödendi`, `İptal`.
- Shared frontend status evaluation now returns `Ödendi` immediately when the plan is manually completed.
- Backend plan recalculation skips manually completed `Ödendi` plans, so due date does not downgrade them.
- Partial and full tahsilat logic still updates paid/remaining amounts and derived statuses for non-completed plans.
- Customer `Resmi Hesap` and `Gayri Resmi Hesap` plan calculations continue to stay separated by `account_type`.
- Personel and Tedarikçi were audited; their finance cards use the separate financial-entry model and were not changed.

# Validation

- `npm run build`
- `php -l public_html/api/admin/payment-plans.php`
- `php -l public_html/api/admin/payments.php`
- `php -l public_html/api/admin/customers.php`
- `php -l public_html/api/admin/employees.php`
- `php -l public_html/api/admin/expense-cards.php`

# Commit Hash

- Pending
