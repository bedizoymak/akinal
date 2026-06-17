# Phase 6H - Management Decision Dashboard

## Scope

- Added a read-only Management Decision Dashboard to the admin dashboard.
- Reused existing canonical/dashboard DTOs and cashflow card data.
- No database writes, migrations, schema changes, config changes, or settlement activation were performed.
- Protected files were not uploaded or modified: `public_html/api/config.php`, `public_html/api/config.local.php`, `.env`, `.env.local`.

## Implemented

The dashboard API now returns `management_decision_dashboard` with:

| Decision Area | Status |
| --- | --- |
| Top risky customers | Implemented |
| Top overdue collections | Implemented |
| Top supplier liabilities | Implemented |
| Top personnel cost centers | Implemented |
| Top profitable projects | Implemented |
| Top loss-making projects | Implemented |
| Cash shortage warnings | Implemented |
| Collection priority queue | Implemented |
| Payment priority queue | Implemented |

The admin dashboard UI now includes a visible `Management Decision Dashboard` section using the existing action-center list presentation.

## Validation

| Check | Result |
| --- | --- |
| PHP lint for `public_html/api/admin/dashboard.php` | PASS |
| TypeScript check | PASS |
| Production build | PASS |
| Deployment completed without protected file upload | PASS |
| Authenticated dashboard API reachable | PASS |
| `management_decision_dashboard` present in API response | PASS |
| Dashboard app shell reachable | PASS |
| Deployed dashboard bundle contains new section labels | PASS |
| Recent admin PHP log fatal/parse errors | 0 |
| Recent admin PHP log warnings | 0 |

Authenticated hosted API counts:

| Field | Count |
| --- | ---: |
| `top_risky_customers` | 6 |
| `top_overdue_collections` | 6 |
| `top_supplier_liabilities` | 6 |
| `top_personnel_cost_centers` | 6 |
| `top_profitable_projects` | 6 |
| `top_loss_making_projects` | 1 |
| `cash_shortage_warnings` | 1 |
| `collection_priority_queue` | 6 |
| `payment_priority_queue` | 0 |

## Files Changed

- `public_html/api/admin/dashboard.php`
- `src/lib/apiTypes.ts`
- `src/pages/admin/AdminDashboard.tsx`
- `docs/PHASE_6H_MANAGEMENT_DECISION_DASHBOARD.md`

Deployed artifacts:

- `public_html/api/admin/dashboard.php`
- `dist/index.html`
- `dist/assets/index-gfEgQKag.js`
- `dist/assets/AdminDashboard-Be9v6XyD.js`
- `dist/assets/index-CA8RWWIg.css`

## Decision

MANAGEMENT_READY
