# Phase 5C-F Overdue Plans Mismatch Fix

## Scope

- Target: authenticated canonical read diagnostics overdue-plan mismatches.
- Reported mismatches:
  - `dashboard.summary.overdue_collections`
  - `dashboard.summary.overdue_plan_count`
  - `dashboard.overdue_plans` with 1250 mismatches
- Production data writes: none
- Migrations: none
- Schema changes: none
- Read cutover: none
- `CANONICAL_READ_MODEL_ENABLED`: remains default `false`
- Production data changed: no

## Root Cause

Two issues were found in the shadow comparison path.

### 1. Overdue Definition Mismatch

The canonical read model used the correct cashflow definition:

- overdue if `due_date < today`
- and `remaining_amount > 0`

The legacy shadow helper was narrower:

- overdue if `due_date < today`
- and `paid <= 0`

That excluded partially paid overdue plans from the legacy side even when they still had remaining receivable. This caused summary mismatches for:

- `overdue_collections`
- `overdue_plan_count`

### 2. Array Index Comparison Noise

`canonical_read_compare()` compared overdue plan arrays recursively by numeric index. If legacy and canonical lists contained the same business rows but in different order, each shifted row generated many field-level mismatches.

This explains the high `dashboard.overdue_plans` mismatch count. The comparison was too sensitive to list order and did not use stable project/payment-plan identity.

## Fixes Implemented

### Overdue Definition

Updated `canonical_read_legacy_customer_plan_buckets()` in `public_html/api/admin/canonical-read-flags.php`:

- before: overdue only when `paid <= 0`
- after: overdue when `remaining_amount > 0`

This aligns legacy shadow comparison with the canonical cashflow contract.

### Stable List Comparison

Updated `canonical_read_compare()`:

- detects list-like arrays containing row `id`
- indexes both sides by `id`
- compares by stable row identity instead of numeric array index
- reports `missing_legacy_field` and `missing_canonical_field` separately

### Deterministic Sorting

Updated both legacy shadow and canonical buckets to sort plan lists by:

1. `due_date`
2. `customer_id`
3. normalized `account_type`
4. `id`

Files changed:

- `public_html/api/admin/canonical-read-flags.php`
- `public_html/api/admin/backend-canonical-read-model.php`
- `tools/canonical-read-flags-test.php`

## Deployment

Uploaded only these read-only PHP files to hosting:

- `public_html/api/admin/canonical-read-flags.php`
- `public_html/api/admin/backend-canonical-read-model.php`

Explicitly not touched:

- `public_html/api/config.php`
- database data
- schema
- migrations
- canonical activation flags

## Validation

Local validation:

| Check | Result |
| --- | --- |
| `php -l public_html/api/admin/canonical-read-flags.php` | PASS |
| `php -l public_html/api/admin/backend-canonical-read-model.php` | PASS |
| `php -l public_html/api/admin/canonical-read-diagnostics.php` | PASS |
| `php tools/canonical-read-flags-test.php` | PASS |
| `php tools/backend-canonical-read-model-parity-test.php` | PASS |

Regression coverage added:

| Test | Result |
| --- | --- |
| ID-keyed list comparison ignores array order | PASS |
| Partially paid overdue plan remains overdue by remaining balance | PASS |

Hosting endpoint protection check:

| Check | Result |
| --- | --- |
| Unauthenticated `/api/admin/canonical-read-diagnostics.php` returns JSON | PASS |
| Endpoint remains admin-auth protected | PASS |

## Authenticated Diagnostics Rerun

Authenticated diagnostics could not be rerun from this environment because no admin credentials or authenticated session cookie are available.

Credential/session availability:

| Source | Result |
| --- | --- |
| `SMOKE_ADMIN_EMAIL` / `SMOKE_ADMIN_PASSWORD` | Not present |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Not present |
| `AKINAL_ADMIN_EMAIL` / `AKINAL_ADMIN_PASSWORD` | Not present |
| Existing authenticated session cookie | Not available |

No credentials or cookies were printed. No auth bypass was added.

## Expected Diagnostic Outcome

After authenticated rerun, the expected result is:

| Surface | Expected Result |
| --- | --- |
| `dashboard.summary.overdue_collections` | PASS or materially reduced to true data mismatch only |
| `dashboard.summary.overdue_plan_count` | PASS or materially reduced to true data mismatch only |
| `dashboard.overdue_plans` | No order-only mismatch explosion |

Any remaining mismatches should represent true row/value differences, not list-order comparison noise.

## Final Decision

BLOCKED

Reason: the fix was implemented, tested locally, and deployed to hosting, but the required authenticated diagnostics rerun could not be completed without a real admin session.

