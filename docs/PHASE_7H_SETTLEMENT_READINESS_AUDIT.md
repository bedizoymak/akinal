# Phase 7H Settlement Readiness Audit

## Scope

- Phase: `PHASE_7H_SETTLEMENT_READINESS_AUDIT`
- Execution date: 2026-06-17
- Settlement status: disabled
- Database writes: none
- Migrations/schema changes: none
- Config/env changes: none
- Code changes: none

## Objective

Determine whether enabling settlement could create incorrect matching, balance corruption, double-counting, or cashflow distortion.

## Current Safety State

Settlement remains guarded by `CANONICAL_SETTLEMENT_ENABLED`. The transaction service rejects every public settlement command unless that constant is explicitly enabled. No production endpoint enables settlement during this audit.

The disabled settlement foundation already includes:

- PDO transactions.
- `FOR UPDATE` locks for plan, entry, and settlement rows.
- Idempotent entry creation by business/source identity.
- Idempotent active settlement pair handling.
- Over-allocation rejection.
- Official/unofficial isolation.
- Currency isolation.
- Counterparty/project validation.
- Reversal-only correction flow.

## Readiness Formula Contract

| Area | Formula | Readiness status |
| --- | --- | --- |
| Customer Remaining | `Receivable - Collected` | Verified by canonical read/shadow tests |
| Supplier Remaining | `Purchase / planned obligation - Paid` | Verified through 7B payable fix and current tests |
| Personnel Remaining | `Cost / planned obligation - Paid` | Verified through 7B payable fix and current tests |
| Project Exposure | `Outstanding Receivables - Outstanding Payables` | Verified by 7A/7D/7G surfaces |
| Official Exposure | `Official Receivables - Official Payables` | Verified by 7E contract |
| Unofficial Exposure | `Unofficial Receivables - Unofficial Payables` | Verified by 7E contract |

## Hosted Evidence Available

Latest successful hosted evidence from the immediately preceding verified phase:

| Surface | Evidence |
| --- | --- |
| Current payables | `5,827,334` |
| Overdue payables | `5,021,072` |
| Upcoming payments | `24,391` |
| Payment priority queue | 6 actions, score sorted, 0 duplicates |
| Collection priority queue | 6 actions, score sorted, 0 duplicates |
| Category priority queue | 6 actions, score sorted, 0 duplicates |
| Canonical diagnostics | 5 surfaces PASS, mismatch count 0 |

## Direct Settlement Readiness Checks

| Required check | Result | Notes |
| --- | --- | --- |
| Receivable balance mismatch | PASS | Covered by canonical read parity and diagnostics |
| Payable balance mismatch | PASS | Covered by 7B fix, dashboard payables, and action queue values |
| Customer over-collection | WARNING | Raw hosted SQL scan was blocked by Imunify360 before SELECT execution |
| Supplier over-payment | WARNING | Raw hosted SQL scan was blocked by Imunify360 before SELECT execution |
| Personnel over-payment | WARNING | Raw hosted SQL scan was blocked by Imunify360 before SELECT execution |
| Negative receivable | WARNING | Requires raw hosted SELECT scan before enablement |
| Negative payable | WARNING | Requires raw hosted SELECT scan before enablement |
| Duplicate obligation | WARNING | Requires raw hosted SELECT scan before enablement |
| Duplicate collection | WARNING | Requires raw hosted SELECT scan before enablement |
| Duplicate payment | WARNING | Requires raw hosted SELECT scan before enablement |
| Missing customer linkage | WARNING | Requires raw hosted SELECT scan before enablement |
| Missing supplier linkage | WARNING | Requires raw hosted SELECT scan before enablement |
| Missing personnel linkage | WARNING | Requires raw hosted SELECT scan before enablement |
| Missing project linkage | WARNING | Requires raw hosted SELECT scan before enablement |
| Official/unofficial mismatch | PASS | Contract and shadow tests reject crossing |
| Settlement source ambiguity | WARNING | Proven in tests; production raw duplicate/source scan still required |

## Settlement Candidate Mapping

Settlement candidates should be mapped only when all fields align:

| Candidate type | Plan source | Entry source | Required match |
| --- | --- | --- | --- |
| Customer collection | `ak_payment_plans.customer_id IS NOT NULL` | realized customer receipt entry/payment | account type, currency, customer, project, amount capacity |
| Supplier payment | payable plan or planned supplier obligation | realized supplier expense/payment entry | account type, currency, supplier card, project, amount capacity |
| Personnel payment | payable plan or planned personnel obligation | realized personnel expense/payment entry | account type, currency, personnel, project, amount capacity |
| General expense payment | payable plan or planned general obligation | realized expense entry | account type, currency, project or approved overhead exception |

No FIFO allocation should be enabled yet. Candidate matching must be explicit or simulated only.

## Readiness Risks

1. Raw hosted SQL duplicate/orphan/negative-balance scan did not complete.
   - The authenticated SQL Editor request was blocked by Imunify360 bot protection before SELECT execution.
   - No SQL write was attempted.

2. Schema hardening is still a boundary.
   - Phase 4C documented that provenance lookups exist but reviewed uniqueness constraints are still a later hardening item.
   - This does not block simulation, but it blocks confident authoritative write cutover.

3. Real two-connection MySQL concurrency testing has not been run on an approved disposable hosting-side dataset.
   - Deterministic PDO tests verify lock usage and loser rollback.
   - Production simulation should remain read-only until a disposable host-side integration path exists.

## Validation

| Validation | Result |
| --- | --- |
| `php -l public_html/api/admin/dashboard.php` | PASS |
| `npx tsc --noEmit` | PASS |
| `npm run test` | PASS, 23 tests |
| `npm run build` | PASS |
| `npm run finance:transaction-test` | PASS, 7 checks |
| `npm run finance:parity` | PASS, 15 checks |
| `npm run finance:shadow-test` | PASS |
| Hosted diagnostics | Last successful run PASS; 7H rerun blocked by host automation protection |
| PHP logs | FTP log directory reachable; no exposed PHP log file available for direct review |

## Readiness Classification

READY_WITH_WARNINGS

The code-level settlement foundation is technically strong enough for controlled settlement simulation, but not for activation as an authoritative production write path yet.

Before moving from simulation to enablement, run a hosting-side read-only SQL readiness scan that verifies:

- duplicate obligation groups = 0 or documented
- duplicate collection/payment groups = 0 or documented
- overpaid plan groups = 0 or documented
- orphan customer/supplier/personnel/project links = 0 or documented
- unknown account types = 0
- negative balances = 0 or explained
- active settlement candidate ambiguity = 0 or manually mapped

## Decision

READY_WITH_WARNINGS
