# Phase 5C Mismatch Catalog

## Scope

This catalog classifies canonical read shadow mismatches for Phase 5C.

No production-equivalent hosting diagnostics were available in this turn, so the production mismatch catalog is pending. Local fixture and test harness mismatches are listed separately.

## Classification Model

| Class | Meaning | Examples | Required Action |
| --- | --- | --- | --- |
| Rounding | Values differ only by minor decimal precision | `100.005` vs `100.01` | Normalize money precision to 2 decimals |
| Allocation | Paid/remaining amounts differ due to linked vs unlinked payment allocation | Partial payment applied to different plan | Review allocation identity and settlement rules |
| Status | Legacy status label differs from canonical derived state | `Bekliyor` vs `Vadesi Geçti` | Check due date, paid amount, canceled/archive state |
| Overdue | Due-state differs | remaining amount exists but overdue bucket differs | Verify `as_of_date` and timezone |
| Duplicate counting | Same business event counted from ledger and legacy row | `ak_payments` plus `ak_financial_entries` evidence | Exclude duplicate-risk rows from authoritative totals |
| Legacy data quality | Missing/ambiguous source data prevents reliable parity | missing account type, missing project, stale paid amount | Classify or repair data before cutover |

## Local Fixture Results

| Source | Mismatch Class | Count | Status | Notes |
| --- | --- | ---: | --- | --- |
| `php tools/canonical-read-flags-test.php` | Rounding | 0 | PASS | No mismatch |
| `php tools/canonical-read-flags-test.php` | Allocation | 0 | PASS | No mismatch |
| `php tools/canonical-read-flags-test.php` | Status | 0 | PASS | No mismatch |
| `php tools/canonical-read-flags-test.php` | Overdue | 0 | PASS | No mismatch |
| `php tools/canonical-read-flags-test.php` | Duplicate counting | 0 | PASS | No mismatch |
| `php tools/canonical-read-flags-test.php` | Legacy data quality | 0 | PASS | No mismatch |
| `php tools/backend-canonical-read-model-parity-test.php` | Rounding | 0 | PASS | No mismatch |
| `php tools/backend-canonical-read-model-parity-test.php` | Allocation | 0 | PASS | Linked/unlinked allocation fixture passed |
| `php tools/backend-canonical-read-model-parity-test.php` | Status | 0 | PASS | Paid/partial/overdue states passed |
| `php tools/backend-canonical-read-model-parity-test.php` | Overdue | 0 | PASS | Overdue and upcoming buckets passed |
| `php tools/backend-canonical-read-model-parity-test.php` | Duplicate counting | 0 | PASS | No duplicate fixture mismatch |
| `php tools/backend-canonical-read-model-parity-test.php` | Legacy data quality | 0 | PASS | No data quality fixture mismatch |
| `npm run finance:shadow-test` | Duplicate counting | 1 expected probe | PASS | Classifier intentionally reports duplicate/double-count risk in synthetic probe |

## Production Diagnostics Catalog

Pending. Must be populated from hosting-side output of:

```text
GET /api/admin/canonical-read-diagnostics.php
```

Required table after hosting run:

| Surface | Mismatch Class | Count | Example Path | Decision |
| --- | --- | ---: | --- | --- |
| Dashboard summary | Pending | Pending | Pending | Pending |
| Dashboard monthly financials | Pending | Pending | Pending | Pending |
| Dashboard overdue plans | Pending | Pending | Pending | Pending |
| Dashboard upcoming plans | Pending | Pending | Pending | Pending |
| Reports aggregates | Pending | Pending | Pending | Pending |
| Notifications candidates | Pending | Pending | Pending | Pending |
| Payments plan states | Pending | Pending | Pending | Pending |
| Payment Plans plan states | Pending | Pending | Pending | Pending |
| Customer financial statement plan states | Pending | Pending | Pending | Pending |

## Resolution Rules

- Rounding mismatch: acceptable only when absolute difference is less than or equal to `0.01` and both values are in the same currency bucket.
- Allocation mismatch: not acceptable for cutover unless linked to documented legacy-only unallocated payment behavior.
- Status mismatch: not acceptable when it changes paid, partial, overdue, or canceled business meaning.
- Overdue mismatch: not acceptable unless caused by an agreed `as_of_date` discrepancy.
- Duplicate counting mismatch: not acceptable in authoritative totals.
- Legacy data quality mismatch: must be cataloged with row identity and excluded or corrected before cutover.

## Current Catalog Decision

BLOCKED

Reason: production diagnostics are pending. Local mismatch count is zero except for the intentional duplicate-risk classifier probe, but production-equivalent verification has not been captured.
