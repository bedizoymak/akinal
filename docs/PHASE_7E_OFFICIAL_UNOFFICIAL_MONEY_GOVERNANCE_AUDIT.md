# Phase 7E Official/Unofficial Money Governance Audit

## Scope

- Phase: `PHASE_7E_OFFICIAL_UNOFFICIAL_MONEY_GOVERNANCE_AUDIT`
- Goal: verify official, unofficial, and combined money positions independently across financial surfaces.
- Production data writes: none
- Migrations/schema changes: none
- Config/env changes: none
- Settlement activation: not enabled

## Finding

A real governance calculation gap was found and fixed.

The forecast exposed official and unofficial cash positions, but combined operational cash was still sourced from the broader dashboard net balance. Hosted evidence showed:

```text
official_cash_position + unofficial_cash_position != combined_operational_cash_position
```

There were no unknown `group_tag` rows causing this. The mismatch came from mixed source selection, not missing classification.

## Fix Applied

The dashboard read model now calculates operational cash consistently from official/unofficial realized ledger buckets:

```text
combined_operational_cash_position =
official_cash_position + unofficial_cash_position
```

The command center `net_cash_position` now uses the same combined operational cash value as the forecast.

Official/unofficial split fields were also added to financial cards:

- customer official/unofficial contract, collected, and remaining receivable totals
- supplier official/unofficial paid and remaining payable totals
- personnel official/unofficial cost and remaining payable totals
- project official/unofficial profit and cash exposure totals from Phase 7D

The dashboard UI now surfaces the key split values in customer, project, supplier, and personnel cards.

## Classification Source

| Source | Official/unofficial field | Normalization |
| --- | --- | --- |
| `ak_financial_entries` realized money | `group_tag` | `Resmi` / `Gayri Resmi` |
| `ak_financial_entries` planned payables | `group_tag` | `Resmi => resmi`, `Gayri Resmi => gayri_resmi` |
| `ak_payment_plans` planned receivables/payables | `account_type` | `resmi` / `gayri_resmi` |
| `ak_payments` realized customer payments used for plan allocation | `account_type` | `resmi` / `gayri_resmi` |

Unknown account/group types are not silently present in current hosted data.

## Required Formulas

Official Cash Position:

```text
sum(realized official income) - sum(realized official expense)
```

Unofficial Cash Position:

```text
sum(realized unofficial income) - sum(realized unofficial expense)
```

Combined Operational Cash:

```text
official_cash_position + unofficial_cash_position
```

Official Project Profit:

```text
official_project_revenue - official_project_expenses
```

Unofficial Project Profit:

```text
unofficial_project_revenue - unofficial_project_expenses
```

Combined Project Profit:

```text
official_project_profit + unofficial_project_profit
```

Official Cash Exposure:

```text
official_receivables - official_payables
```

Unofficial Cash Exposure:

```text
unofficial_receivables - unofficial_payables
```

## Hosted Evidence

Authenticated hosted dashboard API after the fix:

| Metric | Value |
| --- | ---: |
| official_cash_position | 323,867,507 |
| unofficial_cash_position | 11,809,430 |
| combined_operational_cash_position | 335,676,937 |
| official + unofficial matches combined | PASS |
| command center net cash matches forecast combined | PASS |
| customer card split fields present | PASS |
| project card split fields present | PASS |
| supplier card split fields present | PASS |
| personnel card split fields present | PASS |

Hosted read-only SQL reconciliation:

| Bucket | Direction | Rows | Amount |
| --- | --- | ---: | ---: |
| Gayri Resmi | Gelir | 53 | 22,620,117 |
| Gayri Resmi | Gider | 54 | 10,810,687 |
| Resmi | Gelir | 109 | 347,372,601 |
| Resmi | Gider | 110 | 23,505,094 |

Payable split after Phase 7B logic:

| Account type | Rows | Remaining |
| --- | ---: | ---: |
| gayri_resmi | 12 | 1,527,464 |
| resmi | 28 | 4,299,870 |

Unknown classification checks:

| Check | Count |
| --- | ---: |
| unknown `ak_financial_entries.group_tag` rows | 0 |
| unknown `ak_payment_plans.account_type` rows | 0 |
| unknown `ak_payments.account_type` rows | 0 |

## Reconciliation Results

| Area | Result | Notes |
| --- | --- | --- |
| Realized income split | PASS | Uses `ak_financial_entries.group_tag` |
| Realized expense split | PASS | Uses `ak_financial_entries.group_tag` |
| Planned receivable split | PASS | Uses `ak_payment_plans.account_type` |
| Planned payable split | PASS | Uses Phase 7B payable obligations and account normalization |
| Customer cards | PASS | Official/unofficial receivable split now exposed |
| Project cards | PASS | Official/unofficial profit and cash exposure from Phase 7D exposed |
| Supplier cards | PASS | Official/unofficial paid/payable split now exposed |
| Personnel cards | PASS | Official/unofficial cost/payable split now exposed |
| Forecast | PASS | Combined cash equals official plus unofficial |
| Command center | PASS | Net cash matches forecast combined operational cash |
| Management dashboard | PASS | Uses command/action/forecast sources after reconciliation |

## Required Checks

| Risk | Result |
| --- | --- |
| Official amount counted as unofficial | PASS |
| Unofficial amount counted as official | PASS |
| Same amount counted in both buckets | PASS |
| Missing account type hidden from totals | PASS, unknown count is `0` |
| Planned obligations losing account type | PASS |
| Forecast combined cash mismatch | Fixed |
| Project profit split mismatch | PASS |
| Payable split mismatch | PASS |
| Collection split mismatch | PASS |
| Payment split mismatch | PASS |

## Files Changed

- `public_html/api/admin/dashboard.php`
- `src/lib/apiTypes.ts`
- `src/pages/admin/AdminDashboard.tsx`
- `docs/PHASE_7E_OFFICIAL_UNOFFICIAL_MONEY_GOVERNANCE_AUDIT.md`

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
| Deployed asset split labels | PASS |

## Decision

OFFICIAL_UNOFFICIAL_VERIFIED
