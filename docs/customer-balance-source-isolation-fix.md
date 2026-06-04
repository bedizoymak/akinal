# Root Cause

- Customer detail summaries could include collection totals that were not tied to the selected account tab's own payment plan rows.
- When an account tab had no payment rows, stale or unrelated collection data could still influence `Tahsil Edilen` and `Musteri Bakiyesi`.

# Changes Made

- Filtered customer detail collections by the selected `account_type` and by payment plan IDs owned by that same account tab.
- Ensured `Planlanan Alacak`, `Tahsil Edilen`, and `Musteri Bakiyesi` are calculated only from the selected customer's own payment records.
- Removed the balance path where unlinked tahsilat/payment values could affect customer balance.
- Kept gider/expense data separate from customer balance calculations.
- If a customer/account tab has no payment rows, summary totals now resolve to `0,00`.

# Validation

- `npm run build`
