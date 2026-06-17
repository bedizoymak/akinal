# Phase 7I Settlement Dry Run

## Scope

- Phase: `PHASE_7I_SETTLEMENT_DRY_RUN`
- Execution date: 2026-06-17
- Mode: simulation only
- Settlement status: disabled
- Database writes: none
- Migrations/schema changes: none
- Config/env changes: none
- Real settlement rows: none
- FIFO allocation: not used
- Automatic correction: none

## Objective

Create a read-only settlement dry-run report showing what settlement would match, skip, warn, or reject without changing production data.

## Execution Result

The production-equivalent dry-run could not be executed safely in this phase.

Reason:

- Phase 7H already found that hosted raw SQL duplicate/orphan/negative-balance scans were blocked by Imunify360 automation protection.
- Phase 7I requires production/current records to produce meaningful candidate counts and row classifications.
- The existing CLI classifier is read-only, but it requires a database connection config. No approved hosting-side dry-run connection or endpoint was available.
- The classifier correctly refused to connect without approved config and printed help only. No database connection was attempted.

Because the dry-run did not execute against hosting data, candidate totals below are intentionally marked unavailable rather than guessed.

## Required Outputs

| Output | Value | Status |
| --- | ---: | --- |
| `total_candidate_receivables` | unavailable | BLOCKED |
| `total_candidate_payables` | unavailable | BLOCKED |
| `total_matched_amount` | unavailable | BLOCKED |
| `total_unmatched_amount` | unavailable | BLOCKED |
| `duplicate_candidate_count` | unavailable | BLOCKED |
| `over_allocation_risk_count` | unavailable | BLOCKED |
| `missing_linkage_count` | unavailable | BLOCKED |
| `official_matched_amount` | unavailable | BLOCKED |
| `unofficial_matched_amount` | unavailable | BLOCKED |
| `customer_match_rows` | unavailable | BLOCKED |
| `supplier_match_rows` | unavailable | BLOCKED |
| `personnel_match_rows` | unavailable | BLOCKED |
| `general_expense_match_rows` | unavailable | BLOCKED |
| `manual_review_rows` | unavailable | BLOCKED |

## Dry-Run Matching Contract

The simulation must use explicit candidate matching only. FIFO allocation is not allowed.

| Candidate type | Required match | Reject when |
| --- | --- | --- |
| Customer collection | account type + currency + customer + project + available receivable capacity | account crossing, currency mismatch, amount exceeds capacity, missing customer, missing project, duplicate candidate, inactive source |
| Supplier payment | account type + currency + supplier card + project + available payable capacity | account crossing, currency mismatch, amount exceeds capacity, missing supplier card, missing project, duplicate candidate, inactive source |
| Personnel payment | account type + currency + personnel + project + available payable capacity | account crossing, currency mismatch, amount exceeds capacity, missing personnel, missing project, duplicate candidate, inactive source |
| General expense payment | account type + currency + project or approved overhead exception + available payable capacity | account crossing, currency mismatch, amount exceeds capacity, missing project without exception, duplicate candidate, inactive source |

## Expected Classifications

Each candidate row should be classified as exactly one of:

- `match_safe`
- `skip_unmatched`
- `warn_manual_review`
- `reject_account_type_crossing`
- `reject_currency_mismatch`
- `reject_over_allocation`
- `reject_missing_owner`
- `reject_missing_project`
- `reject_duplicate_candidate`
- `reject_inactive_source`

## Required Manual Review Categories

The dry-run must surface:

- duplicate candidate matches
- unmatched receivables
- unmatched payables
- overpaid or over-collected candidates
- missing customer linkage
- missing supplier linkage
- missing personnel linkage
- missing project linkage
- official/unofficial crossing attempts
- currency mismatch candidates
- settlement source ambiguity

## Existing Safety Evidence

The settlement foundation and shadow tests still protect the core matching contract:

| Validation | Result |
| --- | --- |
| `npm run finance:transaction-test` | PASS, 7 checks |
| `npm run finance:parity` | PASS, 15 checks |
| `npm run finance:shadow-test` | PASS |
| `php -l public_html/api/admin/dashboard.php` | PASS |
| `npx tsc --noEmit` | PASS |
| `npm run test` | PASS, 23 tests |
| `npm run build` | PASS |

Covered by tests:

- settlement remains disabled unless explicitly enabled
- official/unofficial crossing is rejected
- currency mismatch is rejected
- over-allocation is rejected
- duplicate risk classifier is active
- rollback behavior is verified
- reversal preserves history

## Diagnostics And Logs

- Hosted diagnostics could not be rerun in this phase because automated hosted auth/API access was already affected by the same protection path observed in 7H.
- PHP log review remains limited to FTP visibility; no exposed PHP error log file was listed through the FTP account in 7H.
- No new PHP fatal, parse, or warning evidence was introduced by this phase because no code changed.

## Required Next Step Before Any Settlement Simulation

Create one approved hosting-side read-only dry-run execution path, without enabling settlement:

1. Authenticated admin-only dry-run endpoint or manual SQL Editor run.
2. Uses `public_html/api/config.php` and existing hosting DB connection only.
3. Runs inside a read-only transaction where supported.
4. Emits aggregate counts and redacted row identifiers only.
5. Does not create `ak_payment_plan_settlements` rows.
6. Does not update `paid_amount`, statuses, ledgers, or source records.
7. Removes or disables any temporary endpoint after capture if one is created.

## Decision

DRY_RUN_BLOCKED
