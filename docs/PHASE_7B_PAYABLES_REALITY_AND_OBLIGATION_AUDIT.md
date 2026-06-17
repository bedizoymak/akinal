# Phase 7B - Payables Reality And Obligation Audit

## Scope

- Goal: determine whether `current_payables = 0` and `upcoming_payments = 0` reflected business reality.
- Mode: audit first; fix only real calculation or logic bugs.
- No production data was modified.
- No migrations, schema changes, config changes, `.env` changes, or settlement activation were performed.

## Finding

`current_payables = 0` and `upcoming_payments = 0` were not business-real.

The dashboard payable formula only counted non-customer rows in `ak_payment_plans`. Hosting-side read validation showed:

| Source | Count | Amount |
| --- | ---: | ---: |
| Non-customer payable plans | 0 | 0 |
| Planned expense financial entries | 40 | 5827334 |
| Supplier planned obligations | 20 | 3470413 |
| Personnel planned obligations | 20 | 2356921 |
| Project-linked planned obligations | 37 | 5523334 |

Because supplier/personnel obligations existed as planned `ak_financial_entries` rows, payables were being understated.

## Fix Applied

Added a read-only payable obligation source that combines:

1. Active non-customer `ak_payment_plans`.
2. Planned expense `ak_financial_entries` with `direction = 'Gider'` and `status = 'Planlandı'`.

The helper excludes planned financial entries when an active payable plan has the same owner, project, amount, due date, and account type signature. This avoids obvious double-counting when both representations exist.

## Documented Formulas

### Supplier Payable Formula

Supplier payable is:

`sum(max(0, plan.amount - plan.paid_amount)) for active supplier payment plans`

plus:

`sum(planned supplier expense financial entries not represented by an active matching payable plan)`

Realized supplier payments use only `ak_financial_entries` with:

- `expense_card_id IS NOT NULL`
- `direction = 'Gider'`
- `status = 'Gerçekleşti'`

Planned supplier obligations are not counted as paid.

### Personnel Payable Formula

Personnel payable is:

`sum(max(0, plan.amount - plan.paid_amount)) for active personnel payment plans`

plus:

`sum(planned personnel expense financial entries not represented by an active matching payable plan)`

Realized salary, advance, and reimbursement amounts use only personnel `ak_financial_entries` with:

- `employee_id IS NOT NULL`
- `direction = 'Gider'`
- `status = 'Gerçekleşti'`

Planned personnel obligations are exposed as remaining/overdue payable pressure.

### Project Payment Pressure Formula

Project payment pressure is:

`sum(payable obligation remaining amount where project_id matches the project)`

This now includes both active non-customer payment plans and planned project-linked expense financial entries.

### Expense Category Treatment

Demolition, machinery rental, iron, cement, raw materials, permits, government fees, subcontractors, site costs, and similar categories currently enter payable pressure through planned expense financial entries or payable plans. Category labels remain source data; the payable formula is driven by status, direction, owner, project, amount, and due/entry date.

## Hosted Post-Fix Evidence

| Metric | Before Fix | After Fix |
| --- | ---: | ---: |
| `current_payables` | 0 | 5827334 |
| `upcoming_payments` | 0 | 24391 |
| Supplier remaining payable rows | 0 | 8 |
| Upcoming supplier actions | 0 | 1 |
| Upcoming personnel actions | 0 | 1 |
| Highest payable actions | 0 | 6 |
| Payment priority queue | 0 | 6 |

Visible card evidence after fix:

| Surface | Value |
| --- | ---: |
| Supplier remaining payable visible total | 2407500 |
| Supplier overdue payable visible total | 2407500 |
| Project outstanding payables visible total | 1045151 |
| Personnel remaining payable visible total | 1648000 |
| Personnel overdue payable visible total | 1342500 |

## Official / Unofficial Split

Planned payable obligations remain separated by source `group_tag` / account type:

| Group | Count | Amount |
| --- | ---: | ---: |
| Resmi | 28 | 4299870 |
| Gayri Resmi | 12 | 1527464 |

The `finance:parity` guardrail also confirmed official/unofficial settlement crossing remains rejected.

## Double-Counting Review

| Risk | Result |
| --- | --- |
| Supplier expenses counted as both paid and payable | Fixed; only `Gerçekleşti` entries count as paid |
| Personnel planned rows counted as paid salary/advance/reimbursement | Fixed; only `Gerçekleşti` entries count as paid |
| Payment plans plus planned financial entries for same obligation | Guarded by owner/project/amount/date/account signature |
| Project expenses vs payable pressure | Separated: realized project expense remains realized cost; planned obligations feed outstanding payables |
| Supplier purchases vs payments | Planned obligations increase purchases/payable; realized entries increase purchases/paid |

## Files Changed

- `public_html/api/admin/dashboard.php`
- `src/lib/apiTypes.ts`
- `src/pages/admin/AdminDashboard.tsx`
- `docs/PHASE_7B_PAYABLES_REALITY_AND_OBLIGATION_AUDIT.md`

Deployed:

- `public_html/api/admin/dashboard.php`
- `dist/index.html`
- `dist/assets/index-Cg7aVAVo.js`
- `dist/assets/AdminDashboard-QMSB5XCU.js`
- `dist/assets/index-CA8RWWIg.css`

Protected files were not uploaded or modified:

- `public_html/api/config.php`
- `public_html/api/config.local.php`
- `.env`
- `.env.local`

## Validation

| Check | Result |
| --- | --- |
| `php -l public_html/api/admin/dashboard.php` | PASS |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS |
| `npm run test` | PASS, 23 passed / 0 failed |
| `npm run finance:parity` | PASS, 15 passed / 0 failed |
| `npm run finance:shadow-test` | PASS |
| Authenticated hosted dashboard API | PASS |
| Authenticated canonical read diagnostics | PASS |
| Recent admin PHP fatal/parse errors | 0 |
| Recent admin PHP warnings | 0 |

## Decision

PAYABLES_VERIFIED
