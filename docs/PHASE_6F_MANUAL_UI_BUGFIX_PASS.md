# Phase 6F Manual UI Bugfix Pass

## Scope

- Goal: fix only visible UI/UX bugs from manual website testing.
- Priority: dashboard, cashflow, card visibility, drilldowns, command/action centers.
- No migrations, DB writes, config changes, `.env` changes, schema changes, or settlement activation.

## Fix Applied

| Area | Issue | Fix | Result |
| --- | --- | --- | --- |
| Financial cards | Large TRY values could be truncated in the forced two-column card metric grid on narrow screens | Changed metric grid to one column on very small screens and allowed amount text to wrap | PASS |

## Validation

| Check | Result |
| --- | --- |
| `php -l public_html/api/admin/dashboard.php` | PASS |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS |
| Authenticated dashboard API | PASS |
| Admin dashboard route loads app shell | PASS |
| Customers route loads app shell | PASS |
| Finance route loads app shell | PASS |
| Reports route loads app shell | PASS |
| Financial cards visible in deployed dashboard bundle | PASS |
| Drilldowns visible in deployed dashboard bundle | PASS |
| Cashflow Command Center visible in deployed dashboard bundle | PASS |
| Cashflow Action Center visible in deployed dashboard bundle | PASS |
| Overdue/upcoming labels visible in deployed dashboard bundle | PASS |
| Headless Chrome smoke load severe console-like errors | 0 |
| Recent PHP fatal/parse/unhandled errors | 0 |
| Recent PHP warnings | 0 |

## Hosted Data Evidence

| Surface | Result |
| --- | ---: |
| Customer cards | 6 |
| Project cards | 6 |
| Supplier cards | 6 |
| Personnel cards | 6 |
| Overdue plans | 8 |
| Upcoming plans | 8 |
| Drilldowns | Present |
| Cashflow Command Center | Present |
| Cashflow Action Center | Present |

## Deployment

Uploaded only frontend artifacts for the UI fix:

- `dist/index.html`
- `dist/assets/index-C8qXbiA9.js`
- `dist/assets/AdminDashboard-Cls24GxB.js`
- `dist/assets/index-CA8RWWIg.css`

Protected files were not uploaded:

- `public_html/api/config.php`
- `public_html/api/config.local.php`
- `.env`
- `.env.local`

## Notes

- The in-app browser surface was unavailable in this session, so the UI pass used hosted route checks, deployed bundle checks, authenticated dashboard API validation, and a local Chrome headless smoke load.
- No new business features were added.

## Decision

UI_ACCEPTABLE
