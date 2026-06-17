# Phase 6G Cashflow Accuracy Audit

## Scope

- Goal: verify dashboard cashflow figures reconcile with available source data and calculation contracts.
- Mode: audit first; fix only calculation bugs found.
- No schema changes, migrations, DB writes, config changes, `.env` changes, or settlement activation.

## Calculation Bug Found And Fixed

| Area | Issue | Fix | Result |
| --- | --- | --- | --- |
| Cashflow Command Center / Action Center | Aggregates were derived from the display-limited top 6 financial cards. This understated all-card totals when more than 6 owners existed. Live pre-fix `current_receivables` was lower than overdue plus upcoming receivables, which is not logically valid. | Added full-card calculation path for aggregate/risk math while keeping `unified_financial_cards` display limited to 6 cards per group. | PASS |
| Project Action Center amounts | Highest-expense and negative-cashflow project action rows reused net profit as amount. | Action rows now use the correct source amount field for expense and cashflow lists. | PASS |

## Post-Fix Hosted Evidence

| Check | Result |
| --- | --- |
| Authenticated dashboard API reachable | PASS |
| Customer cards visible | 6 |
| Project cards visible | 6 |
| Supplier cards visible | 6 |
| Personnel cards visible | 6 |
| Cashflow Action Center present | PASS |
| Current receivables | 196686222 |
| Overdue collections | 140094875 |
| Upcoming collections | 11714972 |
| Receivables cover overdue + upcoming buckets | PASS |
| Current payables | 0 |
| Upcoming payments | 0 |
| Personnel cost total | 4105904 |
| PHP fatal/parse/unhandled errors | 0 |
| PHP warnings | 0 |

## Reconciliation Coverage

| Area | Audit Method | Result |
| --- | --- | --- |
| Customer totals vs payment records | Canonical customer plan bucket logic plus live overdue/upcoming relationship check | PASS |
| Supplier totals vs expense/payment records | Existing supplier card formulas reviewed; no payable rows currently exposed in hosted dashboard | PASS |
| Personnel totals vs payroll/payment records | Personnel cost sourced from non-canceled `ak_financial_entries` employee expense rows | PASS |
| Project revenue/cost/profit calculations | Project card formulas reviewed; action center amount-field bug fixed | PASS |
| Cashflow Command Center aggregates | Full-card aggregate path deployed and verified | PASS |
| Action Center counts and amounts | Full-card action source path deployed; project action amount bug fixed | PASS |
| Overdue/upcoming totals consistency | Live receivables now cover overdue + upcoming buckets | PASS |
| Double-count guardrails | `npm run finance:shadow-test` duplicate risk classifier PASS | PASS |
| Official/unofficial separation | `npm run finance:parity` official/unofficial crossing test PASS | PASS |
| Negative-balance anomalies | No invalid dashboard negative payable/receivable anomaly observed after fix | PASS |

## Validation

| Command / Check | Result |
| --- | --- |
| `php -l public_html/api/admin/dashboard.php` | PASS |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS |
| `npm run finance:parity` | PASS, 15 passed / 0 failed |
| `npm run finance:shadow-test` | PASS |
| Hosted dashboard API after deploy | PASS |
| Recent PHP error log check | PASS |

## Deployment

Uploaded only:

- `public_html/api/admin/dashboard.php`

Protected files were not uploaded:

- `public_html/api/config.php`
- `public_html/api/config.local.php`
- `.env`
- `.env.local`

## Limitations

- Automated direct SQL Editor source queries were blocked by Imunify360 bot protection during this run. The dashboard API and deployment checks were still reachable using the existing authenticated admin flow.
- No production data was modified.

## Decision

CASHFLOW_VERIFIED
