# Root Cause

- Personel and Tedarikci detail cards used ledger-style financial movements while Musteri Detayi used payment-plan based account logic.
- This caused different Resmi/Gayri Resmi behavior, different list splits, and different status/paid/remaining calculations.

# Changes Made

- Added payment-plan ownership support for `employee_id` and `expense_card_id`.
- Exposed card-owned payment plans to the finance statement detail response.
- Updated Personel and Tedarikci detail cards to use customer-style:
  - Resmi Hesap / Gayri Resmi Hesap tabs
  - single `Odeme Ekle` action per tab
  - `Hesap Ozeti`
  - `Gelecek Odemeler`
  - clickable payment rows
  - edit modal with `Kaydet`, `Iptal`, and red `Sil`
- Matched customer card payment logic:
  - `Odendi` means paid equals total and remaining equals zero
  - non-paid statuses use only linked actual payment amounts
  - future unpaid rows stay in `Gelecek Odemeler`
  - paid, overdue, today, and early-paid rows stay in `Hesap Ozeti`
  - selected account type data is calculated independently
- Customer detail page was not changed.

# Validation

- `npm run build`
- `php -l public_html/api/admin/employees.php`
- `php -l public_html/api/admin/expense-cards.php`
- `php -l public_html/api/admin/payment-plans.php`
