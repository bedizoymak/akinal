# Root Cause

- Customer detail mutations waited for a refetch while the previous account-specific plan/payment arrays stayed visible.
- When the last record in an account type was deleted, the selected account could briefly continue rendering the previous totals until fresh data arrived.
- The default tab active state used a white background, which made `Resmi Hesap` / `Gayri Resmi Hesap` selection visually weak.

# Changes Made

- After add/edit/delete, the affected `account_type` local payment-plan and tahsilat arrays are cleared before refetch.
- Customer detail then reloads fresh data so summary cards, charts, `Hesap Özeti`, and `Gelecek Ödemeler` recalculate from current account-filtered data.
- Empty account tabs now fall back to zero-value summaries immediately.
- Active customer account tab now uses Akınal green with white text.
- Inactive account tabs remain neutral.

# Validation

- `npm run build`
