# Customer Row Navigation

# Change
- Made desktop Müşteriler table rows clickable.
- Row clicks navigate to `/admin/musteriler/:id`.
- Existing action buttons remain independent:
  - Finans: `/admin/musteriler/:id/finans`
  - Görüntüle: `/admin/musteriler/:id`
  - Düzenle: `/admin/musteriler/:id/duzenle`
- WhatsApp links keep their direct external behavior.
- Added a subtle green hover tint and pointer cursor to clickable rows.

# Validation
- `npm run build`

# Risk
- Low. The change is limited to row-level navigation and click propagation in the existing customer table.
