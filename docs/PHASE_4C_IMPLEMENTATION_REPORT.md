# Phase 4C - Disabled Canonical Transaction Foundation

**Date:** 2026-06-15  
**Status:** Implemented, disabled, no cutover  
**Final decision:** `READY_FOR_PHASE_4D`

## Scope Delivered

Added `public_html/api/admin/canonical-transaction-service.php` with:

- `createCanonicalEntry()`
- `createLegacyBackedEntry()`
- `settlePlan()`
- `reverseCanonicalEntry()`
- `derivePlanState()`

The service uses the existing caller-provided `PDO` connection. It introduces no database connection path and is not imported by any live endpoint.

## Safety State

- `CANONICAL_SETTLEMENT_ENABLED` is documented as `false` in `public_html/api/config.example.php`.
- If the constant is absent, the service remains disabled.
- Every public command rejects execution unless the constant is explicitly boolean `true`.
- Only the isolated test harness enables the flag.
- No read or write cutover was added.
- No production SQL was executed.
- No migration, schema change, staging connection, or environment override was introduced.
- No FIFO allocation exists in the service.
- No posted-entry edit or delete operation exists; corrections use reversal records.

## Transaction and Integrity Controls

### Entry creation

- Validates the existing canonical finance contract.
- Runs in a PDO transaction.
- Locks indexed business/source identity lookups with `FOR UPDATE`.
- Returns an existing identical entry for idempotent retries.
- Rejects identity reuse with different canonical data.
- Stores compatibility fields while preserving canonical account and currency values.

### Settlement

- Locks the plan and financial entry with `FOR UPDATE`.
- Locks active settlement rows before calculating totals.
- Requires an active plan and active posted entry.
- Validates account type, currency, counterparty, project scope, and positive amount.
- Rejects plan or entry over-allocation.
- Rejects official/unofficial crossing.
- Rejects cross-currency settlement.
- Prevents a second active plan/entry pair from silently changing allocation data.
- Derives plan state from active settlements only.

### Reversal

- Accepts only an unreversed posted entry.
- Requires a reason and creates a separate posted reversal entry.
- Locks and reverses active settlements instead of deleting them.
- Marks the original as reversed and links the reversal entry.
- Rolls back all changes if any operation fails.

## Test Coverage

Added `tools/canonical-transaction-foundation-test.php` and npm command:

`npm run finance:transaction-test`

Passing scenarios:

1. Legacy source idempotency.
2. Plan/entry/settlement locking and fully paid state derivation.
3. Official/unofficial isolation.
4. Currency isolation.
5. Simulated concurrent second-writer over-allocation rejection.
6. Transaction rollback after a forced settlement insert failure.
7. Reversal preserving original history and reversing active settlements.

The deterministic PDO test double verifies transaction boundaries and emitted `FOR UPDATE` statements without connecting to local MySQL or modifying hosting data.

## Validation Results

- `npm run finance:transaction-test`: 7 passed, 0 failed.
- `npm run finance:parity`: 15 passed, 0 failed.
- `npm run test`: 3 files passed, 16 tests passed.
- PHP lint across `public_html` and `tools`: passed.
- `npm run build`: passed.
- Existing unrelated PHP deprecation remains in `contact-request.php` for the Turnstile helper's implicitly nullable parameter.

## Known Boundary

A real two-connection MySQL concurrency test was not run because this phase prohibits production data changes and no approved disposable staging database connection exists. Local `localhost` was not treated as authoritative. Phase 4D must run the same synthetic scenarios hosting-side against an approved disposable/restored environment before any migration or cutover approval.

The current non-unique provenance indexes support locked identity lookups, but a later separately approved schema-hardening phase should add reviewed uniqueness constraints before canonical writes can become authoritative.

## No Live Behavior Change

Repository search confirms that only the standalone test harness imports the new transaction service. Existing payment, plan, expense, ledger, dashboard, card, and report endpoints remain unchanged.

## Final Decision

`READY_FOR_PHASE_4D`

Phase 4C meets the disabled-foundation objective. Phase 4D may proceed with read-only classification/reconciliation planning and an approved disposable hosting-side integration test design. This decision does not authorize schema deployment, historical migration, read cutover, write cutover, or production flag activation.
