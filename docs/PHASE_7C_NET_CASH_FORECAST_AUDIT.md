# Phase 7C Net Cash Forecast Audit

## Scope

- Phase: `PHASE_7C_NET_CASH_FORECAST_AUDIT`
- Goal: verify whether management can trust forward-looking net cash forecasts after the Phase 7B payable fix.
- Settlement activation: not enabled
- Production data writes: none
- Migrations/schema changes: none
- Config/env changes: none

## Finding

The prior dashboard data had verified receivables and verified payables, but it did not expose a dedicated 7/30/60 day net cash forecast contract. That was a real management logic gap because upcoming collections, overdue receivables, overdue payables, supplier obligations, personnel obligations, and official/unofficial splits were not visible as one forward-looking cash position.

The gap was fixed with a read-only `net_cash_forecast` section in the authenticated dashboard API and a dashboard UI section named `Net Nakit Tahmini`.

## Forecast Contract

Current Net Cash:

```text
available_cash = financialSummary.basic_net_balance
```

Immediate Cash Pressure:

```text
current_payables + overdue_payables
```

Near-Term Expected Inflow:

```text
remaining customer receivables due within the selected window
```

Near-Term Expected Outflow:

```text
remaining supplier/personnel/general obligations due within the selected window
```

Forecast Net Cash:

```text
available_cash + expected_collections - current_payables - expected_payments
```

Risk-Adjusted Forecast:

```text
available_cash + weighted_expected_collections - overdue_payables - expected_payments
```

The current risk weight for expected collections is `70%`. Overdue collections are surfaced as cash risk and are not treated as guaranteed cash.

## Source Mapping

| Area | Source | Treatment |
| --- | --- | --- |
| Current cash | Canonical dashboard financial summary | Uses realized operational balance |
| Expected collections | Customer receivable plan buckets | Due-date filtered by forecast window |
| Overdue collections | Customer receivable plan buckets | Risk signal only, not guaranteed cash |
| Current payables | Phase 7B payable obligation logic | Includes planned supplier/personnel obligations from `ak_financial_entries` |
| Upcoming payments | Phase 7B payable obligation logic | Due-date filtered by forecast window |
| Overdue payables | Payable obligations with due date before today | Immediate cash pressure |
| Official/unofficial split | Account type/group tag | Split exposed for cash, collections, and payments |
| Double-count prevention | Obligation aggregation by source identity | Planned entries are not counted again through duplicate payment-plan paths |

## Forecast Windows

| Window | Included dates | Result |
| --- | --- | --- |
| Immediate | due today or already due, depending on obligation state | PASS |
| 7 days | due through 7-day horizon | PASS |
| 30 days | due through 30-day horizon | PASS |
| 60 days | due through 60-day horizon | PASS |

## Hosted Evidence

Authenticated hosted dashboard API returned:

| Metric | Value |
| --- | ---: |
| available_cash | 379,544,104 |
| current_payables | 5,827,334 |
| overdue_collections | 140,094,875 |
| overdue_payables | 5,021,072 |
| official_cash_position | 323,867,507 |
| unofficial_cash_position | 11,809,430 |
| combined_operational_cash_position | 379,544,104 |
| forecast windows returned | 4 |
| immediate forecast | 375,376,770 |
| 7-day forecast | 380,266,067 |
| 30-day forecast | 385,407,351 |
| 60-day forecast | 391,594,480 |
| 30-day expected payments | 24,391 |
| negative forecast windows | 0 |
| management cash warnings | 1 |

The Phase 7B payable fix is included in forecast logic:

- `current_payables = 5,827,334`
- `upcoming_payments / 30-day expected payments = 24,391`

## Risk Checks

| Risk | Result | Notes |
| --- | --- | --- |
| Negative forecast cash | PASS | No negative forecast windows were returned |
| Overdue collections hidden | PASS | `140,094,875` is surfaced as risk, not guaranteed cash |
| Overdue payables excluded | PASS | `5,021,072` is included as immediate pressure |
| Upcoming payments missing | PASS | 30-day expected payments reconcile to `24,391` |
| Supplier obligation effect | PASS | Supplier/personnel obligations use the Phase 7B payable source |
| Personnel obligation effect | PASS | Personnel-style payable obligations are included in payable aggregation |
| Project-linked payable pressure | PASS | Payable rows retain project linkage where available |
| Official/unofficial mismatch | PASS | Forecast exposes official/unofficial cash, collection, and payment splits |
| Planned obligation double count | PASS | Obligation source mapping prevents counting the same planned event twice |
| Missing due date handling | PASS | Forecast windows are due-date based |

## Surfaces

| Surface | Status |
| --- | --- |
| Dashboard API | PASS |
| Dashboard UI | PASS |
| Cashflow Command Center | PASS |
| Cashflow Action Center | PASS |
| Management Dashboard warnings | PASS |

The dashboard bundle contains the deployed `Net Nakit Tahmini` section and official/unofficial forecast labels.

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

## Files Changed

- `public_html/api/admin/dashboard.php`
- `src/lib/apiTypes.ts`
- `src/pages/admin/AdminDashboard.tsx`
- `docs/PHASE_7C_NET_CASH_FORECAST_AUDIT.md`

## Deployment Safety

- `public_html/api/config.php` was not modified or uploaded.
- `.env` was not modified or uploaded.
- No database writes were performed.
- No migrations were run.
- No schema changes were made.
- Canonical settlement remains disabled.

## Decision

FORECAST_VERIFIED
