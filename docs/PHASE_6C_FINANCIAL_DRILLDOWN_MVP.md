# Phase 6C Financial Drilldown MVP

## Scope

- Goal: make dashboard and financial card numbers explainable with source rows.
- Execution mode: read-only aggregation over existing dashboard/canonical read data.
- No migrations, schema changes, DB writes, settlement activation, or `config.php` changes.

## Implemented

- Backend dashboard payload now includes `financial_drilldowns`.
- Added read-only drilldown rows for:
  - Customer collections, pending payments, overdue payments
  - Project revenue rows, expense rows, profit components
  - Supplier purchases, payments, remaining payable rows
  - Personnel salary, advances, reimbursements, total cost rows
- Added TypeScript DTOs for the drilldown payload.
- Added dashboard UI section: `Finans Kaynak Satırları`.
- Deployed only the dashboard API file and built frontend assets.

## Hosting-Side Verification

| Check | Result |
| --- | --- |
| Admin authentication | PASS |
| `/api/admin/dashboard.php` JSON | PASS |
| `financial_drilldowns` present | PASS |
| Dashboard app shell loads | PASS |
| Deployed dashboard asset contains drilldown UI | PASS |
| Recent PHP admin log fatal/parse/unhandled errors | 0 |
| Recent PHP admin log warnings | 0 |

## Drilldown Row Counts

| Surface | Drilldown | Rows |
| --- | --- | ---: |
| Customer | Collections | 8 |
| Customer | Pending payments | 8 |
| Customer | Overdue payments | 8 |
| Project | Revenue rows | 8 |
| Project | Expense rows | 8 |
| Project | Profit components | 8 |
| Supplier | Purchases | 8 |
| Supplier | Payments | 8 |
| Supplier | Remaining payable rows | 0 |
| Personnel | Salary | 8 |
| Personnel | Advances | 0 |
| Personnel | Reimbursements | 0 |
| Personnel | Total cost rows | 8 |

## Local Validation

| Command | Result |
| --- | --- |
| `php -l public_html/api/admin/dashboard.php` | PASS |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS |

## Deployment Evidence

- Uploaded `public_html/api/admin/dashboard.php`.
- Uploaded `dist/index.html`.
- Uploaded `dist/assets/index-Dr5jU79e.js`.
- Uploaded `dist/assets/AdminDashboard-G3oLVFeJ.js`.
- `public_html/api/config.php` was not touched.
- No database writes were performed.

## Remaining Notes

- Empty supplier remaining payable, personnel advance, and personnel reimbursement drilldowns are valid current-data outcomes from available source rows.
- Phase 6C uses currently available fields only, matching the requested fallback rule.

## Decision

PHASE_6C_COMPLETE
