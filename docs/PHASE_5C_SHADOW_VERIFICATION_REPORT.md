# Phase 5C Shadow Verification Report

## Scope

- Phase: 5C
- Objective: verify canonical read-model output against production-equivalent outputs while canonical reads remain disabled.
- Required state: `CANONICAL_READ_MODEL_ENABLED=false`.
- Rules followed locally: no production writes, no migrations, no schema changes, no canonical settlement activation, no write cutover, no local database verification.
- Current date: 2026-06-16.

## Guardrail Position

`docs/ENGINEERING_GUARDRAILS.md` says local PDO/localhost tests are not authoritative for Akinal Insaat database access. Therefore this report separates:

- local fixture and code-level verification, which passed
- production-equivalent hosting-side shadow verification, which was not executed in this turn

The final read-side GO decision cannot be granted until the read-only diagnostics endpoint is run server-side on hosting against the known SQL Editor connection path.

## Shadow Surfaces

| Surface | Local/fixture verification | Hosting-side verification | Status |
| --- | --- | --- | --- |
| Dashboard financial totals | Covered by backend parity fixtures and read flag tests | Not run | BLOCKED |
| Dashboard monthly financials | Covered by facade tests | Not run | BLOCKED |
| Dashboard overdue/upcoming collections | Covered by plan-state fixtures | Not run | BLOCKED |
| Reports aggregates | Covered by read flag tests | Not run | BLOCKED |
| Notifications due-state candidates | Covered by facade/flag wiring | Not run | BLOCKED |
| Payments GET plan state | Covered by facade/flag wiring | Not run | BLOCKED |
| Payment Plans GET plan state | Covered by facade/flag wiring | Not run | BLOCKED |
| Customer financial statement plan state | Covered by facade/flag wiring | Not run | BLOCKED |

## Local Verification Commands

| Command | Result |
| --- | --- |
| `php tools/canonical-read-flags-test.php` | PASS |
| `php tools/backend-canonical-read-model-parity-test.php` | PASS |
| `npm run finance:parity` | PASS |
| `npm run finance:shadow-test` | PASS |
| `npm run test` | PASS |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS |
| PHP lint for canonical read diagnostics/flags | PASS |

## Local Mismatch Statistics

| Source | Rounding | Allocation | Status | Overdue | Duplicate counting | Legacy data quality | Result |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `tools/canonical-read-flags-test.php` | 0 | 0 | 0 | 0 | 0 | 0 | PASS |
| `tools/backend-canonical-read-model-parity-test.php` | 0 | 0 | 0 | 0 | 0 | 0 | PASS |
| `npm run finance:parity` | 0 | 0 | 0 | 0 | 0 | 0 | PASS |
| `npm run finance:shadow-test` | 0 | 0 | 0 | 0 | 1 expected duplicate-risk probe | 0 | PASS |

The duplicate-risk probe in `finance:shadow-test` is expected and confirms the classifier detects duplicate/double-count risk. It is not a production mismatch.

## Production-Equivalent Verification Required

Run this only after deployment to hosting, with `CANONICAL_READ_MODEL_ENABLED=false`:

```text
GET /api/admin/canonical-read-diagnostics.php
```

Expected safe state:

- `flags.enabled = false`
- `flags.shadow_compare = true`
- all diagnostics reports return `PASS`
- `mismatch_count = 0` for every authoritative read surface
- no secrets in output or logs
- no writes triggered by diagnostics

## GO Criteria For Phase 5D

All must be true:

1. Hosting-side SQL Editor path is confirmed against `akinalin_wp282`.
2. `CANONICAL_READ_MODEL_ENABLED=false`.
3. `CANONICAL_SETTLEMENT_ENABLED=false`.
4. `GET /api/admin/canonical-read-diagnostics.php` runs server-side on hosting.
5. Diagnostics report zero unexplained mismatches.
6. No production writes, migrations, or schema changes occur during verification.
7. Dashboard, reports, notifications, payments, payment plans, and financial statement pages still load with stable response shapes.

## NO-GO Criteria

Any of these blocks Phase 5D:

1. Diagnostics are not run on hosting.
2. Local `localhost` database output is used as proof.
3. Any financial surface reports unexplained mismatch.
4. Any official/unofficial account type mismatch appears.
5. Any overdue or remaining amount mismatch appears.
6. Any duplicate/double-count risk appears in authoritative totals.
7. Any verification requires production writes or schema changes.

## Final Decision

BLOCKED

Reason: local and fixture verification passed, but production-equivalent hosting-side shadow verification has not been run or captured. Under the Akinal Insaat DB access guardrail, local verification is not sufficient for read-side GO.
