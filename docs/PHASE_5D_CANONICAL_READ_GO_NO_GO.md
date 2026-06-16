# Phase 5D Canonical Read GO/NO-GO

## Scope

- Objective: final read-side cutover decision after authenticated canonical read diagnostics.
- Source documents:
  - `docs/PHASE_5C_H_AUTH_DIAGNOSTICS_RERUN.md`
  - `docs/PHASE_5A_CANONICAL_READ_CUTOVER_PLAN.md`
  - `docs/ENGINEERING_GUARDRAILS.md`
- Production writes: none
- Migrations: none
- Schema changes: none
- Cutover performed in this phase: none
- Canonical settlement activation: none

## Diagnostics Summary

Phase 5C-H authenticated diagnostics completed successfully through the existing admin login flow.

| Check | Result |
| --- | --- |
| Authentication | PASS |
| Diagnostics endpoint reachable | PASS |
| Diagnostics JSON captured | PASS |
| Overall diagnostics status | PASS |
| Total `mismatch_count` | `0` |
| Remaining mismatches | None |

Surface results:

| Surface | Status | Mismatch Count |
| --- | --- | ---: |
| `dashboard.summary` | PASS | 0 |
| `dashboard.overdue_plans` | PASS | 0 |
| `dashboard.upcoming_plans` | PASS | 0 |
| `dashboard.monthly_financials` | PASS | 0 |
| `reports.aggregates` | PASS | 0 |

## GO / NO-GO Criteria

| Criterion | Result |
| --- | --- |
| Authenticated diagnostics succeeds | GO |
| All required surfaces pass | GO |
| Total mismatch count is zero | GO |
| No unexplained overdue/upcoming mismatch remains | GO |
| `CANONICAL_READ_MODEL_ENABLED=false` until Phase 5E | GO |
| `CANONICAL_SETTLEMENT_ENABLED=false` | GO |
| No production DB writes were required | GO |
| No migrations were required | GO |
| No schema changes were required | GO |
| No local localhost DB result used as authoritative proof | GO |
| Rollback remains flag-only | GO |

NO-GO conditions are not present for the covered read surfaces.

## Flags

Flags must remain disabled until Phase 5E:

| Flag | Required State Before 5E |
| --- | --- |
| `CANONICAL_READ_MODEL_ENABLED` | `false` |
| `CANONICAL_READ_MODEL_SHADOW_COMPARE` | `true` |
| `CANONICAL_READ_MODEL_FAIL_CLOSED` | `true` |
| `CANONICAL_READ_MODEL_LOG_MISMATCHES` | `true` |
| `CANONICAL_SETTLEMENT_ENABLED` | `false` |

Phase 5D does not activate canonical reads.

## Phase 5E Cutover Steps

Phase 5E should be a controlled read-side activation only.

1. Confirm `public_html/api/config.php` is the active hosting source of truth.
2. Confirm `CANONICAL_SETTLEMENT_ENABLED=false`.
3. Confirm no migration or schema change is pending.
4. Re-run authenticated diagnostics immediately before activation.
5. Confirm all required surfaces still pass with total `mismatch_count=0`.
6. Enable `CANONICAL_READ_MODEL_ENABLED=true` using the agreed production flag mechanism.
7. Keep `CANONICAL_READ_MODEL_SHADOW_COMPARE=true`.
8. Keep `CANONICAL_READ_MODEL_FAIL_CLOSED=true`.
9. Keep `CANONICAL_READ_MODEL_LOG_MISMATCHES=true`.
10. Verify response shapes remain stable for:
    - dashboard
    - reports
    - notifications
    - payments
    - payment plans
    - financial statement
11. Verify UI surfaces load:
    - dashboard
    - customers
    - finance
    - reports
12. Re-run authenticated diagnostics after activation.
13. Confirm all covered surfaces still pass.
14. Document observed flags, status table, mismatch count, and any warnings.

Phase 5E must not enable canonical settlement or change any write path.

## Rollback Steps

Rollback must remain read-only and flag-only:

1. Set `CANONICAL_READ_MODEL_ENABLED=false`.
2. Keep `CANONICAL_SETTLEMENT_ENABLED=false`.
3. Keep production data untouched.
4. Do not run migrations.
5. Do not alter schema.
6. Clear application/server cache if applicable.
7. Re-test:
   - `/api/admin/canonical-read-diagnostics.php`
   - dashboard
   - reports
   - notifications
   - payments
   - payment plans
   - financial statement
8. Preserve mismatch logs for analysis.
9. If a runtime PHP error appears, revert only the Phase 5B/5C read-flag and canonical read facade files.

Rollback succeeds when:

- dashboard loads
- reports load
- notifications load
- payments/payment plans load
- financial statement loads
- canonical read flag is disabled
- no production data mutation occurred

## Remaining Constraints

- This decision covers read-side canonical activation only.
- It does not approve canonical settlement/write activation.
- It does not approve migrations or schema changes.
- Legacy write paths remain unchanged.
- Any future DB-dependent verification must follow hosting-side execution rules from `docs/ENGINEERING_GUARDRAILS.md`.

## Final Decision

READY_FOR_PHASE_5E

