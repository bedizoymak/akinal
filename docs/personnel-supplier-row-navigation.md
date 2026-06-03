# Personnel And Supplier Row Navigation

# Change
- Personel table rows now navigate to `/admin/personeller/:id/finans`.
- Tedarikçi table rows now navigate to `/admin/gider-kartlari/:id/finans`.
- Existing Finans, Düzenle, and Sil actions keep working separately.
- Added pointer cursor and subtle green hover tint to clickable rows.

# Validation
- `npm run build`

# Risk
- Low. Changes are limited to row click handling and hover styling in existing admin tables.
