# Phase 6D Cashflow Action Center

## Implemented

- Added read-only `cashflow_action_center` payload to the admin dashboard API.
- Added operational action groups:
  - Critical collections: highest overdue customers, highest outstanding balances, collection risk scores.
  - Critical payments: upcoming supplier payments, upcoming personnel payments, highest payable balances.
  - Project risk list: lowest profitability projects, highest expense projects, negative cashflow projects.
  - Daily action queue: customers to contact today, suppliers requiring payment review, projects requiring financial review.
- Added TypeScript DTOs for `AdminCashflowActionCenter` and `AdminCashflowActionItem`.
- Added dashboard UI section: `Cashflow Action Center`.
- Used only SELECT/read aggregation from existing canonical/dashboard card data and existing payment-plan sources.
- No placeholder data, schema changes, migrations, DB writes, config changes, or settlement activation.

## Validation

| Check | Result |
| --- | --- |
| `php -l public_html/api/admin/dashboard.php` | PASS |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS |
| Authenticated dashboard API | PASS |
| Dashboard loads on hosting | PASS |
| New section visible on hosting | PASS |
| Zero PHP fatal/parse errors on hosting | PASS |

## Hosting Evidence

| Action Center Group | Rows |
| --- | ---: |
| Highest overdue customers | 6 |
| Highest outstanding balances | 6 |
| Collection risk scores | 6 |
| Upcoming supplier payments | 0 |
| Upcoming personnel payments | 0 |
| Highest payable balances | 0 |
| Lowest profitability projects | 6 |
| Highest expense projects | 6 |
| Negative cashflow projects | 0 |
| Customers to contact today | 6 |
| Suppliers requiring payment review | 0 |
| Projects requiring financial review | 6 |

Deployment uploaded only:

- `public_html/api/admin/dashboard.php`
- `dist/index.html`
- `dist/assets/index-Bb0saUaE.js`
- `dist/assets/AdminDashboard-B4iG5OoI.js`
- `dist/assets/index-CA8RWWIg.css`

Protected files were not uploaded:

- `public_html/api/config.php`
- `public_html/api/config.local.php`
- `.env`
- `.env.local`

## Files Changed

- `public_html/api/admin/dashboard.php`
- `src/lib/apiTypes.ts`
- `src/pages/admin/AdminDashboard.tsx`
- `docs/PHASE_6D_CASHFLOW_ACTION_CENTER.md`

## Decision

PHASE_6D_COMPLETE
