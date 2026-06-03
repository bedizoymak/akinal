# Personnel And Supplier Card Layout

# Change
- Personel and tedarikçi finance detail pages now use a customer-detail style card structure.
- Added top information/document cards before summary metrics.
- Kept page-specific Turkish terminology:
  - Personel: maaş, ödeme, gider, avans, belgeler
  - Tedarikçi: borç, ödeme, gider, fatura, belgeler
- Added tabbed chart/document area for detail pages.
- Preserved existing finance movement filters, tables, actions, calculations, and APIs.

# Validation
- `npm run build`
- `git status`

# Risk
- Low. Changes are limited to shared admin finance detail UI rendering and terminology for personel/tedarikçi detail pages.
