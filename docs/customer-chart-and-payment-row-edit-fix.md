# Root Cause

- The chart used broad account totals instead of the same classified rows used by `Hesap Özeti` and `Gelecek Ödemeler`.
- Manual `Ödendi` rows could still be represented as remaining/geciken in the chart because paid amount and display status were not reconciled.
- Customer detail payment rows were static table rows with no click target for the existing payment-plan edit modal.

# Changes Made

- Rebuilt `Genel Ödeme Durumu` chart data from the same `Hesap Özeti` and `Gelecek Ödemeler` row groups.
- Manual `Ödendi` rows are counted as paid and excluded from remaining/geciken segments.
- `Geciken ödeme` now includes only past-due unpaid remaining amounts.
- Future unpaid remaining amounts stay in the remaining segments, so chart percentages are based on one non-overlapping total.
- Made rows in both customer payment sections clickable with hover tint and pointer affordance.
- Row clicks open the existing `Ödeme Planları` edit modal through `duzenle=<planId>` while preserving customer/account query context.

# Validation

- `npm run build`
