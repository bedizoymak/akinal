# Root Cause

- The receivable card used only future unpaid remaining amounts.
- Accounting logic requires receivable to represent all remaining unpaid amounts, including partial and overdue records.

# Changes Made

- Updated Musteri card `Toplam Alacak` to use all remaining amounts.
- Updated Personel and Tedarikci shared finance cards to use the same all-remaining receivable value.
- Included remaining amounts from:
  - Bekliyor
  - Kismi Odendi
  - Vadesi Gecti
- Excluded fully paid records.
- Kept `Tahsil Edilen`, `Vadesi Gecen Tutar`, and `Yaklasan Odeme` logic unchanged.

# Validation

- `npm run build`
