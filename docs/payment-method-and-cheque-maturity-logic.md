# Root Cause

- Card payment records stored amount/status but not the payment method.
- Cheque and promissory-note maturity details were not available for table display, filtering, reporting, or future exports.

# Changes Made

- Added required `Odeme Yontemi` to Musteri, Personel, and Tedarikci payment modals.
- Supported methods:
  - Nakit
  - Banka Havalesi / EFT
  - Kredi Karti
  - Cek
  - Senet
- Added conditional metadata fields:
  - EFT transaction reference
  - credit card note
  - cheque maturity date, cheque number, and bank
  - promissory-note maturity date
- Required maturity date for cheque and promissory-note records.
- Added `Odeme Yontemi` table column with maturity badges such as `Cek Beklemede` and `Senet Beklemede`.
- Kept summary cards, charts, paid/remaining logic, and account type separation unchanged.
- Added backend columns for payment method metadata on payment plan records for future filters and exports.

# Validation

- `npm run build`
