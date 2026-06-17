# Phase 7G Management Action Queue Finalization

## Scope

- Phase: `PHASE_7G_MANAGEMENT_ACTION_QUEUE_FINALIZATION`
- Execution date: 2026-06-17
- Settlement status: disabled
- Database writes: none
- Migrations/schema changes: none
- Config/env changes: none
- Production config overwrite: none

## Audit Result

The action queue was already sourced from verified cashflow, receivables, payables, profitability, category, and official/unofficial read models. A real management-surface logic gap was found:

- Overdue payable obligations were not promoted as first-class priority actions.
- Payment priority used merged list order instead of unified risk scoring.
- Category pressure was visible in category intelligence but not represented as scored management actions.
- Official/unofficial imbalance had no dedicated action source when a side-specific cash gap appears.

No production data issue was found. The fix was read-only application logic only.

## Implemented Fix

- Added scored, deduped payment priority actions from all remaining payable obligations.
- Added overdue payable action list under Cashflow Action Center.
- Added category priority queue from verified category intelligence.
- Added official/unofficial imbalance action source from verified net cash forecast.
- Standardized action queue sorting by `score`, then `amount`, then `due_date`.
- Preserved existing API response shapes and added optional DTO fields only.

## Formula Verification

| Action type | Formula/source | Result |
| --- | --- | --- |
| Collection Risk Score | `overdue_receivable + remaining_receivable pressure` through customer financial cards | PASS |
| Payment Risk Score | overdue payable boost + amount pressure + due-date window | PASS |
| Project Risk Score | negative cashflow + negative profitability + expense pressure | PASS |
| Forecast Risk Score | negative forecast / payment pressure from net cash forecast | PASS |
| Category Risk Score | category total exposure + planned cash pressure | PASS |
| Action Priority | highest score first, then highest amount, then earliest due date | PASS |

## Required Checks

| Check | Result |
| --- | --- |
| Overdue collection actions | PASS |
| Overdue payable actions | PASS |
| Forecast risk actions | PASS |
| Project profitability risk actions | PASS |
| Category overspend actions | PASS |
| Supplier payable actions | PASS |
| Personnel payable actions | PASS |
| Official/unofficial imbalance actions | PASS |
| Priority scoring | PASS |
| Action deduplication | PASS |
| Dashboard/action center reconciliation | PASS |
| Management dashboard reconciliation | PASS |

## Hosted Verification

Authenticated dashboard API:

| Metric | Value |
| --- | ---: |
| Overdue collection actions | 6 |
| Overdue payable actions | 6 |
| Supplier upcoming actions | 1 |
| Personnel upcoming actions | 1 |
| Payment priority actions | 6 |
| Category actions | 6 |
| Official/unofficial actions | 0 |
| Cash warnings | 1 |
| Collection priority actions | 6 |
| Project risk actions | 6 |
| Current payables | 5,827,334 |
| Overdue payables | 5,021,072 |
| Upcoming payments | 24,391 |

Queue integrity:

| Queue | Count | Duplicates | Score sorted |
| --- | ---: | ---: | --- |
| payment_priority_queue | 6 | 0 | PASS |
| official_unofficial_actions | 0 | 0 | PASS |
| category_priority_queue | 6 | 0 | PASS |
| cash_shortage_warnings | 1 | 0 | PASS |
| collection_priority_queue | 6 | 0 | PASS |

Diagnostics:

| Surface | Status | Mismatch count |
| --- | --- | ---: |
| dashboard.summary | PASS | 0 |
| dashboard.overdue_plans | PASS | 0 |
| dashboard.upcoming_plans | PASS | 0 |
| dashboard.monthly_financials | PASS | 0 |
| reports.aggregates | PASS | 0 |

UI deployment check:

| Label | Result |
| --- | --- |
| `Vadesi Geçmiş Ödemeler` | PASS |
| `Kategori Aksiyonları` | PASS |
| `Resmi/Gayri Resmi Uyarılar` | PASS |

PHP log review:

- FTP log directory was reachable.
- No exposed PHP fatal/parse/warning log file was listed for review through the FTP account.
- Authenticated dashboard API and diagnostics returned valid JSON after deployment.

## Validation

| Validation | Result |
| --- | --- |
| `php -l public_html/api/admin/dashboard.php` | PASS |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS |
| `npm run test` | PASS, 23 tests |
| `npm run finance:parity` | PASS, 15 checks |
| `npm run finance:shadow-test` | PASS |
| Authenticated dashboard API | PASS |
| Canonical read diagnostics | PASS |
| Protected config/env deploy skip | PASS |

## Files Changed

- `public_html/api/admin/dashboard.php`
- `src/lib/apiTypes.ts`
- `src/pages/admin/AdminDashboard.tsx`
- `docs/PHASE_7G_MANAGEMENT_ACTION_QUEUE_FINALIZATION.md`

## Decision

ACTION_QUEUE_VERIFIED
