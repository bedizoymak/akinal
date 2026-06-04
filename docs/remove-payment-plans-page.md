# Root Cause

- Payment plans are now managed from detail cards, so the standalone `Ödeme Planları` page duplicated the workflow.
- Dashboard, sidebar, and customer detail links still pointed to `/admin/odeme-planlari`.

# Changes Made

- Removed the standalone `AdminPaymentPlans` page component.
- Removed the sidebar `Ödeme Planları` menu item and page metadata.
- Removed the lazy route target for the standalone page.
- Added a clean redirect from old `/admin/odeme-planlari` access to `/admin/musteriler`.
- Updated dashboard cards and follow-up blocks to point receivable work to `Müşteriler`.
- Moved customer detail payment add/edit into the customer card dialog so payment rows remain manageable without the standalone page.
- Kept the underlying payment plan APIs and create/update client calls for detail-card use.

# Validation

- `npm run build`
