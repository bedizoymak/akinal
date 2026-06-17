# Phase 7F Expense Category Intelligence Audit

## Scope

- Phase: `PHASE_7F_EXPENSE_CATEGORY_INTELLIGENCE_AUDIT`
- Goal: verify expense categories are classified, reconciled, and reflected in profitability, payables, forecast, and management reporting.
- Production data writes: none
- Migrations/schema changes: none
- Config/env changes: none
- Settlement activation: not enabled

## Finding

A real reporting gap was found and fixed.

The system had category data in `ak_expense_cards.category` and legacy `ak_expenses.category`, but the current canonical profitability/payable/forecast surfaces use `ak_financial_entries`. Since `ak_financial_entries` has no category column, category intelligence was not available as a reconciled management surface.

## Fix Applied

Added a read-only category intelligence model to the dashboard API and UI.

Category source mapping:

| Source | Category rule |
| --- | --- |
| Supplier/project financial entries with `expense_card_id` | `ak_expense_cards.category` |
| Personnel financial entries or obligations | `Personel` |
| Supplier rows with card but blank category | `Tedarikçi / Malzeme` |
| General/unlinked rows without category | `Diğer / Kategorisiz` |

No schema was changed. The model uses the currently available category fields.

## Category Formulas

Category Realized Cost:

```text
sum(realized expense entries in category)
where ak_financial_entries.direction = 'Gider'
  and ak_financial_entries.status = 'Gerçekleşti'
```

Category Planned Cost:

```text
sum(planned payable obligations in category)
```

Category Total Exposure:

```text
realized_cost + planned_cost
```

Category Cash Pressure:

```text
sum(remaining payable obligations in category)
```

Category Profitability Impact:

```text
sum(realized category expenses where project_id is not null)
```

Official/Unofficial Category Split:

```text
realized split uses ak_financial_entries.group_tag
planned split uses payable obligation account_type
```

## Hosted Evidence

Authenticated hosted dashboard API returned:

| Metric | Value |
| --- | ---: |
| category_count | 11 |
| uncategorized_count | 0 |
| realized_cost_total | 34,315,781 |
| planned_cost_total | 5,827,334 |
| cash_pressure_total | 5,827,334 |
| profitability_impact_total | 31,427,269 |
| top category | Malzeme |
| top category total exposure | 12,980,328 |
| top spending categories returned | 8 |
| management dashboard category rows | 6 |
| forecast current payables | 5,827,334 |

Hosted read-only SQL reconciliation:

| Source total | Amount |
| --- | ---: |
| realized expense entries | 34,315,781 |
| project-linked realized expense / profitability impact | 31,427,269 |
| planned obligations | 5,827,334 |
| realized uncategorized general rows | 0 |
| realized supplier rows missing category | 0 |

Top realized category evidence:

| Category | Group | Rows | Realized cost |
| --- | --- | ---: | ---: |
| Malzeme | Resmi | 34 | 8,093,825 |
| Malzeme | Gayri Resmi | 17 | 3,889,442 |
| Şantiye Gideri | Resmi | 15 | 3,814,767 |
| Mimari / Proje | Resmi | 10 | 2,118,092 |
| Nakliye | Resmi | 5 | 1,742,400 |
| Taşeron | Resmi | 8 | 1,620,000 |
| Diğer | Resmi | 5 | 1,427,091 |
| Tapu | Resmi | 4 | 1,395,000 |

## Reconciliation Results

| Area | Result | Notes |
| --- | --- | --- |
| Category source documented | PASS | Uses expense card category, personnel fallback, and uncategorized fallback |
| Realized category totals | PASS | `34,315,781` reconciles to realized expense entries |
| Planned category totals | PASS | `5,827,334` reconciles to Phase 7B payable obligations |
| Project profitability impact | PASS | `31,427,269` reconciles to project-linked realized expenses |
| Payables reconciliation | PASS | Category cash pressure equals current payable obligations |
| Forecast reconciliation | PASS | Category cash pressure equals forecast current payables |
| Official/unofficial split | PASS | Group/account split preserved |
| Management dashboard category reporting | PASS | `top_spending_categories` added |
| Top spending categories | PASS | Top category is `Malzeme` |
| Uncategorized items surfaced | PASS | Fallback exists; hosted count is `0` |

## Required Checks

| Risk | Result |
| --- | --- |
| Uncategorized expense hidden from totals | PASS |
| Same expense counted in multiple categories | PASS |
| Category totals exceed realized expenses | PASS |
| Planned obligations counted as realized expenses | PASS |
| Supplier expenses misclassified | PASS |
| Personnel expenses misclassified | PASS |
| Project-linked expenses missing category | PASS |
| Official/unofficial category mismatch | PASS |
| Forecast category pressure mismatch | PASS |
| Profitability category mismatch | PASS |

## Category Granularity Note

Current hosted category labels are business-entered Turkish categories such as:

- `Malzeme`
- `Şantiye Gideri`
- `Mimari / Proje`
- `Taşeron`
- `Ruhsat`
- `Tapu`
- `İşçilik`
- `Nakliye`
- `Ofis Gideri`
- `Diğer`

Granular categories such as cement, iron, demolition, machinery rental, permits, and subcontractors can be represented only to the extent the expense card category or source data names them. No schema change was made in this phase.

## Files Changed

- `public_html/api/admin/dashboard.php`
- `src/lib/apiTypes.ts`
- `src/pages/admin/AdminDashboard.tsx`
- `docs/PHASE_7F_EXPENSE_CATEGORY_INTELLIGENCE_AUDIT.md`

Deployed:

- `public_html/api/admin/dashboard.php`
- current `dist/` frontend build assets

Protected files were not modified or uploaded:

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
| `npm run test` | PASS, 23 tests |
| `npm run finance:parity` | PASS, 15 checks |
| `npm run finance:shadow-test` | PASS |
| Authenticated hosted dashboard API | PASS |
| Authenticated canonical diagnostics endpoint | PASS |
| Hosted PHP admin log review | PASS, no fatal/parse errors or warnings in reviewed tail |
| Deployed asset category labels | PASS |

## Decision

CATEGORY_INTELLIGENCE_VERIFIED
