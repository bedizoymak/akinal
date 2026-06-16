# Phase 5B Canonical Read Flags And Shadow Compare

## Scope

- Phase: 5B
- Objective: implement disabled read-side feature flags and shadow comparison around the backend canonical read-model facade.
- Rules followed: no canonical settlement activation, no write behavior changes, no migrations, no schema changes, no production writes, API response shapes preserved.
- Database execution during implementation: none.

## Implemented Flags

Defaults are defined in `public_html/api/config.example.php` and read safely from constants or environment variables.

| Flag | Default | Status |
| --- | --- | --- |
| `CANONICAL_READ_MODEL_ENABLED` | `false` | Implemented |
| `CANONICAL_READ_MODEL_SHADOW_COMPARE` | `true` | Implemented |
| `CANONICAL_READ_MODEL_FAIL_CLOSED` | `true` | Implemented |
| `CANONICAL_READ_MODEL_LOG_MISMATCHES` | `true` | Implemented |

`CANONICAL_SETTLEMENT_ENABLED` remains separate and unchanged.

## Files Implemented

| File | Purpose |
| --- | --- |
| `public_html/api/admin/canonical-read-flags.php` | Backend read flag reader, legacy-compatible fallback, shadow comparison, sanitized mismatch logging, fail-closed selector, diagnostics builder |
| `public_html/api/admin/canonical-read-diagnostics.php` | Admin-only read-only diagnostics endpoint |
| `tools/canonical-read-flags-test.php` | Local no-database fixture test for flags, fail-closed checks, and mismatch detection |

## Endpoint Wiring

| Endpoint | Change | Default Output |
| --- | --- | --- |
| `dashboard.php` | Wrapped dashboard summary, plan buckets, and monthly financials with `canonical_read_select()` | Legacy-compatible output |
| `reports.php` | Wrapped report aggregates with `canonical_read_select()` | Legacy-compatible output |
| `notifications.php` | Wrapped notification plan-state candidates with `canonical_read_select()` | Legacy-compatible output |
| `payments.php` | Wrapped GET payment-plan state with `canonical_read_select()` | Legacy-compatible output |
| `payment-plans.php` | Wrapped GET payment-plan state with `canonical_read_select()` | Legacy-compatible output |
| `financial-statement.php` | Wrapped customer statement plan-state output with `canonical_read_select()` | Legacy-compatible output |

## Shadow Compare Behavior

When `CANONICAL_READ_MODEL_SHADOW_COMPARE=true`, the wrapper computes legacy-compatible and canonical outputs and compares them without changing the response shape.

Mismatch logging is sanitized:

- no credentials
- no raw customer names
- no document URLs
- no full SQL
- no secrets
- only surface name, missing fields, mismatch count, and mismatch paths

## Fail-Closed Behavior

When `CANONICAL_READ_MODEL_ENABLED=true` and `CANONICAL_READ_MODEL_FAIL_CLOSED=true`, canonical output is selected only if required fields are present.

If required fields are missing:

1. sanitized mismatch is logged when logging is enabled
2. legacy-compatible output is returned
3. API response shape remains stable

## Diagnostics

Read-only diagnostics endpoint:

```text
GET /api/admin/canonical-read-diagnostics.php
```

It requires admin authentication and returns:

- active read-model flag values
- dashboard summary parity report
- dashboard overdue/upcoming plan parity report
- dashboard monthly financials parity report
- report aggregate parity report

Local no-database fixture tool:

```text
php tools/canonical-read-flags-test.php
```

## Important Constraints

- `public_html/api/config.php` was not modified.
- Canonical read activation remains disabled unless production config explicitly enables it.
- Canonical settlement activation was not changed.
- Existing write endpoints still behave as before.
- No runtime DDL was introduced.
- No local PDO/database verification was performed.
- Server-side production diagnostics must follow `docs/ENGINEERING_GUARDRAILS.md`.

## Validation

| Validation | Result |
| --- | --- |
| PHP lint: `canonical-read-flags.php` | PASS |
| PHP lint: `canonical-read-diagnostics.php` | PASS |
| PHP lint: touched backend endpoints | PASS |
| PHP lint: `tools/canonical-read-flags-test.php` | PASS |
| `php tools/canonical-read-flags-test.php` | PASS |
| `php tools/backend-canonical-read-model-parity-test.php` | PASS |
| `npm run finance:parity` | PASS |
| `npm run finance:shadow-test` | PASS |
| `npm run test` | PASS |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS |

## Final Decision

READY_FOR_PHASE_5C
