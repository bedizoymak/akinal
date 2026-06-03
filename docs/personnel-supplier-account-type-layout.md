# Personnel And Supplier Account Type Layout

# Change
- Personel and tedarikçi detail pages now use the same `Resmi Hesap` / `Gayri Resmi Hesap` finance structure as customer detail.
- Each account tab has its own summary cards, planned movements, realized payments, balance, chart, and document table.
- Existing records remain under `Resmi Hesap` unless their finance `Kategori` is `Gayri Resmi`.
- Customer detail was not changed.

# Terminology
- Personel tabs use ödeme, maaş, avans and belge wording.
- Tedarikçi tabs use ödeme, borç, gider, fatura and belge wording.

# Validation
- `npm run build`
- `php -l public_html/api/admin/personnel.php`
- `php -l public_html/api/admin/expense-cards.php`
- `git status`

# Risk
- Low to medium. The change is UI-scoped and uses existing finance entry `Kategori` values for account separation.
