# Phase 6A Unified Financial Cards MVP

## Scope

- Goal: deliver visible read-only financial cards using existing canonical read data.
- Surfaces:
  - Customer Card
  - Project Card
  - Supplier Card
  - Personnel Card
- Migrations: none
- Schema changes: none
- Settlement activation: none
- New accounting engine: none
- DB writes: none

## Implemented

### Backend

Added read-only `unified_financial_cards` DTOs to:

- `public_html/api/admin/dashboard.php`

Returned groups:

- `customers`
- `projects`
- `suppliers`
- `personnel`

### DTO Metrics

Customer card:

- total contract value
- total collected
- remaining receivable
- overdue amount
- upcoming amount
- payment performance summary

Project card:

- total revenue
- total expenses
- net profit
- outstanding receivables
- outstanding payables
- current cash position

Supplier card:

- total purchases
- total paid
- remaining payable
- overdue payable
- last payment date

Personnel card:

- salary paid
- advances paid
- expense reimbursements
- total personnel cost

### Dashboard Integration

Added a new dashboard section:

- `Birleşik Finans Kartları`

The dashboard renders compact top-card groups for:

- customers
- projects
- suppliers
- personnel

Files changed:

- `public_html/api/admin/dashboard.php`
- `src/lib/apiTypes.ts`
- `src/pages/admin/AdminDashboard.tsx`

## Deployment

Uploaded:

- built frontend assets
- `dist/index.html`
- `public_html/api/admin/dashboard.php`

Not touched:

- `public_html/api/config.php`
- database data
- migrations
- schema
- canonical settlement flags

## Validation

Local validation:

| Check | Result |
| --- | --- |
| `php -l public_html/api/admin/dashboard.php` | PASS |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS |

Hosting validation:

| Check | Result |
| --- | --- |
| Authenticated `/api/admin/dashboard.php` | HTTP `200`, JSON |
| `unified_financial_cards` present | PASS |
| Customer card group present | PASS, 6 cards returned |
| Project card group present | PASS, 6 cards returned |
| Supplier card group present | PASS, 6 cards returned |
| Personnel card group present | PASS, 6 cards returned |
| Required customer fields present | PASS |
| Required project fields present | PASS |
| Required supplier fields present | PASS |
| Required personnel fields present | PASS |
| `/admin/dashboard` app shell loads | PASS |
| Sampled admin PHP log tail fatal/parse errors | 0 |
| Sampled admin PHP log tail warnings | 0 |

## MVP Notes

- Supplier/personnel cards use currently available fields only.
- Supplier purchases/payments are derived from existing expense card links, financial entries, and payment plans where available.
- Personnel salary/advance/reimbursement split is inferred from existing employee-linked financial entry titles for MVP speed.
- No settlement write model was activated.

## Decision

PHASE_6A_COMPLETE

