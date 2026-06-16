# Phase 4H - Cutover Blockers

**Date:** 2026-06-15  
**Decision:** `BLOCKED`

## Blocking Issues

| ID | Blocker | Why It Blocks Cutover | Required Resolution |
| --- | --- | --- | --- |
| H-01 | Backend dashboard aggregates still use direct SQL formulas | Dashboard widgets can disagree with canonical read-model metrics | Add server-side canonical read-model adapter for dashboard totals and overdue queues |
| H-02 | Backend financial statement endpoint still unions legacy payments/expenses and ledger rows | Legacy and ledger rows can double-count the same business event | Add duplicate-aware canonical read endpoint or mark legacy union rows audit-only |
| H-03 | Customer list/detail screens still use page-local plan/payment summaries | Customer balance and chart values can differ from report/dashboard values | Route customer summaries through one canonical card adapter |
| H-04 | Report/export rows still include local legacy sums | PDF/CSV exports can preserve old formula mismatches | Build report adapters from canonical read-model outputs before export generation |
| H-05 | Expense reports still aggregate `ak_expenses` directly | Legacy expenses lack account type, supplier identity, and settlement evidence | Classify legacy expenses or exclude unresolved rows from authoritative category/supplier totals |
| H-06 | Notifications still calculate overdue/upcoming plans independently | Reminder counts can disagree with card overdue metrics | Move notification overdue/upcoming logic behind canonical plan-state derivation server-side |
| H-07 | Supplier identity remains expense-card based | Supplier card totals can overlap category card semantics | Define supplier/vendor identity model before final supplier-card cutover |
| H-08 | Source identity uniqueness is not schema-enforced | Duplicate detection exists but prevention is not guaranteed | Add approved uniqueness constraints in a separate schema-hardening phase |
| H-09 | Runtime DDL remains in existing PHP request paths | Read cutover should not occur while request handlers can alter schema opportunistically | Remove runtime DDL from finance/customer/payment endpoints |
| H-10 | No hosting-side production parity run for read model | Local synthetic parity proves math but not live data classification | If DB verification is required, run server-side through `public_html/api/config.php` and isolated/read-only parity paths |

## Legacy Dependencies Still Present

- `ak_payments` customer collections as live display inputs.
- `ak_expenses` direct expense totals.
- `ak_payment_plans.paid_amount` and legacy status fields as compatibility evidence.
- FIFO allocation compatibility through `allocateCollectionsToPlans()`.
- `ak_financial_entries` legacy `Gerçekleşti`/`Planlandı`/`İptal` status vocabulary.
- `ak_expense_cards` as supplier/vendor compatibility identity.
- Backend PHP aggregate SQL in dashboard, notifications, and financial statements.

## Required Before Phase 5A

Phase 5A should require:

1. A server-side canonical read-model adapter using the existing `public_html/api/config.php` DB path.
2. Dashboard, statement, report, export, notification, and card endpoint parity reports.
3. Duplicate-risk rows excluded from authoritative totals.
4. Unresolved legacy expenses excluded from supplier/category profitability.
5. One as-of-date contract per response.
6. Account type and currency buckets kept separate end to end.
7. Rollback path for each read surface.
8. No write-path activation.
9. No canonical settlement feature flag activation.

## Validation Completed In Phase 4H

| Check | Result |
| --- | --- |
| `npm run finance:parity` | PASS |
| `npm run finance:shadow-test` | PASS |
| `npm run build` | PASS |
| `npm run test` | PASS |
| `npx tsc --noEmit` | PASS |

## Final Decision

`BLOCKED`

Phase 4H cannot honestly claim full financial surface convergence while backend aggregates, exports, notifications, customer detail summaries, and expense reports still have direct legacy calculation paths.

